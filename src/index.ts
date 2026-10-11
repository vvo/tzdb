import abbreviationsData from "../abbreviations.json" with { type: "json" };
import rawTimeZonesData from "../raw-time-zones.json" with { type: "json" };
import timeZonesNamesData from "../time-zones-names.json" with { type: "json" };
import { formatOffset, formatTimeZone } from "./format.ts";
import { tzdbVersion as version } from "./tzdb-version.ts";

export type TimeZoneName = string;

export interface RawTimeZone {
  /** IANA name of the most populated zone of the group, like "America/Los_Angeles" */
  name: TimeZoneName;
  /** English generic name, like "Pacific Time" */
  alternativeName: string;
  /** Every IANA name, current or deprecated, that shows this exact time */
  group: TimeZoneName[];
  continentCode: string;
  continentName: string;
  countryName: string;
  countryCode: string;
  /** Up to four cities, most populated first */
  mainCities: string[];
  /** UTC offset outside of daylight saving time */
  rawOffsetInMinutes: number;
  /** Abbreviation outside of daylight saving time, like "PST" */
  abbreviation: string;
  /** Abbreviation during daylight saving time, like "PDT". Only for zones that observe it */
  dstAbbreviation?: string;
  rawFormat: string;
}

export interface TimeZone extends RawTimeZone {
  /** UTC offset right now, according to the tz database of the browser or Node.js */
  currentTimeOffsetInMinutes: number;
  currentTimeFormat: string;
  /** "PDT" or "PST" depending on the current date */
  currentAbbreviation: string;
}

export interface TimeZoneOptions {
  /** Adds an "Etc/UTC" time zone, whose group includes "UTC" and "GMT" */
  includeUtc?: boolean;
  /**
   * Adds the fixed offset time zones from "Etc/GMT-14" to "Etc/GMT+12".
   * Their sign is inverted: "Etc/GMT+5" is 5 hours behind UTC.
   */
  includeGmtOffsets?: boolean;
  /**
   * Translates alternativeName, countryName and continentName with the Intl
   * API, like "fr" or "es-MX". City names are not translated.
   */
  locale?: string;
}

export const rawTimeZones: RawTimeZone[] = rawTimeZonesData;
export const timeZonesNames: TimeZoneName[] = timeZonesNamesData;
export const abbreviations: Record<string, string> = abbreviationsData;
/** Release of the IANA tz database used to build the data, like "2026e" */
export const tzdbVersion: string = version;

const offsetFormats = new Map<string, Intl.DateTimeFormat | null>();

// Returns undefined when the runtime does not know the time zone
function getOffset(timeZone: string, date: Date): number | undefined {
  let format = offsetFormats.get(timeZone);
  if (format === undefined) {
    try {
      format = new Intl.DateTimeFormat("en-US", {
        timeZone,
        hourCycle: "h23",
        year: "numeric",
        month: "numeric",
        day: "numeric",
        hour: "numeric",
        minute: "numeric",
        second: "numeric",
      });
    } catch {
      format = null;
    }
    // Very old runtimes ignore the timeZone option instead of throwing
    if (format?.resolvedOptions().timeZone === undefined) {
      format = null;
    }
    offsetFormats.set(timeZone, format);
  }
  if (format === null) {
    return undefined;
  }

  const parts: Record<string, number> = {};
  for (const { type, value } of format.formatToParts(date)) {
    parts[type] = Number(value);
  }
  const wallClock = Date.UTC(
    parts.year,
    parts.month - 1,
    parts.day,
    parts.hour % 24,
    parts.minute,
    parts.second,
  );
  return Math.round((wallClock - date.getTime()) / 60000);
}

// UN M49 codes understood by Intl.DisplayNames
const continentRegions: Record<string, string> = {
  AF: "002",
  AN: "AQ",
  AS: "142",
  EU: "150",
  NA: "003",
  OC: "009",
  SA: "005",
};

function translator(locale: string, date: Date) {
  let regions: Intl.DisplayNames | undefined;
  try {
    regions = new Intl.DisplayNames(locale, { type: "region" });
  } catch {
    // Intl.DisplayNames is missing in old runtimes
  }

  return {
    timeZone(timeZone: string, fallback: string): string {
      try {
        const parts = new Intl.DateTimeFormat(locale, {
          timeZone,
          timeZoneName: "longGeneric",
        }).formatToParts(date);
        for (const { type, value } of parts) {
          if (type === "timeZoneName") {
            return value;
          }
        }
      } catch {
        // "longGeneric" or this time zone is not supported
      }
      return fallback;
    },
    region(code: string, fallback: string): string {
      return (code && regions?.of(code)) || fallback;
    },
  };
}

/**
 * Time zones grouped by country and clock, sorted by current offset. The
 * current offset comes from the runtime's own tz database, which browsers
 * and operating systems keep up to date.
 */
export function getTimeZones(options: TimeZoneOptions = {}): TimeZone[] {
  const { includeUtc = false, includeGmtOffsets = false, locale } = options;
  const now = new Date();
  const translate = locale ? translator(locale, now) : undefined;

  const offsets = rawTimeZones.map(({ name }) => getOffset(name, now));
  // Runtimes without Intl time zone support get the standard offsets
  const hasIntl = offsets.some((offset) => offset !== undefined);

  const timeZones: TimeZone[] = [];
  rawTimeZones.forEach((rawTimeZone, index) => {
    let offset = offsets[index];
    if (offset === undefined) {
      // A zone newer than the runtime's tz database cannot be used with
      // Intl anyway, so we hide it
      if (hasIntl) {
        return;
      }
      offset = rawTimeZone.rawOffsetInMinutes;
    }

    const timeZone = { ...rawTimeZone };
    if (translate) {
      timeZone.alternativeName = translate.timeZone(
        timeZone.name,
        timeZone.alternativeName,
      );
      timeZone.countryName = translate.region(
        timeZone.countryCode,
        timeZone.countryName,
      );
      timeZone.continentName = translate.region(
        continentRegions[timeZone.continentCode],
        timeZone.continentName,
      );
      timeZone.rawFormat = formatTimeZone(
        timeZone.rawOffsetInMinutes,
        timeZone.alternativeName,
        timeZone.mainCities,
      );
    }

    timeZones.push({
      ...timeZone,
      currentTimeOffsetInMinutes: offset,
      currentTimeFormat: formatTimeZone(
        offset,
        timeZone.alternativeName,
        timeZone.mainCities,
      ),
      currentAbbreviation:
        offset > timeZone.rawOffsetInMinutes && timeZone.dstAbbreviation
          ? timeZone.dstAbbreviation
          : timeZone.abbreviation,
    });
  });

  const fixed = (
    name: string,
    group: TimeZoneName[],
    offset: number,
    alternativeName: string,
    abbreviation: string,
  ) => {
    const format = `${formatOffset(offset)} ${alternativeName}`;
    timeZones.push({
      name,
      alternativeName,
      group,
      continentCode: "",
      continentName: "",
      countryName: "",
      countryCode: "",
      mainCities: [""],
      rawOffsetInMinutes: offset,
      abbreviation,
      rawFormat: format,
      currentTimeOffsetInMinutes: offset,
      currentTimeFormat: format,
      currentAbbreviation: abbreviation,
    });
  };

  if (includeUtc) {
    const name = translate
      ? `${translate.timeZone("UTC", "Coordinated Universal Time")} (UTC)`
      : "Coordinated Universal Time (UTC)";
    const group = [
      "Etc/UTC",
      "Etc/UCT",
      "Etc/Universal",
      "Etc/Zulu",
      "UCT",
      "UTC",
      "Universal",
      "Zulu",
      "Etc/GMT",
      "Etc/GMT+0",
      "Etc/GMT-0",
      "Etc/GMT0",
      "Etc/Greenwich",
      "GMT",
      "GMT+0",
      "GMT-0",
      "GMT0",
      "Greenwich",
    ];
    fixed("Etc/UTC", group, 0, name, "UTC");
  }

  if (includeGmtOffsets) {
    for (let hours = -12; hours <= 14; hours++) {
      if (hours !== 0) {
        const sign = hours > 0 ? "+" : "-";
        const name = `Etc/GMT${hours > 0 ? "-" : "+"}${Math.abs(hours)}`;
        const fallback = `GMT${formatOffset(hours * 60)}`;
        fixed(
          name,
          [name],
          hours * 60,
          translate ? translate.timeZone(name, fallback) : fallback,
          `GMT${sign}${Math.abs(hours)}`,
        );
      }
    }
  }

  return timeZones.sort(
    (a, b) =>
      a.currentTimeOffsetInMinutes - b.currentTimeOffsetInMinutes ||
      a.alternativeName.localeCompare(b.alternativeName, locale) ||
      a.mainCities[0].localeCompare(b.mainCities[0], locale),
  );
}
