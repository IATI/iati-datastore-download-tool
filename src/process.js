import fs from "fs";
import fetch from "node-fetch";
import { sleep, convert_doc_arrays_to_strings } from "./utils.js";
import { stringify } from "csv-stringify";

function stringifyAsync(data, options, filename) {
  // Used for CSV writing
  return new Promise((resolve, reject) => {
    stringify(data, options, (err, output) => {
      if (err) return reject(err);
      fs.writeFileSync(filename, output);
      resolve(output);
    });
  });
}

function process(options, queryUrl, headers) {
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
    } else if (options["Format"] == "json-xml") {
      queryUrl.searchParams.set("fl", "iati_json");
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
        } else if (options["Format"] == "json-xml") {
          let out = [];
          for (let x in formattedResponse.response.docs) {
            out.push(JSON.parse(formattedResponse.response.docs[x].iati_json));
          }
          fs.writeFileSync(
            options["OutputDirectory"] + "/" + "page" + page + ".json",
            JSON.stringify(out, null, 2),
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
        } else if (options["Format"] == "csv") {
          let docs = formattedResponse.response.docs;
          let columns = Object.keys(docs[0]);
          let docs_csv = docs.map(convert_doc_arrays_to_strings);
          await stringifyAsync(
            docs_csv,
            {
              header: true,
              columns: columns,
            },
            options["OutputDirectory"] + "/" + "page" + page + ".csv",
          );
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

export { process };
