# tzdb [![GitHub license](https://img.shields.io/github/license/vvo/tzdb?style=flat)](https://github.com/vvo/tzdb/blob/master/LICENSE) [![Tests](https://github.com/vvo/tzdb/workflows/CI/badge.svg)](https://github.com/vvo/tzdb/actions) [![npm version](https://badge.fury.io/js/%40vvo%2Ftzdb.svg)](https://www.npmjs.com/package/@vvo/tzdb)

This is a list and npm package of:

- "simplified" [IANA time zones](https://www.iana.org/time-zones) and their offset names
- all existing IANA time zones names
- and major cities (population > 5,000) with their associated time zones and offset names

The data and npm packages are **automatically updated** whenever there are changes to https://www.geonames.org/ which is generated from IANA databases.

This is useful whenever you want to build a time zone select menu in your application.

## Available data

### [simplified-time-zones.json](./simplified-time-zones.json)

This is most probably what you're looking for if you're trying to build a good current time zones selector in your application.

Example data:

```js
{"timeZoneName":"America/Los_Angeles","formatted":"-08:00 Pacific Time - Los Angeles"},
{"timeZoneName":"America/Tijuana","formatted":"-08:00 Pacific Time - Tijuana"},
{"timeZoneName":"America/Vancouver","formatted":"-08:00 Pacific Time - Vancouver"},
{"timeZoneName":"America/Whitehorse","formatted":"-08:00 Pacific Time - Whitehorse, Dawson"},
```

As you can see, we provide the time zone name and a pre-formatted version using more common offset names.

Notes:

- Grouping: when two different time zones names are in the same country, same offset and dst rules then we merge them and select the time zone name from the biggest city
- We provide two cities when grouping happens, ranked by population
- We provide offset names ("Pacific Time") without dst and remove "Standard" and "Daylight"
- This can be used to build a good enough (Google calendar like) select box of time zones, but it's your responsibility to handle dst and real offsets

### [cities-with-time-zones.json](./cities-with-time-zones.json)

This is a list of major cities (population > 5,000) and their associated time zone information, ranked by population. This is useful if you want to build an application where the user will type a city and you want the time zone information out of it.

Example data:

```js
{"geonameId":"5368361","name":"Los Angeles","countryName":"United States","timeZoneName":"America/Los_Angeles","timeZoneOffsetNameWithoutDst":"Pacific Time","population":3971883,"modificationDate":"2019-12-12"},
{"geonameId":"1205733","name":"Chittagong","countryName":"Bangladesh","timeZoneName":"Asia/Dhaka","timeZoneOffsetNameWithoutDst":"Bangladesh Time","population":3920222,"modificationDate":"2016-11-09"},
{"geonameId":"1804651","name":"Kunming","countryName":"China","timeZoneName":"Asia/Shanghai","timeZoneOffsetNameWithoutDst":"China Time","population":3855346,"modificationDate":"2014-08-14"},
{"geonameId":"361058","name":"Alexandria","countryName":"Egypt","timeZoneName":"Africa/Cairo","timeZoneOffsetNameWithoutDst":"Eastern European Time","population":3811516,"modificationDate":"2019-09-05"},
```

### [time-zones-names.json](./time-zones-names.json)

This is the raw list of all IANA time zones ranked by alphabetical order.

Example data:

```js
"America/La_Paz",
"America/Lima",
"America/Los_Angeles",
"America/Lower_Princes",
"America/Maceio",
"America/Managua",
"America/Manaus",
"America/Marigot",
"America/Martinique",
```

## NPM package

Installation:

```bash
npm add @vvo/tzdb
```

Usage:

```js
import cities from "@vvo/tzdb/cities-with-time-zones.json";
import simplifiedTimeZones from "@vvo/tzdb/simplified-time-zones.json";
import timeZones from "@vvo/tzdb/time-zones-names.json";
```

## Algolia

You can store cities information on a search engine like [Algolia](http://algolia.com/). There's a `yarn build` command you can use if you clone this repository to create your own Algolia index. The expected environment variables are:

```
ALGOLIA_APPLICATION_ID=... ALGOLIA_ADMIN_API_KEY=... ALGOLIA_INDEX_NAME=... yarn build
```

Here's a demo of the index:

![Demo](./demo.gif)
