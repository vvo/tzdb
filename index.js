import fs from "fs";
import path from "path";

import parse from "csv-parse";
import unzipper from "unzipper";
import got from "got";
import algoliasearch from "algoliasearch";
import dotenv from "dotenv";
import { DateTime } from "luxon";
import { chunk, orderBy } from "lodash";
import pEachSeries from "p-each-series";

dotenv.config();

async function run() {
  const algoliaApplicationId = process.env.ALGOLIA_APPLICATION_ID;
  const algoliaAdminApiKey = process.env.ALGOLIA_ADMIN_API_KEY;
  const algoliaIndexName = process.env.ALGOLIA_INDEX_NAME;

  const algoliaClient = algoliasearch(algoliaApplicationId, algoliaAdminApiKey);
  const algoliaIndex = algoliaClient.initIndex(algoliaIndexName);

  await algoliaIndex
    .setSettings({
      searchableAttributes: ["name", "countryName", "timezoneName"],
      attributesToRetrieve: ["name", "countryName", "timezoneName"],
      customRanking: ["desc(population)"],
    })
    .wait();
  const { userData } = await algoliaIndex.getSettings();

  const lastIndexUpdate = userData?.lastIndexUpdate || "1970-01-01";

  const timeZonesParser = got
    .stream("http://download.geonames.org/export/dump/timeZones.txt")
    .pipe(parse({ delimiter: "\t" }));
  const timeZones = [];

  for await (const timeZoneFields of timeZonesParser) {
    timeZones.push(timeZoneFields[1]);
  }

  fs.writeFileSync(
    path.join(__dirname, "time-zones.json"),
    JSON.stringify(timeZones.sort()).replace(/",/g, '",\n'),
  );

  const countriesParser = got
    .stream("https://download.geonames.org/export/dump/countryInfo.txt")
    .pipe(parse({ delimiter: "\t" }));
  const countries = {};

  for await (const countryFields of countriesParser) {
    countries[countryFields[0]] = countryFields[4];
  }

  const citiesCsv = got
    .stream("https://download.geonames.org/export/dump/cities15000.zip")
    .pipe(unzipper.ParseOne());

  const citiesParser = citiesCsv.pipe(
    parse({
      delimiter: "\t",
    }),
  );
  const cities = [];
  const updatedCities = [];

  for await (const cityFields of citiesParser) {
    // http://download.geonames.org/export/dump/readme.txt geoname section has 19 fields
    if (cityFields.length > 19) {
      console.error(
        `Number of fields changed or not accurate for record ${cityFields}`,
      );
      console.log(cityFields.length);
      process.exit(1);
    }

    const modificationDate = cityFields[18];

    const city = {
      geonameId: cityFields[0],
      name: cityFields[1],
      countryName: countries[cityFields[8]],
      timezoneName: cityFields[17],
      population: parseInt(cityFields[14], 10),
      modificationDate,
    };

    cities.push(city);

    if (modificationDate > lastIndexUpdate) {
      updatedCities.push({
        objectID: city.geonameId,
        ...city,
      });
    }
  }

  fs.writeFileSync(
    path.join(__dirname, "cities.json"),
    JSON.stringify(orderBy(cities, "population", "desc")).replace(
      /},/g,
      "},\n",
    ),
  );

  await pEachSeries(chunk(updatedCities, 500), async function saveToAlgolia(
    citiesChunk,
  ) {
    await algoliaIndex.saveObjects(citiesChunk);
  });

  await algoliaIndex
    .setSettings({
      userData: { lastIndexUpdate: DateTime.utc().toISODate() },
    })
    .wait();

  console.log(
    `Done, ${updatedCities.length} cities were updated since last run`,
  );
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
