// The release workflow runs these on freshly generated data before
// committing and publishing it.

import assert from "node:assert/strict";
import test from "node:test";

import { rawTimeZones, timeZonesNames, tzdbVersion } from "@vvo/tzdb";

test("every time zone name belongs to exactly one group", () => {
  const groupOf = new Map<string, string>();
  for (const { name, group } of rawTimeZones) {
    assert.ok(group.includes(name), `${name} is missing from its own group`);
    for (const member of group) {
      assert.equal(
        groupOf.get(member),
        undefined,
        `${member} is in two groups`,
      );
      groupOf.set(member, name);
    }
  }
  for (const name of timeZonesNames) {
    assert.ok(groupOf.has(name), `${name} is in no group`);
  }
  // Names stored from Intl.DateTimeFormat().resolvedOptions().timeZone
  for (const name of Intl.supportedValuesOf("timeZone")) {
    assert.ok(groupOf.has(name), `${name} from Intl is in no group`);
  }
});

test("offsets and abbreviations come from the IANA tz database", () => {
  assert.match(tzdbVersion, /^\d{4}[a-z]$/);

  const zone = (name: string) => {
    const timeZone = rawTimeZones.find((timeZone) => timeZone.name === name);
    assert.ok(timeZone, `${name} is not a main time zone`);
    const { rawOffsetInMinutes, abbreviation, dstAbbreviation } = timeZone;
    return { rawOffsetInMinutes, abbreviation, dstAbbreviation };
  };

  // Geonames still had Namibia at +01:00 years after it moved to +02:00
  assert.deepEqual(zone("Africa/Windhoek"), {
    rawOffsetInMinutes: 120,
    abbreviation: "CAT",
    dstAbbreviation: undefined,
  });
  assert.deepEqual(zone("Asia/Kolkata"), {
    rawOffsetInMinutes: 330,
    abbreviation: "IST",
    dstAbbreviation: undefined,
  });
  assert.deepEqual(zone("America/New_York"), {
    rawOffsetInMinutes: -300,
    abbreviation: "EST",
    dstAbbreviation: "EDT",
  });
  // Ireland's winter time is a negative DST in IANA's main data format
  assert.deepEqual(zone("Europe/Dublin"), {
    rawOffsetInMinutes: 0,
    abbreviation: "GMT",
    dstAbbreviation: "IST",
  });
});
