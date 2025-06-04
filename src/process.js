import fs from "fs";
import fetch from "node-fetch";
import { sleep } from "./utils.js";

function processJSONResponseWriter(options, queryUrl, headers) {
  // This is used for cases with JSON Response Writers.
  // We just paginate over the results and do something as we save them.

  (async () => {
    let currentCursorMark = "*";
    let done = false;
    let page = 1;

    queryUrl.searchParams.set("rows", options["RowsPerPage"]);
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

    console.log("Finished");
  })();
}

function processOtherResponseWriter(options, queryUrl, headers) {
  // This is used for cases where it's not a JSON Response Writers.

  (async () => {
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

    // Now lets get the real data ................................
    if (numDocs < options["RowsPerPage"]) {
      // We can just get all the results in one, great.
      queryUrl.searchParams.set("rows", numDocs);
      if (options["Format"] == "csv") {
        queryUrl.searchParams.set("wt", "csv");
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
    } else {
      // We have to loop through in a difficult manner .....

      let currentCursorMark = "*";
      let done = false;
      let page = 1;

      queryUrl.searchParams.set("rows", options["RowsPerPage"]);
      queryUrl.searchParams.set("sort", "id asc");

      do {
        console.log("Getting page " + page);

        queryUrl.searchParams.set("cursorMark", currentCursorMark);

        // Make Meta call
        queryUrl.searchParams.set("wt", "json");
        const responseMeta = await fetch(queryUrl.toString(), {
          headers: headers,
        });
        if (!responseMeta.ok) {
          throw new Error(`HTTP error! status: ${responseMeta.status}`);
        }
        const metaFormattedResponse = await responseMeta.json();
        const nextCursorMark = metaFormattedResponse.nextCursorMark;

        // Make Data call
        if (options["Format"] == "csv") {
          queryUrl.searchParams.set("wt", "csv");
        }
        const responseData = await fetch(queryUrl.toString(), {
          headers: headers,
        });
        if (!responseData.ok) {
          throw new Error(`HTTP error! status: ${responseData.status}`);
        }
        const body = await responseData.text();

        // Save data
        if (options["Format"] == "csv") {
          fs.writeFileSync(
            options["OutputDirectory"] + "/" + "page" + page + ".csv",
            body,
            "utf-8",
          );
        }

        // Next page?
        if (nextCursorMark === currentCursorMark) {
          done = true;
        } else {
          currentCursorMark = nextCursorMark;
          page += 1;
          await sleep(2000);
        }
      } while (!done);
    }

    console.log("Finished");
  })();
}

export { processOtherResponseWriter, processJSONResponseWriter };
