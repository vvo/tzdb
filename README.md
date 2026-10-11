# tzdb [![npm version](https://badge.fury.io/js/%40vvo%2Ftzdb.svg)](https://www.npmjs.com/package/@vvo/tzdb)

Time zones for building a time zone picker, always up to date.

```js
import { getTimeZones } from "@vvo/tzdb";

getTimeZones().map((timeZone) => timeZone.currentTimeFormat);
// [..., "-07:00 Pacific Time - Los Angeles, San Diego, San Jose, San Francisco", ...]
```

- Every [IANA time zone](https://www.iana.org/time-zones), grouped by country and clock, with major
  cities.
- Current offsets and abbreviations: PDT in summer, PST in winter.
- Every current and deprecated IANA name, so saved values always find their entry.
- Names in any language the browser supports.
- No dependencies, ESM and CommonJS, TypeScript types, 16 kB gzipped.

## Always up to date

Every day, a [GitHub workflow](.github/workflows/release.yml) compiles the latest
[IANA tz database](https://data.iana.org/time-zones/tzdb/), takes city populations from
[GeoNames](https://www.geonames.org/), tests the result and publishes a new version when something
changed.

Current offsets come from the browser or Node.js at runtime. A site that never updates this package
still follows daylight saving changes, and agrees with the offsets `Intl.DateTimeFormat` gives the
rest of the app.

## Time zone picker

```bash
npm add @vvo/tzdb
```

```jsx
import { getTimeZones } from "@vvo/tzdb";

const timeZones = getTimeZones();

// Saved values can be any IANA name, like "Asia/Calcutta" or "US/Pacific"
function findTimeZone(name) {
  return timeZones.find((timeZone) => timeZone.group.includes(name));
}

function TimeZonePicker({ value, onChange }) {
  const selected = findTimeZone(value ?? Intl.DateTimeFormat().resolvedOptions().timeZone);
  return (
    <select value={selected?.name} onChange={(event) => onChange(event.target.value)}>
      {timeZones.map((timeZone) => (
        <option key={timeZone.name} value={timeZone.name}>
          {timeZone.currentTimeFormat}
        </option>
      ))}
    </select>
  );
}
```

Save `name` in the database: every `Intl` API and date library accepts it.

To search, match the query against the fields people type:

```js
timeZones.filter((timeZone) =>
  [timeZone.currentTimeFormat, timeZone.countryName, timeZone.abbreviation, ...timeZone.group]
    .join(" ")
    .toLowerCase()
    .includes(query.toLowerCase()),
);
```

## API

```js
import { getTimeZones, rawTimeZones, timeZonesNames, abbreviations, tzdbVersion } from "@vvo/tzdb";
```

### getTimeZones(options)

Returns time zones sorted by current offset:

```js
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
}
```

Options:

- `locale`: translates `alternativeName`, `countryName` and `continentName`. With `"fr"`, Los Angeles
  shows as "-07:00 heure du Pacifique nord-américain - Los Angeles, ...". City names stay as they are.
- `includeUtc`: adds `Etc/UTC`, whose group includes `UTC` and `GMT`.
- `includeGmtOffsets`: adds the fixed offsets `Etc/GMT-14` to `Etc/GMT+12`. As in POSIX, the sign
  is inverted: `Etc/GMT+5` is 5 hours behind UTC.

Zones the browser does not know yet are left out, since `Intl` could not format dates in them.
Runtimes without `Intl` time zone support get every zone at its standard offset.

### rawTimeZones

The same list without the `current*` fields, sorted by standard offset.

### timeZonesNames

Every IANA time zone name from [zone.tab](https://data.iana.org/time-zones/tzdb/zone.tab).

### abbreviations

Long names mapped to abbreviations, like `"Central European Summer Time": "CEST"`. Careful, CST
means Central Standard Time (-06:00), China Standard Time (+08:00) and Cuba Standard Time (-05:00).

### tzdbVersion

The IANA tz database release behind the data, like `"2026e"`.

## How time zones are grouped

Zones share an entry when they are in the same country and their clocks show the same time for the
next two years. Detroit and New York had different rules a century ago, so IANA keeps both, but
they share an entry today.

`alternativeName` is the English name from [CLDR](https://cldr.unicode.org/) without "Standard",
"Daylight" or "Summer". When summer and winter names differ, like "Greenwich Mean Time" and "British
Summer Time", it is CLDR's generic name, "United Kingdom Time". Several countries share names like
"Eastern Time", so show `countryName` or `mainCities` next to it.

Abbreviations come from IANA. When IANA has none, like "+03", they come from `abbreviations` or
read "GMT+3".
