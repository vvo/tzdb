# tzdb [![GitHub license](https://img.shields.io/github/license/vvo/tzdb?style=flat)](https://github.com/vvo/tzdb/blob/master/LICENSE) [![Tests](https://github.com/vvo/tzdb/workflows/CI/badge.svg)](https://github.com/vvo/tzdb/actions) [![npm version](https://badge.fury.io/js/%40vvo%2Ftzdb.svg)](https://www.npmjs.com/package/@vvo/tzdb)

_🕰 Simplified, grouped and always up to date list of time zones, with major cities_

This is a list and npm package of:

- "simplified" [IANA time zones](https://www.iana.org/time-zones) with their alternative names like `Pacific Time` instead of `America/Los_Angeles`, along with major cities for each time zone.
- all existing raw IANA time zones names

The data and npm packages are **automatically updated** whenever there are changes to https://www.geonames.org/ which is generated from IANA databases.

This is useful whenever you want to build a time zone select menu in your application.

## Available data

### [simplified-time-zones.json](./simplified-time-zones.json)

This is most probably what you're looking for if you're trying to build a good current time zones selector in your application.

Example data:

```js
[
  // ...
  {
    name: "America/Anchorage",
    alternativeName: "Alaska Time",
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
    mainCities: ["Gambier"],
    formatted: "-09:00 Gambier Time - Gambier",
    group: ["Pacific/Gambier"],
  },
  {
    name: "America/Los_Angeles",
    alternativeName: "Pacific Time",
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
- This can be used to build a good enough (Google calendar like) select box of time zones, but it's your responsibility to handle dst and real offsets

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
import timeZones from "@vvo/tzdb/time-zones-names.json";
import simplifiedTimeZones from "@vvo/tzdb/simplified-time-zones.json";
```

## [BETA] Algolia

You can store cities information on a search engine like [Algolia](http://algolia.com/). There's a `yarn build` command you can use if you clone this repository to create your own Algolia index. The expected environment variables are:

```
ALGOLIA_APPLICATION_ID=... ALGOLIA_ADMIN_API_KEY=... ALGOLIA_INDEX_NAME=... yarn build
```

Here's a demo of the index:

![Demo](./demo.gif)
