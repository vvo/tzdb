type TimeZoneName = string;

interface RawTimeZone {
  name: TimeZoneName;
  alternativeName: string;
  group: string[];
  countryName: string;
  continentCode: string;
  continentName: string;
  countryCode: string;
  mainCities: string[];
  rawOffsetInMinutes: number;
  rawFormat: string;
}

interface TimeZone extends RawTimeZone {
  currentTimeOffsetInMinutes: number;
  currentTimeFormat: string;
}

export type rawTimeZones = RawTimeZone[];
export type timeZonesNames = TimeZoneName[];
export function getTimeZones(): TimeZone[];
