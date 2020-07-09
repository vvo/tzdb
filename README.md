# tzdb [![GitHub license](https://img.shields.io/github/license/vvo/tzdb?style=flat)](https://github.com/vvo/tzdb/blob/master/LICENSE) [![Tests](https://github.com/vvo/tzdb/workflows/CI/badge.svg)](https://github.com/vvo/tzdb/actions) [![npm version](https://badge.fury.io/js/%40vvo%2Ftzdb.svg)](https://www.npmjs.com/package/@vvo/tzdb)

This is a list and npm package of:

- "simplified" [IANA time zones](https://www.iana.org/time-zones) with their alternative names like `Pacific Time` instead of `America/Los_Angeles`, along with major cities for each time zone.
- all existing raw IANA time zones names

The data and npm packages are **automatically updated** whenever there are changes to https://www.geonames.org/ which is generated from IANA databases.

This is useful whenever you want to build a time zone select menu in your application.

## Available data

### [simplified-time-zones.json](./simplified-time-zones.json)

This is most probably what you're looking for if you're trying to build a time zones selector in your application.

Example data:

```js
[
  // ...
  {
    name: "America/Anchorage",
    alternativeName: "Alaska Time",
    countryName: "United States",
    mainCities: ["Anchorage", "Juneau"],
    formatted: "-09:00 Alaska Time - Anchorage, Juneau",
    group: [
      "America/Anchorage",
      "America/Juneau",
      "America/Metlakatla",
      "America/Nome",
      "America/Sitka",
      "America/Yakutat",
    ],
  },
  {
    name: "Pacific/Gambier",
    alternativeName: "Gambier Time",
    countryName: "French Polynesia",
    mainCities: ["Gambier"],
    formatted: "-09:00 Gambier Time - Gambier",
    group: ["Pacific/Gambier"],
  },
  {
    name: "America/Los_Angeles",
    alternativeName: "Pacific Time",
    countryName: "United States",
    mainCities: ["Los Angeles", "San Diego"],
    formatted: "-08:00 Pacific Time - Los Angeles, San Diego",
    group: ["America/Los_Angeles"],
  },
  // ...
];
```

As you can see, we provide the time zone name and a pre-formatted version using more common offset names.

Notes:

- Grouping: when two different time zones names are in the same country, same offset and dst rules then we merge them and select the time zone name from the biggest city
- We provide two cities when grouping happens, ranked by population
- We provide offset names ("Pacific Time") without dst and remove "Standard" and "Daylight"
- The offsets (-08:00) are always the "raw offsets", the ones when there's no summer time or daylight saving time in place for the time zone. We decided not to include the current date offset. Because then you would have to upgrade this library in your application as soon as it would be updated with the new "current offset". But we provide a function, `formatTimeZone` to compute the same formatted structure, with the current date offset, at runtime instead of buildtime
- This can be used to build a good enough (Google calendar like) select box of time zones, but it's your responsibility to handle dst and real offsets using [luxon](https://moment.github.io/luxon/) for example

### [time-zones-names.json](./time-zones-names.json)

This is the raw list of all IANA time zones ranked by alphabetical order.

Example data:

```js
[
  // ...
  "America/La_Paz",
  "America/Lima",
  "America/Los_Angeles",
  "America/Lower_Princes",
  "America/Maceio",
  "America/Managua",
  "America/Manaus",
  "America/Marigot",
  "America/Martinique",
  // ...
];
```

## NPM package

Installation:

```bash
npm add @vvo/tzdb
```

Usage:

```js
import { simplifiedTimeZones, timeZonesNames, formatTimeZone } from "@vvo/tzdb";
```

## API

### simplifiedTimeZones

### timeZonesNames

### formatTimeZone(simplifiedTimeZone, { useCurrentOffset = false })

You can use this function when you want to get a formatted time zone but with the current date offset. This is useful if you always want to show the real, current time zone offset.

Example usage:

```js
import { simplifiedTimeZones, formatTimeZone } from "@vvo/tzdb";

console.log(
  formatTimeZone(simplifiedTimeZones[10], { useCurrentOffset: true }),
);
// output when in DST:
// -07:00 Pacific Time - Los Angeles, San Diego
```

This function uses luxon internally, so it would be better for your build size to also use luxon in your application whenever you need to manipulate dates.

PS: If you'd like to contribute to this library, we could make it so that formatTimeZone is not luxon dependant, for example taking the code here: https://github.com/mobz/get-timezone-offset. Open an issue!

## [BETA] Algolia

You can store cities information on a search engine like [Algolia](http://algolia.com/). There's a `yarn generate` command you can use if you clone this repository to create your own Algolia index. The expected environment variables are:

```
ALGOLIA_APPLICATION_ID=... ALGOLIA_ADMIN_API_KEY=... ALGOLIA_INDEX_NAME=... yarn build
```

Here's a demo of the index:

![Demo](./demo.gif)
