import fs from "fs";
import fetch from "node-fetch";
import { loadJsonFile, compileQuery, sleep, loadOptions } from "./utils.js";

const SOLR_MAX_ROWS = 100;

try {
  const options = loadOptions(process.argv);

  // Output Directory
  if (!fs.existsSync(options["OutputDirectory"])) {
    fs.mkdirSync(options["OutputDirectory"], { recursive: true });
  }

  // Load filters
  let query = "*:*";
  if (options["FiltersFile"]) {
    const jsonFiltersData = loadJsonFile(options["FiltersFile"]);

    // This copied from importFilters function in https://github.com/IATI/datastore-search/blob/develop/src/global.js
    for (let i = 0; i < jsonFiltersData.data.length; i++) {
      if (jsonFiltersData.data[i].type === "date") {
        jsonFiltersData.data[i].value = new Date(jsonFiltersData.data[i].value);
      }
    }

    query = compileQuery(jsonFiltersData.data);
  }

  // Set up Query
  const queryUrl = new URL(
    "https://api.iatistandard.org/datastore/" +
      options["Core"] +
      "/select?q=" +
      query,
  );
  const headers = { "Ocp-Apim-Subscription-Key": options["APIKey"] };

  (async () => {
    if (options["Format"] == "solr" || options["Format"] == "xml") {
      // The formats we can page over ..............

      let currentCursorMark = "*";
      let done = false;
      let page = 1;

      queryUrl.searchParams.set("rows", SOLR_MAX_ROWS);
      queryUrl.searchParams.set("sort", "id asc");

      if (options["Format"] == "xml") {
        queryUrl.searchParams.set("fl", "iati_xml");
      }

      do {
        console.log("Getting page " + page);

        queryUrl.searchParams.set("cursorMark", currentCursorMark);
        const response = await fetch(queryUrl.toString(), { headers: headers });

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        const formattedResponse = await response.json();

        if (
          formattedResponse.response &&
          Array.isArray(formattedResponse.response.docs) &&
          formattedResponse.response.docs.length > 0
        ) {
          if (options["Format"] == "solr") {
            fs.writeFileSync(
              options["OutputDirectory"] + "/" + "page" + page + ".json",
              JSON.stringify(formattedResponse.response.docs, null, 2),
              "utf-8",
            );
          } else if (options["Format"] == "xml") {
            const date = new Date();
            const fileHandle = fs.openSync(
              options["OutputDirectory"] + "/" + "page" + page + ".xml",
              "w",
            );
            fs.writeSync(
              fileHandle,
              '<?xml version="1.0" encoding="UTF-8"?>\n<iati-activities version="2.03" generated-datetime="' +
                date.toISOString() +
                '">\n',
            );
            for (const doc of formattedResponse.response.docs) {
              if (doc.iati_xml) {
                fs.writeSync(fileHandle, doc.iati_xml + "\n");
              }
            }
            fs.writeSync(fileHandle, "</iati-activities>\n");
            fs.closeSync(fileHandle);
          }
        }

        const nextCursorMark = formattedResponse.nextCursorMark;
        if (nextCursorMark === currentCursorMark) {
          done = true;
        } else {
          currentCursorMark = nextCursorMark;
          page += 1;
          await sleep(1000);
        }
      } while (!done);
    } else {
      // We can't page these ones
      // So first do a query to get the number of docs .....
      console.log("Getting meta data");
      queryUrl.searchParams.set("rows", 0);
      const responseMeta = await fetch(queryUrl.toString(), {
        headers: headers,
      });

      if (!responseMeta.ok) {
        throw new Error(`HTTP error! status: ${responseMeta.status}`);
      }

      const formattedResponse = await responseMeta.json();
      const numDocs = formattedResponse.response.numFound;
      // TODO we aren't checking numFoundExact here - but then neither is https://github.com/IATI/datastore-services/blob/develop/Download/index.js
      console.log("Docs found: " + numDocs);

      // Now lets get the real data
      queryUrl.searchParams.set("rows", numDocs);
      if (options["Format"] == "csv") {
        queryUrl.searchParams.set("wt", "csv");
        queryUrl.searchParams.set("omitHeaders", "false");
      }

      console.log("Getting data");
      const response = await fetch(queryUrl.toString(), { headers: headers });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const body = await response.text();

      if (options["Format"] == "csv") {
        fs.writeFileSync(
          options["OutputDirectory"] + "/" + "page1.csv",
          body,
          "utf-8",
        );
      }
    }
    console.log("Finished");
  })();
} catch (error) {
  console.error("Error:", error.message);
  process.exit(1);
}
