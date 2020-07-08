import fs from "fs";
import path from "path";

import parse from "csv-parse";
import unzipper from "unzipper";
import got from "got";
import algoliasearch from "algoliasearch";
import dotenv from "dotenv";
import { DateTime } from "luxon";
import { chunk, orderBy, uniq } from "lodash";
import pEachSeries from "p-each-series";

import formatTimeZone from "./lib/formatTimeZone.js";

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

  const lastIndexUpdate =
    process.env.LAST_INDEX_UPDATE || userData?.lastIndexUpdate || "1970-01-01";

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
  const updatedCities = [];
  const timeZoneCities = {};

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
    const name = cityFields[1];
    const population = parseInt(cityFields[14], 10);
    const countryCode = cityFields[8];

    const timeZoneName = cityFields[17];
    timeZoneCities[countryCode] = timeZoneCities[countryCode] || {};
    timeZoneCities[countryCode][timeZoneName] =
      timeZoneCities[countryCode][timeZoneName] || [];

    timeZoneCities[countryCode][timeZoneName].push({
      name,
      population,
      timeZoneName,
    });

    const tz = DateTime.fromObject({
      zone: timeZoneName,
      day: 1,
      month: 1,
      locale: "en-US",
    });

    const alternativeTimeZoneName = tz
      .toFormat(`ZZZZZ`)
      .replace(/Standard Time/g, "Time")
      .replace(/Daylight Time/g, "Time");

    const city = {
      geonameId: cityFields[0],
      name,
      countryName: countries[cityFields[8]],
      timeZoneName,
      alternativeTimeZoneName,
      population,
      modificationDate,
    };

    if (modificationDate > lastIndexUpdate) {
      updatedCities.push({
        objectID: city.geonameId,
        ...city,
      });
    }
  }

  // Time zones

  const rawTimeZones = [];
  const timeZonesInfo = {};

  const timeZonesParser = got
    .stream("http://download.geonames.org/export/dump/timeZones.txt")
    .pipe(parse({ delimiter: "\t", from_line: 2 }));

  const countryStats = {};

  for await (const timeZoneFields of timeZonesParser) {
    const timeZoneName = timeZoneFields[1];

    const tz = DateTime.fromObject({
      zone: timeZoneName,
    });

    if (tz.isValid !== true) {
      console.error(
        "Time zone data not accurate, please investigate",
        tz.invalidReason,
        timeZoneName,
      );
      continue;
    }

    rawTimeZones.push(timeZoneName);

    const countryCode = timeZoneFields[0];

    const gmtOffset = timeZoneFields[2];
    const dstOffset = timeZoneFields[3];
    const rawOffset = timeZoneFields[4];

    // there's no "easy way" to get all the raw offset from time zones (when not in DST) because DST times
    // are happening at various dates given countries (GOOD JOB GOVERNEMENTS!). Since geonames provides it,
    // we save it for later usage
    timeZonesInfo[timeZoneName] = {
      rawOffset,
    };

    if (countryStats[countryCode] === undefined) {
      countryStats[countryCode] = {};
    }

    const offsetKey = `${gmtOffset}${dstOffset}${rawOffset}`;

    if (countryStats[countryCode][offsetKey] === undefined) {
      countryStats[countryCode][offsetKey] = [];
    }

    if (timeZoneCities?.[countryCode]?.[timeZoneName] !== undefined) {
      countryStats[countryCode][offsetKey].push(
        ...timeZoneCities[countryCode][timeZoneName],
      );
    } else {
      countryStats[countryCode][offsetKey].push({
        // we push a default city in case we have no cities present in timeZoneCities
        name: timeZoneName.split("/").pop().replace(/_/g, " "),
        population: 10000,
        timeZoneName,
      });
    }
  }

  const simplifiedTimeZones = [];

  for (let [, countryTimeZones] of Object.entries(countryStats)) {
    for (let [, timeZoneWithCities] of Object.entries(countryTimeZones)) {
      const orderedCities = orderBy(timeZoneWithCities, "population", "desc");

      const mainCitiesObject = orderedCities.slice(0, 2);
      const mainCities = mainCitiesObject.map(({ name }) => {
        return name;
      });

      const group = uniq(
        timeZoneWithCities.map(({ timeZoneName }) => {
          return timeZoneName;
        }),
      );

      const { timeZoneName, name: mainCityName } = mainCitiesObject[0];

      const januaryDate = DateTime.fromObject({
        locale: "en-US",
        zone: timeZoneName,
        day: 1,
        month: 1,
      });

      const alternativeTimeZoneName = januaryDate
        .toFormat(`ZZZZZ`)
        .replace(/Standard Time/g, "Time")
        .replace(/Daylight Time/g, "Time");

      const simplifiedTimeZone = {
        name: timeZoneName,
        alternativeName: alternativeTimeZoneName,
        group,
        mainCities,
        rawOffsetInMinutes: parseFloat(
          timeZonesInfo[timeZoneName].rawOffset * 60,
        ),
        mainCityName,
      };

      simplifiedTimeZones.push({
        ...simplifiedTimeZone,
        formatted: formatTimeZone(simplifiedTimeZone),
      });
    }
  }

  fs.writeFileSync(
    path.join(__dirname, "time-zones-names.json"),
    JSON.stringify(rawTimeZones.sort()).replace(/",/g, '",\n'),
  );

  fs.writeFileSync(
    path.join(__dirname, "simplified-time-zones.json"),
    JSON.stringify(
      orderBy(simplifiedTimeZones, [
        "rawOffsetInMinutes",
        "alternativeName",
        "mainCityName",
      ]).map(
        ({
          name,
          alternativeName,
          mainCities,
          group,
          rawOffsetInMinutes,
          formatted,
        }) => {
          return {
            name,
            alternativeName,
            mainCities,
            group,
            rawOffsetInMinutes,
            formatted,
          };
        },
      ),
    ).replace(/},/g, "},\n"),
  );

  // Algolia update

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
