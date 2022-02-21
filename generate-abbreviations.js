import fs from "fs";
import path from "path";

import got from "got";
import * as cheerio from "cheerio";
import sortKeys from "sort-keys";

async function run() {
  const { body: abbreviationsData } = await got(
    "https://www.timeanddate.com/time/zones/",
  );

  const customAbbreviations = {
    "East Africa Time": "EAT",
    "Hawaii-Aleutian Time": "HAST",
    "Brasilia Time": "BRT",
    "Yukon Time": "YT",
    "Venezuela Time": "VET",
    "St. Pierre & Miquelon Time": "PM",
    "Dumont-d’Urville Time": "DDUT",
    "Arabian Time": "AST",
    "East Kazakhstan Time": "ALMT",
    "West Kazakhstan Time": "AQTT",
    "Petropavlovsk-Kamchatski Time": "PETT",
    "Western Indonesia Time": "WIB",
    "Central Indonesia Time": "WITA",
    "Eastern Indonesia Time": "WIT",
    "Korean Time": "KST",
    "Taipei Time": "TWT",
    "Falkland Islands Time": "FKST",
    "Indian Ocean Time": "IOT",
    "French Southern & Antarctic Time": "FSAT",
    "Réunion Time": "RET",
    "Apia Time": "WST",
    "Chatham Time": "CHAST",
    "Phoenix Islands Time": "PHOT",
    "Gilbert Islands Time": "GILT",
    "Wake Island Time": "WAKT",
    "Norfolk Island Time": "NFT",
    "Cook Islands Time": "CKT",
    "Wallis & Futuna Time": "WFT",
  };

  const $ = cheerio.load(abbreviationsData);

  const abbreviations = $("#tz-abb tbody tr")
    .toArray()
    .reduce((acc, row) => {
      const abbreviation = $(row.children[0]).text().trim();
      const longForm = $(row.children[1].children[0]).text().trim();
      acc[longForm] = abbreviation;
      return acc;
    }, {});

  fs.writeFileSync(
    path.join(__dirname, "abbreviations.json"),
    JSON.stringify(
      sortKeys({ ...abbreviations, ...customAbbreviations }),
      null,
      2,
    ),
  );
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
