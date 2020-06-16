# tzdb [![GitHub license](https://img.shields.io/github/license/vvo/tzdb?style=flat)](https://github.com/vvo/tzdb/blob/master/LICENSE) [![Tests](https://github.com/vvo/tzdb/workflows/CI/badge.svg)](https://github.com/vvo/tzdb/actions) ![npm](https://img.shields.io/npm/v/tzdb)

This is a list and npm package of:

- all existing time zones names
- major cities (population > 15,000) and their associated time zones

The data and npm packages are automatically updated whenever there are changes on https://www.geonames.org/.

## Usage

You can either directly use the:

- [cities.json](./cities.json?raw=true)
- and [time-zones.json](./time-zones.json?raw=true)

Or use the `tzdb` npm package:

```js
import cities from "@vvo/tzdb/cities.json";
import timeZones from "@vvo/tzdb/time-zones.json";
```

## Algolia

You can also store it on a search engine like [Algolia](http://algolia.com/). There's a `yarn build` command you can use if you clone this repository to create your own Algolia index. The expected environment variables are:

```
ALGOLIA_APPLICATION_ID=... ALGOLIA_ADMIN_API_KEY=... ALGOLIA_INDEX_NAME=... yarn build
```

Here's a demo of the index:

![Demo](./demo.gif)
