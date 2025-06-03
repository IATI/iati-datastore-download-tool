import fs from "fs";
import { format } from "date-fns";
import { Command } from "commander";

function loadJsonFile(filename) {
  if (!fs.existsSync(filename)) {
    throw new Error(`File not found: ${filename}`);
  }

  const data = fs.readFileSync(filename, "utf8");
  return JSON.parse(data);
}

function loadOptions(argv) {
  const program = new Command();
  program
    .option(
      "-a, --apikey <type>",
      "API Key from https://developer.iatistandard.org/",
    )
    .option(
      "-f, --filtersfile <type>",
      "Filename of a JSON filters file downloaded from advanced filters of https://datastore.iatistandard.org/",
    )
    .option("-c, --core <type>", "Core", "activity")
    .option("--format <type>", "Format", "solr")
    .option("-o, --outputdir <type>", "Output Directory.");

  program.parse(argv);

  const options = program.opts();

  const out = {
    APIKey: options.apikey,
    FiltersFile: options.filtersfile,
    Core: options.core,
    Format: options.format,
    OutputDirectory: options.outputdir,
  };

  if (!out["APIKey"] || typeof out["APIKey"] !== "string") {
    throw new Error("Invalid API key. It must be a non-empty string.");
  }

  const validCores = ["activity", "transaction", "budget"];
  if (!validCores.includes(out["Core"])) {
    throw new Error(`Invalid core. Valid cores are: ${validCores.join(", ")}`);
  }

  const validFormatsForAllCores = {
    activity: ["solr", "xml", "csv"],
    transaction: ["solr", "csv"],
    budget: ["solr", "csv"],
  };
  const validFormats = validFormatsForAllCores[out["Core"]];
  if (!validFormats.includes(out["Format"])) {
    throw new Error(
      `Invalid format. Valid formats are: ${validFormats.join(", ")}`,
    );
  }

  if (!out["OutputDirectory"] || typeof out["OutputDirectory"] !== "string") {
    throw new Error(
      "Invalid Output Directory key. It must be a non-empty string.",
    );
  }

  return out;
}

// This is basically the function from https://github.com/IATI/datastore-search/blob/develop/src/global.js
// Except changed so it takes parameters instead of using global vars.
function filterIsGrouping(filters, filterId) {
  if (filters.length <= 1) {
    return false;
  } else {
    let previousIndex = 1;
    for (let i = 1; i < filters.length; i++) {
      if (filters[i].id === filterId) {
        previousIndex = i - 1;
        break;
      }
    }
    for (let i = 0; i < filters.length; i++) {
      if (
        filters[i].value === "(" &&
        filters[i].id === filters[previousIndex].id
      ) {
        return filters[i].type === "grouping";
      }
      if (filters[i].value === ")" && filters[i].id === filterId) {
        return filters[i].type === "grouping";
      }
    }
    return false;
  }
}

// This is from https://github.com/IATI/datastore-search/blob/develop/src/global.js
const disallowedStrings = ["{!func}", "_val_"];

// This is basically the function from https://github.com/IATI/datastore-search/blob/develop/src/global.js
function cleanSolrQueryString(qString) {
  const stylizedQuotes = ["“", "”", "«", "»"];
  stylizedQuotes.forEach((str) => {
    const reg = new RegExp(str, "g");
    qString = qString.replace(reg, '"');
  });
  disallowedStrings.forEach((str) => {
    const reg = new RegExp(str, "g");
    qString = qString.replace(reg, "");
  });
  return qString;
}

// This is basically the function from https://github.com/IATI/datastore-search/blob/develop/src/global.js
function getFilterValue(filter) {
  switch (filter["type"]) {
    case "text":
      return `(${cleanSolrQueryString(filter["value"])})`;
    case "combo":
      return `(${cleanSolrQueryString(filter["value"])})`;
    case "date":
      return `${format(filter["value"], "yyyy-MM-dd")}T00:00:00Z`;
    default:
      return filter["value"];
  }
}

// This is basically the function from https://github.com/IATI/datastore-search/blob/develop/src/global.js
// Except changed so it takes parameters and returns a result instead of using global vars.
function compileQuery(filters) {
  let query = "";

  let firstFilter = true;
  let joinOperator = "";

  for (const filterIndex in filters) {
    const filter = filters[filterIndex];

    if (firstFilter) {
      firstFilter = false;
    } else {
      joinOperator = " " + filter.joinOperator + " ";
    }

    if (!filterIsGrouping(filters, filter.id)) {
      query = query + joinOperator;
    }

    const queryValue = getFilterValue(filter);

    if (
      filter["type"] === "date" ||
      filter["type"] === "number" ||
      filter["type"] === "integer"
    ) {
      switch (filter["operator"]) {
        case "equals":
          // needs to be encasulated in "" for equals
          query = query + filter["field"] + ':"' + queryValue + `"`;
          break;
        case "lessThan":
          query = query + filter["field"] + ":[ * TO " + queryValue + "]";
          break;
        case "greaterThan":
          query = query + filter["field"] + ":[" + queryValue + " TO * ]";
          break;
        default:
          break;
      }
    } else if (filter["type"] === "grouping") {
      query = query + queryValue;
    } else {
      switch (filter["operator"]) {
        case "equals":
          query = query + filter["field"] + ":" + queryValue;
          break;
        case "notEquals":
          query = query + "(*:* -" + filter["field"] + ":" + queryValue + ")";
          break;
        default:
          break;
      }
    }
  }

  return query;
}

function sleep(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

export { loadJsonFile, compileQuery, sleep, loadOptions };
