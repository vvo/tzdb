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
  const cities = [];
  const updatedCities = [];
  const citiesPopulation = {};

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
    const alternateCityNames = cityFields[3].split(",");

    const timeZoneName = cityFields[17];

    const tz = DateTime.fromObject({
      zone: timeZoneName,
      day: 1,
      month: 1,
      locale: "en-US",
    });

    const timeZoneOffsetNameWithoutDst = tz
      .toFormat(`ZZZZZ`)
      .replace(/Standard Time/g, "Time")
      .replace(/Daylight Time/g, "Time");

    const city = {
      geonameId: cityFields[0],
      name,
      countryName: countries[cityFields[8]],
      timeZoneName,
      timeZoneOffsetNameWithoutDst,
      population,
      modificationDate,
    };

    cities.push(city);
    citiesPopulation[`${countryCode}${name}`] = population;

    for (let alternateCityName of alternateCityNames) {
      citiesPopulation[`${countryCode}${alternateCityName}`] = population;
    }

    if (modificationDate > lastIndexUpdate) {
      updatedCities.push({
        objectID: city.geonameId,
        ...city,
      });
    }
  }

  fs.writeFileSync(
    path.join(__dirname, "cities-with-time-zones.json"),
    JSON.stringify(orderBy(cities, "population", "desc")).replace(
      /},/g,
      "},\n",
    ),
  );

  // Time zones

  const rawTimeZones = [];

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

    const cityName = timeZoneName.split("/").pop().replace(/_/g, " ");
    const countryCode = timeZoneFields[0];

    const population = citiesPopulation[`${countryCode}${cityName}`] || 0;

    const gmtOffset = timeZoneFields[2];
    const dstOffset = timeZoneFields[3];
    const rawOffset = timeZoneFields[4];

    if (countryStats[countryCode] === undefined) {
      countryStats[countryCode] = {};
    }

    const offsetKey = `${gmtOffset}${dstOffset}${rawOffset}`;

    if (countryStats[countryCode][offsetKey] === undefined) {
      countryStats[countryCode][offsetKey] = [];
    }

    countryStats[countryCode][offsetKey].push({
      timeZoneName,
      cityName,
      population,
    });
  }

  const simplifiedTimeZones = [];

  for (let [, countryTimeZones] of Object.entries(countryStats)) {
    for (let [, offsetCities] of Object.entries(countryTimeZones)) {
      const cities = orderBy(offsetCities, "population", "desc").slice(0, 2);
      const group = offsetCities.map(({ timeZoneName }) => {
        return timeZoneName;
      });

      const { timeZoneName, cityName } = cities[0];

      const tz = DateTime.fromObject({
        locale: "en-US",
        zone: timeZoneName,
        day: 1,
        month: 1,
      });

      const importantCities = cities
        .map(({ cityName }) => {
          return cityName;
        })
        .join(", ");

      const formatted = tz
        .toFormat(`ZZ ZZZZZ - '${importantCities}'`)
        .replace(/Standard Time/g, "Time")
        .replace(/Daylight Time/g, "Time");

      simplifiedTimeZones.push({
        timeZoneName,
        formatted,
        group,
        offset: tz.offset,
        offsetNameShort: tz.offsetNameShort,
        offsetNameLong: tz.offsetNameLong,
        cityName,
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
        "offset",
        "offsetNameLong",
        "cityName",
      ]).map(({ timeZoneName, formatted, group }) => {
        return {
          timeZoneName,
          formatted,
          group,
        };
      }),
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
