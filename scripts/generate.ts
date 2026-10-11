// Builds raw-time-zones.json, time-zones-names.json and src/tzdb-version.ts.
//
// Offsets, DST, abbreviations, aliases and the list of zones come from the
// official IANA tz database, compiled with the zic it ships with.
// Geonames is only used for city names, populations and country names.
// Node.js Intl (CLDR) is only used for English display names like "Pacific Time".

import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import abbreviations from "../abbreviations.json" with { type: "json" };
import { formatTimeZone } from "../src/format.ts";

const root = path.join(import.meta.dirname, "..");
// Set TZDB_WORK_DIR to reuse downloads between runs while developing.
const workDir = process.env.TZDB_WORK_DIR ?? mkdtempSync(path.join(tmpdir(), "tzdb-"));
mkdirSync(workDir, { recursive: true });

const IANA_DATA_FILES = [
  "africa",
  "antarctica",
  "asia",
  "australasia",
  "europe",
  "northamerica",
  "southamerica",
  "etcetera",
  "backward",
];

const continents: Record<string, string> = {
  AF: "Africa",
  AS: "Asia",
  EU: "Europe",
  NA: "North America",
  OC: "Oceania",
  SA: "South America",
  AN: "Antarctica",
};

// CLDR has no name for these zones, it only gives "GMT+03:00"
const alternativeNameCorrections: Record<string, string> = {
  "Antarctica/Palmer": "Chile Time",
  "America/Punta_Arenas": "Chile Time",
  "Africa/Casablanca": "Western European Time",
  "Africa/El_Aaiun": "Western European Time",
  "Asia/Urumqi": "China Time",
  "Pacific/Bougainville": "Bougainville Time",
};

// CLDR calls Apia "Samoa Standard Time", our table's name for American Samoa (SST, -11:00)
const abbreviationCorrections: Record<string, string> = {
  "Pacific/Apia": "WST",
};

const now = Math.floor(Date.now() / 1000);
const YEAR = 365 * 86400;

async function download(url: string, fileName: string): Promise<string> {
  const filePath = path.join(workDir, fileName);
  if (!existsSync(filePath)) {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`GET ${url} failed with ${response.status}`);
    }
    writeFileSync(filePath, Buffer.from(await response.arrayBuffer()));
  }
  return filePath;
}

function run(command: string, args: string[], cwd = workDir): string {
  return execFileSync(command, args, {
    cwd,
    encoding: "utf8",
    maxBuffer: 1024 * 1024 * 100,
  });
}

// --- IANA ------------------------------------------------------------------

async function compileIana() {
  const dataDir = path.join(workDir, "tzdb");
  const zoneinfoDir = path.join(workDir, "zoneinfo");
  mkdirSync(dataDir, { recursive: true });

  const archives = await Promise.all(
    ["data", "code"].map((kind) =>
      download(
        `https://data.iana.org/time-zones/tz${kind}-latest.tar.gz`,
        `tz${kind}-latest.tar.gz`,
      ),
    ),
  );
  const [version, codeVersion] = archives.map((archive) => {
    run("tar", ["-xzf", archive, "-C", dataDir]);
    return run("tar", ["-xzOf", archive, "version"]).trim();
  });
  if (!/^\d{4}[a-z]$/.test(version) || version !== codeVersion) {
    throw new Error(`Unexpected tzdata ${version} / tzcode ${codeVersion}`);
  }

  // The system zic can be too old for the latest data, so we build the one
  // that ships with the release. "-b fat" writes explicit transitions until
  // 2037 so we never have to evaluate POSIX TZ rules ourselves.
  run("make", ["-s", "zic"], dataDir);
  run(path.join(dataDir, "zic"), ["-b", "fat", "-d", zoneinfoDir, ...IANA_DATA_FILES], dataDir);

  const read = (file: string) => readFileSync(path.join(dataDir, file), "utf8");

  const zoneTab = read("zone.tab")
    .split("\n")
    .filter((line) => line !== "" && !line.startsWith("#"))
    .map((line) => {
      const [countryCode, , name] = line.split("\t");
      return { countryCode, name };
    });

  // Link name -> target. "#= TARGET" comments in "backward" hold the target
  // IANA would use if all parsers supported links to links, for example
  // "Link Africa/Abidjan Iceland #= Atlantic/Reykjavik".
  const links = new Map<string, string>();
  for (const file of IANA_DATA_FILES) {
    for (const line of read(file).split("\n")) {
      const match = /^Link\s+(\S+)\s+(\S+)(?:\s+#=\s*(\S+))?/.exec(line);
      if (match) {
        links.set(match[2], match[3] ?? match[1]);
      }
    }
  }

  return {
    version,
    zoneTab,
    links,
    hasZone: (name: string) => existsSync(path.join(zoneinfoDir, name)),
    readZone: (name: string) => parseTzif(readFileSync(path.join(zoneinfoDir, name))),
  };
}

type TimeType = { offset: number; isDst: boolean; abbreviation: string };
type Zone = {
  transitions: number[];
  types: TimeType[];
  typeIndexes: number[];
  // POSIX TZ string for times after the last transition, like "PST8PDT,M3.2.0,M11.1.0"
  footer: string;
};

// https://www.rfc-editor.org/rfc/rfc9636 (we only read the 64-bit block)
function parseTzif(buffer: Buffer): Zone {
  if (buffer.toString("latin1", 0, 4) !== "TZif" || buffer[4] < 0x32) {
    throw new Error("Expected a version 2+ TZif file");
  }
  const counts = (at: number) =>
    [0, 1, 2, 3, 4, 5].map((i) => buffer.readUInt32BE(at + 20 + i * 4));
  const [isUtCount, isStdCount, leapCount, timeCount, typeCount, charCount] = counts(0);
  const v1Size = timeCount * 5 + typeCount * 6 + charCount + leapCount * 8 + isStdCount + isUtCount;
  const header = 44 + v1Size;
  const [, , , timeCount2, typeCount2, charCount2] = counts(header);
  let cursor = header + 44;

  const transitions: number[] = [];
  for (let i = 0; i < timeCount2; i++) {
    transitions.push(Number(buffer.readBigInt64BE(cursor)));
    cursor += 8;
  }
  const typeIndexes = [...buffer.subarray(cursor, cursor + timeCount2)];
  cursor += timeCount2;
  const rawTypes = [];
  for (let i = 0; i < typeCount2; i++) {
    rawTypes.push({
      offset: buffer.readInt32BE(cursor) / 60,
      isDst: buffer[cursor + 4] === 1,
      abbreviationIndex: buffer[cursor + 5],
    });
    cursor += 6;
  }
  const chars = buffer.toString("latin1", cursor, cursor + charCount2);
  const types = rawTypes.map(({ offset, isDst, abbreviationIndex }) => ({
    offset,
    isDst,
    abbreviation: chars.slice(abbreviationIndex, chars.indexOf("\0", abbreviationIndex)),
  }));

  const footer = buffer.toString(
    "latin1",
    buffer.lastIndexOf(0x0a, buffer.length - 2) + 1,
    buffer.length - 1,
  );

  return { transitions, types, typeIndexes, footer };
}

// Time types in effect between `from` and `to`, in order, starting with the
// one in effect at `from`.
function timeTypesBetween(zone: Zone, from: number, to: number) {
  const { transitions, types, typeIndexes } = zone;
  let index = transitions.findLastIndex((time) => time <= from);
  const result = [{ time: from, ...types[index === -1 ? 0 : typeIndexes[index]] }];
  for (index += 1; index < transitions.length; index++) {
    if (transitions[index] > to) {
      return result;
    }
    result.push({ time: transitions[index], ...types[typeIndexes[index]] });
  }
  // "-b fat" writes transitions until 2037, after that DST rules only live
  // in the footer, which we do not evaluate
  if (zone.footer.includes(",")) {
    throw new Error(`Ran out of transitions, footer is ${zone.footer}`);
  }
  return result;
}

// --- Geonames --------------------------------------------------------------

async function readGeonames() {
  const countriesFile = await download(
    "https://download.geonames.org/export/dump/countryInfo.txt",
    "countryInfo.txt",
  );
  const countries = new Map<string, { name: string; continent: string }>();
  for (const line of readFileSync(countriesFile, "utf8").split("\n")) {
    if (line === "" || line.startsWith("#")) {
      continue;
    }
    const fields = line.split("\t");
    countries.set(fields[0], { name: fields[4], continent: fields[8] });
  }

  const citiesZip = await download(
    "https://download.geonames.org/export/dump/cities15000.zip",
    "cities15000.zip",
  );
  // https://download.geonames.org/export/dump/readme.txt
  const cities = run("unzip", ["-p", citiesZip, "cities15000.txt"])
    .split("\n")
    .filter((line) => line !== "")
    .map((line) => {
      const fields = line.split("\t");
      if (fields.length !== 19) {
        throw new Error(`Expected 19 fields in geonames record: ${line}`);
      }
      return {
        name: fields[1],
        featureCode: fields[7],
        countryCode: fields[8],
        population: Number(fields[14]),
        timeZone: fields[17],
      };
    })
    // Districts like Favoriten in Vienna, and historical, abandoned or
    // destroyed places. https://www.geonames.org/export/codes.html
    .filter(({ featureCode }) => !["PPLX", "PPLH", "PPLQ", "PPLW"].includes(featureCode));

  return { countries, cities };
}

// --- Display names (CLDR, through Node.js Intl) -------------------------------

function longName(timeZone: string, date: Date, style: "long" | "longGeneric") {
  return new Intl.DateTimeFormat("en-US", { timeZone, timeZoneName: style })
    .formatToParts(date)
    .find(({ type }) => type === "timeZoneName")!.value;
}

function intlOffset(timeZone: string, date: Date): number {
  const value = new Intl.DateTimeFormat("en-US", {
    timeZone,
    timeZoneName: "longOffset",
  })
    .formatToParts(date)
    .find(({ type }) => type === "timeZoneName")!.value;
  const match = /^GMT(?:([+-])(\d{2}):(\d{2}))?$/.exec(value)!;
  const minutes = Number(match[2] ?? 0) * 60 + Number(match[3] ?? 0);
  return match[1] === "-" ? -minutes : minutes;
}

const genericName = (name: string) => name.replace(/ (Standard|Daylight|Summer) Time$/, " Time");

const isGmtOffset = (name: string) => /^GMT([+-]\d{2}:\d{2})?$/.test(name);

function displayNames(timeZone: string) {
  const year = new Date().getUTCFullYear();
  const samples = [new Date(Date.UTC(year, 0, 15)), new Date(Date.UTC(year, 6, 15))].toSorted(
    (a, b) => intlOffset(timeZone, a) - intlOffset(timeZone, b),
  );
  const [standard, daylight] = samples.map((date) => longName(timeZone, date, "long"));
  return {
    standard,
    daylight,
    generic: longName(timeZone, samples[0], "longGeneric"),
  };
}

function alternativeName(timeZone: string, names: ReturnType<typeof displayNames>) {
  if (alternativeNameCorrections[timeZone]) {
    return alternativeNameCorrections[timeZone];
  }
  const standard = genericName(names.standard);
  if (isGmtOffset(standard)) {
    return isGmtOffset(names.generic) ? timeZone : names.generic;
  }
  // "Greenwich Mean Time" and "British Summer Time" have no common
  // generic form, CLDR then calls it "United Kingdom Time"
  if (genericName(names.daylight) !== standard) {
    return names.generic;
  }
  return standard;
}

function cldrAbbreviation(name: string): string | undefined {
  const table = abbreviations as Record<string, string>;
  return table[name] ?? table[name.replace(/ Time$/, " Standard Time")];
}

const isAlphabetic = (abbreviation: string) => /^[A-Z]+$/i.test(abbreviation);

// Same format as Intl's short time zone names: "GMT+3", "GMT-2:30"
function gmtAbbreviation(offsetInMinutes: number) {
  if (offsetInMinutes === 0) {
    return "GMT";
  }
  const absolute = Math.abs(offsetInMinutes);
  const minutes = absolute % 60;
  return `GMT${offsetInMinutes < 0 ? "-" : "+"}${Math.floor(absolute / 60)}${
    minutes ? `:${String(minutes).padStart(2, "0")}` : ""
  }`;
}

// --- Main --------------------------------------------------------------------

const iana = await compileIana();
const { countries, cities } = await readGeonames();

const zoneTabNames = new Set(iana.zoneTab.map(({ name }) => name));

function resolveLink(name: string): string {
  let target = name;
  while (iana.links.has(target)) {
    target = iana.links.get(target)!;
  }
  return target;
}

const signatures = new Map<string, string>();

// Equal signatures mean two zones showed the same time for the past year and
// will for the next two. The past year keeps apart zones that just changed
// their rules, like Edmonton and Regina, while browsers still have the old ones.
function signatureOf(name: string): string {
  if (!signatures.has(name)) {
    const types = timeTypesBetween(iana.readZone(name), now - YEAR, now + 2 * YEAR);
    const signature = types
      .filter(({ offset }, index) => index === 0 || offset !== types[index - 1].offset)
      .map(({ time, offset }) => `${time}:${offset}`)
      .join(",");
    signatures.set(name, signature);
  }
  return signatures.get(name)!;
}

const zones = iana.zoneTab.map(({ countryCode, name }) => {
  const nextYear = timeTypesBetween(iana.readZone(name), now, now + YEAR);
  const rawOffsetInMinutes = Math.min(...nextYear.map(({ offset }) => offset));

  const standardTypes = nextYear.filter(({ offset }) => offset === rawOffsetInMinutes);

  return {
    countryCode,
    name,
    rawOffsetInMinutes,
    // Vancouver is on PDT until it switches to permanent MST, both at -07:00
    standardType: standardTypes.find(({ isDst }) => !isDst) ?? standardTypes.at(-1)!,
    daylightType: nextYear.find(({ offset }) => offset > rawOffsetInMinutes),
    signature: signatureOf(name),
    cities: [] as { name: string; population: number }[],
  };
});

const zonesByCountryAndName = new Map(
  zones.map((zone) => [`${zone.countryCode}|${zone.name}`, zone]),
);

// Geonames sometimes uses another country's zone, like Asia/Bangkok for
// Hanoi. We then pick the zone of the city's country with the same clock.
function zoneOfCity(city: (typeof cities)[number]) {
  const exact = zonesByCountryAndName.get(`${city.countryCode}|${city.timeZone}`);
  if (exact || !iana.hasZone(city.timeZone)) {
    return exact;
  }
  const target = resolveLink(city.timeZone);
  const countryZones = zones.filter(({ countryCode }) => countryCode === city.countryCode);
  const sameZone = countryZones.filter(({ name }) => resolveLink(name) === target);
  if (sameZone.length === 1) {
    return sameZone[0];
  }
  const signature = signatureOf(city.timeZone);
  return countryZones.find((zone) => zone.signature === signature);
}

const unmatchedCities = [];
for (const city of cities) {
  const zone = zoneOfCity(city);
  if (zone === undefined) {
    unmatchedCities.push(`${city.name} (${city.countryCode} ${city.timeZone})`);
    continue;
  }
  zone.cities.push({ name: city.name, population: city.population });
}

if (unmatchedCities.length > 100) {
  throw new Error(
    `${unmatchedCities.length} cities did not match any time zone, ` +
      `geonames or IANA data probably changed: ${unmatchedCities.join(", ")}`,
  );
}

for (const zone of zones) {
  if (zone.cities.length === 0) {
    zone.cities.push({
      name: zone.name.split("/").pop()!.replace(/_/g, " "),
      population: 10000,
    });
  }
  zone.cities.sort((a, b) => b.population - a.population);
}

const groups = new Map<string, typeof zones>();
for (const zone of zones) {
  const key = `${zone.countryCode}|${zone.signature}`;
  groups.set(key, [...(groups.get(key) ?? []), zone]);
}

// Each time zone name belongs to exactly one group
const groupOfZone = new Map<string, string[]>();
for (const members of groups.values()) {
  const names = members.map(({ name }) => name).toSorted();
  for (const name of names) {
    groupOfZone.set(name, names);
  }
}

// A link joins the group of the zone.tab entry it points to
const unassignedLinks = [];
for (const link of [...iana.links.keys()].toSorted()) {
  if (zoneTabNames.has(link)) {
    continue;
  }
  let target = iana.links.get(link)!;
  while (!zoneTabNames.has(target) && iana.links.has(target)) {
    target = iana.links.get(target)!;
  }
  const names = groupOfZone.get(target);
  if (names === undefined) {
    unassignedLinks.push(link);
    continue;
  }
  names.push(link);
}

// Since 2026d these are zones following US rules, not links
const usRulesZones: Record<string, string> = {
  EST5EDT: "America/New_York",
  CST6CDT: "America/Chicago",
  MST7MDT: "America/Denver",
  PST8PDT: "America/Los_Angeles",
};
for (const [name, target] of Object.entries(usRulesZones)) {
  if (signatureOf(name) !== signatureOf(target)) {
    throw new Error(`${name} no longer follows the clock of ${target}`);
  }
  groupOfZone.get(target)!.push(name);
}

const rawTimeZones = [...groups.values()].map((members) => {
  const allCities = members
    .flatMap((zone) => zone.cities)
    .toSorted((a, b) => b.population - a.population);
  const main = members.find((zone) => zone.cities.includes(allCities[0]))!;
  const country = countries.get(main.countryCode);
  if (country === undefined || continents[country.continent] === undefined) {
    throw new Error(`Unknown country ${main.countryCode}`);
  }

  const names = displayNames(main.name);
  const name = alternativeName(main.name, names);
  const mainCities = allCities.slice(0, 4).map((city) => city.name);
  const { standardType, daylightType } = main;

  // IANA only keeps abbreviations in actual use, others look like "+03"
  const abbreviation = isAlphabetic(standardType.abbreviation)
    ? standardType.abbreviation
    : (abbreviationCorrections[main.name] ??
      cldrAbbreviation(names.standard) ??
      cldrAbbreviation(name) ??
      gmtAbbreviation(standardType.offset));
  const dstAbbreviation =
    daylightType &&
    (isAlphabetic(daylightType.abbreviation)
      ? daylightType.abbreviation
      : (names.daylight !== names.standard && cldrAbbreviation(names.daylight)) ||
        gmtAbbreviation(daylightType.offset));

  return {
    name: main.name,
    alternativeName: name,
    group: groupOfZone.get(main.name)!,
    continentCode: country.continent,
    continentName: continents[country.continent],
    countryName: country.name,
    countryCode: main.countryCode,
    mainCities,
    rawOffsetInMinutes: main.rawOffsetInMinutes,
    abbreviation,
    ...(dstAbbreviation && { dstAbbreviation }),
    rawFormat: formatTimeZone(main.rawOffsetInMinutes, name, mainCities),
  };
});

rawTimeZones.sort(
  (a, b) =>
    a.rawOffsetInMinutes - b.rawOffsetInMinutes ||
    a.alternativeName.localeCompare(b.alternativeName) ||
    a.mainCities[0].localeCompare(b.mainCities[0]),
);

const expectedUnassignedLinks = new Set([
  ...["GMT", "GMT+0", "GMT-0", "GMT0", "Greenwich"].flatMap((name) => [name, `Etc/${name}`]),
  ...["UCT", "UTC", "Universal", "Zulu"].flatMap((name) => [name, `Etc/${name}`]),
]);
const unexpectedLinks = unassignedLinks.filter((link) => !expectedUnassignedLinks.has(link));
if (unexpectedLinks.length > 0) {
  throw new Error(`Links without a time zone: ${unexpectedLinks.join(", ")}`);
}

writeFileSync(
  path.join(root, "raw-time-zones.json"),
  `${JSON.stringify(rawTimeZones).replace(/},/g, "},\n")}\n`,
);
writeFileSync(
  path.join(root, "time-zones-names.json"),
  `${JSON.stringify([...zoneTabNames].toSorted()).replace(/",/g, '",\n')}\n`,
);
writeFileSync(
  path.join(root, "src", "tzdb-version.ts"),
  `export const tzdbVersion = "${iana.version}";\n`,
);

// A few kB for getCountryCode(), so it does not pull in raw-time-zones.json
const countryNames = new Map<string, string[]>();
for (const { countryCode, group } of rawTimeZones) {
  countryNames.set(countryCode, [...(countryNames.get(countryCode) ?? []), ...group]);
}
writeFileSync(
  path.join(root, "src", "countries.ts"),
  [
    "// Country codes and their time zone names, generated by scripts/generate.ts",
    "export const countries: Record<string, string> = {",
    ...[...countryNames.keys()]
      .toSorted()
      .map((code) => `  ${code}: "${countryNames.get(code)!.toSorted().join(" ")}",`),
    "};",
    "",
  ].join("\n"),
);

console.log(
  `tzdb ${iana.version}: ${zones.length} zones in ${rawTimeZones.length} groups, ` +
    `${unmatchedCities.length} cities without a zone: ${unmatchedCities.join(", ")}`,
);
