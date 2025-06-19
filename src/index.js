import fs from "fs";
import { loadFiltersFileData, compileQuery, loadOptions } from "./utils.js";
import { process } from "./process.js";

// This is the "main" loop of the program
try {
  const options = loadOptions(process.argv);

  // Output Directory
  if (!fs.existsSync(options["OutputDirectory"])) {
    fs.mkdirSync(options["OutputDirectory"], { recursive: true });
  }

  // Load filters
  let query = "*:*";
  if (options["FiltersFile"]) {
    const filtersFileData = loadFiltersFileData(options["FiltersFile"]);
    query = compileQuery(filtersFileData.data);
  }

  const queryUrl = new URL(
    options["APIURL"] + options["Core"] + "/select?q=" + query,
  );
  const headers = { "Ocp-Apim-Subscription-Key": options["APIKey"] };

  process(options, queryUrl, headers);
} catch (error) {
  console.error("Error:", error.message);
  process.exit(1);
}
