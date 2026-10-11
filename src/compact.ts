// The build replaces raw-time-zones.json with this compact form, a third
// smaller once gzipped. Derived fields like rawFormat are rebuilt on load.

import { formatTimeZone } from "./format.ts";
import type { RawTimeZone } from "./types.ts";

type Row = [
  name: string,
  alternativeName: string,
  group: string,
  continentCode: string,
  countryCode: string,
  mainCities: string,
  rawOffsetInMinutes: number,
  abbreviation: string,
  dstAbbreviation?: string,
];

export type CompactTimeZones = {
  continents: Record<string, string>;
  countries: Record<string, string>;
  rows: Row[];
};

export function compactTimeZones(rawTimeZones: RawTimeZone[]): CompactTimeZones {
  const continents: Record<string, string> = {};
  const countries: Record<string, string> = {};
  const rows = rawTimeZones.map((timeZone): Row => {
    if (
      timeZone.group.some((name) => name.includes(" ")) ||
      timeZone.mainCities.some((city) => city.includes("|"))
    ) {
      throw new Error(`Cannot compact ${timeZone.name}`);
    }
    continents[timeZone.continentCode] = timeZone.continentName;
    countries[timeZone.countryCode] = timeZone.countryName;
    const row: Row = [
      timeZone.name,
      timeZone.alternativeName,
      timeZone.group.join(" "),
      timeZone.continentCode,
      timeZone.countryCode,
      timeZone.mainCities.join("|"),
      timeZone.rawOffsetInMinutes,
      timeZone.abbreviation,
    ];
    if (timeZone.dstAbbreviation) {
      row.push(timeZone.dstAbbreviation);
    }
    return row;
  });
  return { continents, countries, rows };
}

export function expandTimeZones({ continents, countries, rows }: CompactTimeZones): RawTimeZone[] {
  return rows.map(
    ([
      name,
      alternativeName,
      group,
      continentCode,
      countryCode,
      cities,
      rawOffsetInMinutes,
      abbreviation,
      dstAbbreviation,
    ]) => {
      const mainCities = cities.split("|");
      return {
        name,
        alternativeName,
        group: group.split(" "),
        continentCode,
        continentName: continents[continentCode],
        countryName: countries[countryCode],
        countryCode,
        mainCities,
        rawOffsetInMinutes,
        abbreviation,
        ...(dstAbbreviation && { dstAbbreviation }),
        rawFormat: formatTimeZone(rawOffsetInMinutes, alternativeName, mainCities),
      };
    },
  );
}
