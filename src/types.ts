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
  /** Computes the current* fields at this date instead of now, like the date of a meeting */
  date?: Date;
}
