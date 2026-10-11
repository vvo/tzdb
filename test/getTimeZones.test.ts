import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import test from "node:test";

import * as esm from "@vvo/tzdb";

const cjs: typeof esm = createRequire(import.meta.url)("@vvo/tzdb");

function getTimeZonesAt(date: string) {
  const timeZones = esm.getTimeZones({ date: new Date(date) });
  return new Map(timeZones.map((timeZone) => [timeZone.name, timeZone]));
}

// Offsets from Intl, as an oracle independent from our data
function intlOffset(timeZone: string): number {
  const value = new Intl.DateTimeFormat("en-US", {
    timeZone,
    timeZoneName: "longOffset",
  })
    .formatToParts()
    .find(({ type }) => type === "timeZoneName")!.value;
  const [, sign, hours = "0", minutes = "0"] = /^GMT(?:([+-])(\d{2}):(\d{2}))?$/.exec(value)!;
  return (sign === "-" ? -1 : 1) * (Number(hours) * 60 + Number(minutes));
}

test("both builds expose raw-time-zones.json as rawTimeZones", () => {
  const json = JSON.parse(readFileSync("raw-time-zones.json", "utf8"));
  assert.deepEqual(esm.rawTimeZones, json);
  assert.deepEqual(cjs.rawTimeZones, json);
});

test("current offsets and abbreviations follow daylight saving time", () => {
  const january = getTimeZonesAt("2026-01-15T12:00Z");
  const july = getTimeZonesAt("2026-07-15T12:00Z");

  const offsets = [...july.values()].map((tz) => tz.currentTimeOffsetInMinutes);
  assert.deepEqual(
    offsets,
    offsets.toSorted((a, b) => a - b),
  );

  let checked = 0;
  for (const { name, rawOffsetInMinutes, abbreviation, dstAbbreviation } of esm.rawTimeZones) {
    const [winter, summer] = [january.get(name)!, july.get(name)!].toSorted(
      (a, b) => a.currentTimeOffsetInMinutes - b.currentTimeOffsetInMinutes,
    );
    // Skip zones whose rules changed since 2026
    if (
      !dstAbbreviation ||
      winter.currentTimeOffsetInMinutes !== rawOffsetInMinutes ||
      summer.currentTimeOffsetInMinutes === rawOffsetInMinutes
    ) {
      continue;
    }
    assert.equal(winter.currentAbbreviation, abbreviation, name);
    assert.equal(summer.currentAbbreviation, dstAbbreviation, name);
    assert.equal(winter.currentTimeFormat, winter.rawFormat, name);
    assert.notEqual(summer.currentTimeFormat, summer.rawFormat, name);
    checked++;
  }
  assert.ok(checked > 30, `only ${checked} zones checked`);
});

test("Etc/GMT offsets are inverted like in POSIX", () => {
  const offsets = esm
    .getTimeZones({ includeGmtOffsets: true })
    .filter(({ name }) => name.startsWith("Etc/GMT"));

  assert.equal(offsets.length, 26);
  for (const { name, currentTimeOffsetInMinutes } of offsets) {
    assert.equal(currentTimeOffsetInMinutes, intlOffset(name), name);
  }
});

test("runtimes without Intl time zone support get standard offsets", async (t) => {
  t.mock.method(Intl, "DateTimeFormat", () => {
    throw new RangeError("Unsupported time zone");
  });
  // A new module instance, so no Intl.DateTimeFormat is cached yet
  const fresh: typeof esm = await import(`${import.meta.resolve("@vvo/tzdb")}?without-intl`);
  const { getTimeZones, rawTimeZones } = fresh;

  const timeZones = getTimeZones();
  assert.equal(timeZones.length, rawTimeZones.length);
  for (const timeZone of timeZones) {
    assert.equal(timeZone.currentTimeOffsetInMinutes, timeZone.rawOffsetInMinutes);
  }
});

test("locale translates time zone, country and continent names", () => {
  const berlin = esm.getTimeZones({ locale: "de" }).find(({ name }) => name === "Europe/Berlin")!;

  assert.equal(berlin.countryName, "Deutschland");
  assert.equal(berlin.continentName, "Europa");
  assert.notEqual(berlin.alternativeName, "Central European Time");
  assert.ok(berlin.currentTimeFormat.includes(berlin.alternativeName));
  assert.ok(berlin.rawFormat.includes(berlin.alternativeName));
});
