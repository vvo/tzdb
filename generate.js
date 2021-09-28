import fs from "fs";
import path from "path";

import parse from "csv-parse";
import unzipper from "unzipper";
import got from "got";
import dotenv from "dotenv";
import { DateTime } from "luxon";
import { orderBy, uniq } from "lodash";

import formatTimeZone from "./lib/formatTimeZone.js";
import abbreviations from "./abbreviations.json";

dotenv.config();

async function run() {
  const continents = {
    AF: "Africa",
    AS: "Asia",
    EU: "Europe",
    NA: "North America",
    OC: "Oceania",
    SA: "South America",
    AN: "Antarctica",
  };

  const countriesParser = got
    .stream("https://download.geonames.org/export/dump/countryInfo.txt")
    .pipe(parse({ delimiter: "\t" }));
  const countries = {};
  const countriesToContinents = {};

  for await (const countryFields of countriesParser) {
    countries[countryFields[0]] = countryFields[4];
    countriesToContinents[countryFields[0]] = countryFields[8];
  }

  // prepare deprecated time zone names map, example:
  // {
  //   'Australia/Sydney': [ 'Australia/ACT', 'Australia/Canberra', 'Australia/NSW' ].
  //   ...
  // }
  const { body: deprecatedNamesData } = await got(
    "https://data.iana.org/time-zones/data/backward",
  );

  const deprecatedNames = {};

  for (const line of deprecatedNamesData.split("\n")) {
    if (line.startsWith("#") || line === "") {
      continue;
    }

    const [, newName, deprecatedName] = line.replace(/\t+/g, ",").split(",");
    deprecatedNames[newName] ??= [];
    deprecatedNames[newName].push(deprecatedName);
  }

  const citiesCsv = got
    .stream("https://download.geonames.org/export/dump/cities15000.zip")
    .pipe(unzipper.ParseOne());

  const citiesParser = citiesCsv.pipe(
    parse({
      delimiter: "\t",
    }),
  );
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

    // const modificationDate = cityFields[18];
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
  }

  // Time zones

  const timeZonesNames = [];
  const timeZonesInfo = {};

  const timeZonesParser = got
    .stream("http://download.geonames.org/export/dump/timeZones.txt")
    .pipe(parse({ delimiter: "\t", from_line: 2 }));

  const countryStats = {};

  for await (const timeZoneFields of timeZonesParser) {
    const timeZoneName = timeZoneFields[1];

    const tz = DateTime.fromObject(
      {},
      {
        zone: timeZoneName,
      },
    );

    if (tz.isValid !== true) {
      console.error(
        "Time zone data not accurate, please investigate",
        tz.invalidReason,
        timeZoneName,
      );
      continue;
    }

    timeZonesNames.push(timeZoneName);

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

  // Node.js can't seem to get nice alt names for these zones for now
  const alternativeNameCorrections = {
    "Antarctica/Palmer": "Chile Time",
    "America/Punta_Arenas": "Chile Time",
    "Africa/Casablanca": "Western European Time",
    "Africa/El_Aaiun": "Western European Time",
    "Europe/Istanbul": "Turkey Time",
    "Asia/Urumqi": "China Time",
    "Pacific/Bougainville": "Bougainville Time",
  };

  const rawTimeZones = [];

  for (let [countryCode, countryTimeZones] of Object.entries(countryStats)) {
    const continentCode = countriesToContinents[countryCode];

    for (let [, timeZoneWithCities] of Object.entries(countryTimeZones)) {
      const orderedCities = orderBy(timeZoneWithCities, "population", "desc");

      const mainCitiesObject = orderedCities.slice(0, 4);
      const mainCities = mainCitiesObject.map(({ name }) => {
        return name;
      });

      const uniqueCitiesTimeZones = uniq(
        timeZoneWithCities.map(({ timeZoneName }) => {
          return timeZoneName;
        }),
      );

      const deprecatedTimeZonesForGroup = uniqueCitiesTimeZones
        .filter((timeZoneName) => {
          return deprecatedNames[timeZoneName];
        })
        .map((timeZoneName) => {
          return deprecatedNames[timeZoneName];
        })
        .flat();

      const group = uniq([
        ...uniqueCitiesTimeZones,
        ...deprecatedTimeZonesForGroup,
      ]);

      const { timeZoneName } = mainCitiesObject[0];

      const januaryDate = DateTime.fromObject(
        {
          day: 1,
          month: 1,
        },
        {
          locale: "en-US",
          zone: timeZoneName,
        },
      );

      let alternativeTimeZoneName = januaryDate
        .toFormat(`ZZZZZ`)
        .replace(/Standard Time/g, "Time")
        .replace(/Daylight Time/g, "Time")
        .replace(/Summer Time/g, "Time");

      // there are some cases where Node.js tz data won't be giving actual alternative names
      // for time zones and instead will send GMT +03:00, so we fix that
      if (/^GMT[+-]\d{2}:\d{2}$/.test(alternativeTimeZoneName)) {
        alternativeTimeZoneName =
          alternativeNameCorrections[timeZoneName] || timeZoneName;
      }

      const rawTimeZone = {
        name: timeZoneName,
        alternativeName: alternativeTimeZoneName,
        group,
        continentCode,
        continentName: continents[continentCode],
        countryName: countries[countryCode],
        countryCode,
        mainCities,
        rawOffsetInMinutes: parseFloat(
          timeZonesInfo[timeZoneName].rawOffset * 60,
        ),
        abbreviation: getAbbreviation({
          date: januaryDate,
          timeZoneName: alternativeTimeZoneName,
        }),
      };

      rawTimeZones.push({
        ...rawTimeZone,
        rawFormat: formatTimeZone(rawTimeZone),
      });
    }
  }

  fs.writeFileSync(
    path.join(__dirname, "time-zones-names.json"),
    JSON.stringify(timeZonesNames.sort()).replace(/",/g, '",\n'),
  );

  fs.writeFileSync(
    path.join(__dirname, "raw-time-zones.json"),
    JSON.stringify(
      orderBy(rawTimeZones, [
        "rawOffsetInMinutes",
        "alternativeName",
        "mainCities[0]",
      ]),
    ).replace(/},/g, "},\n"),
  );
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});

function getAbbreviation({ date, timeZoneName }) {
  const standardAbbreviation =
    abbreviations[timeZoneName.replace("Time", "Standard Time")];

  if (standardAbbreviation) {
    return standardAbbreviation;
  }

  const exactAbbreviation = abbreviations[timeZoneName];

  if (exactAbbreviation) {
    return exactAbbreviation;
  }

  return date.toFormat(`ZZZZ`);
}
