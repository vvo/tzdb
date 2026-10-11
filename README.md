# tzdb [![GitHub license](https://img.shields.io/github/license/vvo/tzdb?style=flat)](https://github.com/vvo/tzdb/blob/main/LICENSE) [![npm version](https://badge.fury.io/js/%40vvo%2Ftzdb.svg)](https://www.npmjs.com/package/@vvo/tzdb) [![minizipped size](https://badgen.net/bundlephobia/minzip/@vvo/tzdb@latest)](https://bundlephobia.com/result?p=@vvo/tzdb@latest)

An always up to date list of time zones, made for time zone pickers:

- every [IANA time zone](https://www.iana.org/time-zones), grouped by country and clock, with major cities and a readable name like "Pacific Time"
- current offsets and abbreviations ("PDT" in summer, "PST" in winter)
- every current and deprecated IANA name, so any saved value finds its entry
- names translated in any language supported by the browser

```js
import { getTimeZones } from "@vvo/tzdb";

getTimeZones().map((timeZone) => timeZone.currentTimeFormat);
// [..., "-07:00 Pacific Time - Los Angeles, San Diego, San Jose, San Francisco", ...]
```

## How it stays up to date

A [GitHub workflow](.github/workflows/release.yml) runs every day. It compiles the latest
[IANA tz database](https://data.iana.org/time-zones/tzdb/) with its own `zic`, reads offsets and
abbreviations from the result, takes city populations from [GeoNames](https://www.geonames.org/),
tests the data and publishes a new version when anything changed. The current IANA release is
exported as `tzdbVersion`.

Current offsets do not depend on the package version at all: `getTimeZones()` asks the browser or
Node.js, whose own tz database updates with the browser or the operating system. A site that never
updates `@vvo/tzdb` still shows the right offset after a country drops daylight saving time. It also
matches the offsets the rest of the app gets from `Intl.DateTimeFormat`, Temporal or date
libraries.

## Install

```bash
npm add @vvo/tzdb
```

The package ships ESM and CommonJS builds with TypeScript types, and has no dependencies. Unused
exports are removed by bundlers. `getTimeZones` weighs about 16 kB gzipped, data included.

## Building a time zone picker

```jsx
import { getTimeZones } from "@vvo/tzdb";

const timeZones = getTimeZones();
const userTimeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;

// Saved values can be any IANA name, like "Asia/Calcutta" or "US/Pacific"
function findTimeZone(name) {
  return timeZones.find((timeZone) => timeZone.group.includes(name));
}

function TimeZonePicker({ value = userTimeZone, onChange }) {
  return (
    <select value={findTimeZone(value)?.name} onChange={(event) => onChange(event.target.value)}>
      {timeZones.map((timeZone) => (
        <option key={timeZone.name} value={timeZone.name}>
          {timeZone.currentTimeFormat}
        </option>
      ))}
    </select>
  );
}
```

Save `name` in your database: it is the IANA name of the most populated city of the group, and
works everywhere `Intl` and date libraries accept a time zone.

To search, filter on the fields people type:

```js
const query = "paris";
timeZones.filter((timeZone) =>
  [timeZone.currentTimeFormat, timeZone.countryName, timeZone.abbreviation, ...timeZone.group]
    .join(" ")
    .toLowerCase()
    .includes(query),
);
```

## API

```js
import { getTimeZones, rawTimeZones, timeZonesNames, abbreviations, tzdbVersion } from "@vvo/tzdb";
```

### getTimeZones(options)

Returns time zones sorted by current offset:

```js
[
  // ...
  {
    name: "America/Los_Angeles",
    alternativeName: "Pacific Time",
    group: ["America/Los_Angeles", "US/Pacific", "PST8PDT"],
    continentCode: "NA",
    continentName: "North America",
    countryName: "United States",
    countryCode: "US",
    mainCities: ["Los Angeles", "San Diego", "San Jose", "San Francisco"],
    rawOffsetInMinutes: -480,
    abbreviation: "PST",
    dstAbbreviation: "PDT", // only for zones with daylight saving time
    rawFormat: "-08:00 Pacific Time - Los Angeles, San Diego, San Jose, San Francisco",
    currentTimeOffsetInMinutes: -420,
    currentTimeFormat: "-07:00 Pacific Time - Los Angeles, San Diego, San Jose, San Francisco",
    currentAbbreviation: "PDT",
  },
  // ...
];
```

Options:

- `locale`: translates `alternativeName`, `countryName` and `continentName` with `Intl`, like
  `getTimeZones({ locale: "fr" })` for "-07:00 heure du Pacifique nord-américain - Los Angeles, ...".
  City names stay as they are.
- `includeUtc`: adds a time zone named `Etc/UTC`, whose group includes `UTC`.

Zones that the browser's tz database does not know yet are left out, since `Intl` could not format
dates in them. Runtimes without `Intl` time zone support, like some Android WebViews, get every zone
with its standard offset.

### rawTimeZones

The same list without the `current*` fields, sorted by standard offset.

### timeZonesNames

Every IANA time zone name from [zone.tab](https://data.iana.org/time-zones/tzdb/zone.tab), sorted.

### abbreviations

Long names mapped to abbreviations, like `"Central European Summer Time": "CEST"`. Abbreviations
are ambiguous: CST is Central Standard Time (-06:00), China Standard Time (+08:00) and Cuba
Standard Time (-05:00).

### tzdbVersion

The IANA tz database release the data comes from, like `"2026e"`.

## How time zones are grouped

Two IANA zones share an entry when they are in the same country and their clocks show the same time
for the next two years. Detroit and New York had different rules a century ago, so IANA keeps two
zones, but they share an entry today. `group` lists every name, including deprecated ones, that
shows this time.

`alternativeName` is the English name from [CLDR](https://cldr.unicode.org/) without "Standard",
"Daylight" or "Summer", so "Pacific Standard Time" becomes "Pacific Time". When the summer and winter
names differ, like "Greenwich Mean Time" and "British Summer Time", we use CLDR's generic name,
"United Kingdom Time". Several countries use the same name, like "Eastern Time" in Australia and
the United States: show `countryName` or `mainCities` next to it.

Abbreviations come from IANA. IANA only keeps abbreviations in actual use, like "PST" or "CET",
and writes others as numbers like "+03". For those, we take the abbreviation from `abbreviations` or
write "GMT+3".
