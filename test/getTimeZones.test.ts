import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import test from "node:test";

import * as esm from "@vvo/tzdb";

const cjs: typeof esm = createRequire(import.meta.url)("@vvo/tzdb");

test("both builds expose raw-time-zones.json as rawTimeZones", () => {
  const json = JSON.parse(readFileSync("raw-time-zones.json", "utf8"));
  assert.deepEqual(esm.rawTimeZones, json);
  assert.deepEqual(cjs.rawTimeZones, json);
});

test("current offsets and abbreviations follow daylight saving time", (t) => {
  const at = (date: string, name: string) => {
    t.mock.timers.enable({ apis: ["Date"], now: new Date(date) });
    const timeZones = esm.getTimeZones();
    t.mock.timers.reset();
    const offsets = timeZones.map((tz) => tz.currentTimeOffsetInMinutes);
    assert.deepEqual(
      offsets,
      [...offsets].sort((a, b) => a - b),
    );
    const timeZone = timeZones.find((tz) => tz.name === name)!;
    return [
      timeZone.currentTimeOffsetInMinutes,
      timeZone.currentAbbreviation,
      timeZone.currentTimeFormat.slice(0, 6),
    ];
  };

  assert.deepEqual(at("2026-01-15T12:00Z", "America/New_York"), [
    -300,
    "EST",
    "-05:00",
  ]);
  assert.deepEqual(at("2026-07-15T12:00Z", "America/New_York"), [
    -240,
    "EDT",
    "-04:00",
  ]);
  assert.deepEqual(at("2026-07-15T12:00Z", "Europe/London"), [
    60,
    "BST",
    "+01:00",
  ]);
  assert.deepEqual(at("2026-01-15T12:00Z", "Australia/Sydney"), [
    660,
    "AEDT",
    "+11:00",
  ]);
});

test("runtimes without Intl time zone support get standard offsets", async (t) => {
  t.mock.method(Intl, "DateTimeFormat", () => {
    throw new RangeError("Unsupported time zone");
  });
  // A new module instance, so no Intl.DateTimeFormat is cached yet
  const { getTimeZones, rawTimeZones } = (await import(
    `${import.meta.resolve("@vvo/tzdb")}?without-intl`
  )) as typeof esm;

  const timeZones = getTimeZones();
  assert.equal(timeZones.length, rawTimeZones.length);
  for (const timeZone of timeZones) {
    assert.equal(
      timeZone.currentTimeOffsetInMinutes,
      timeZone.rawOffsetInMinutes,
    );
  }
});

test("locale translates time zone, country and continent names", () => {
  const berlin = esm
    .getTimeZones({ locale: "de" })
    .find(({ name }) => name === "Europe/Berlin")!;

  assert.equal(berlin.countryName, "Deutschland");
  assert.equal(berlin.continentName, "Europa");
  assert.notEqual(berlin.alternativeName, "Central European Time");
  assert.ok(berlin.currentTimeFormat.includes(berlin.alternativeName));
  assert.ok(berlin.rawFormat.includes(berlin.alternativeName));
});
