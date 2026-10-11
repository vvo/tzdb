// The release workflow runs these on freshly generated data before
// committing and publishing it, so they only assert facts that hold
// whatever governments decide next.

import assert from "node:assert/strict";
import test from "node:test";

import { getCountryCode, rawTimeZones, timeZonesNames, tzdbVersion } from "@vvo/tzdb";

test("every time zone name belongs to exactly one group", () => {
  const groupOf = new Map<string, string>();
  for (const { name, group } of rawTimeZones) {
    assert.ok(group.includes(name), `${name} is missing from its own group`);
    for (const member of group) {
      assert.equal(groupOf.get(member), undefined, `${member} is in two groups`);
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

  // Geonames still had Namibia at +01:00 years after it moved to +02:00
  const windhoek = rawTimeZones.find(({ name }) => name === "Africa/Windhoek");
  assert.equal(windhoek?.rawOffsetInMinutes, 120);

  const kolkata = rawTimeZones.find(({ name }) => name === "Asia/Kolkata");
  assert.equal(kolkata?.rawOffsetInMinutes, 330);
  assert.equal(kolkata?.abbreviation, "IST");

  const withDst = rawTimeZones.filter(({ dstAbbreviation }) => dstAbbreviation);
  assert.ok(withDst.length > 50, `only ${withDst.length} zones observe DST`);
});

test("getCountryCode knows the country of every time zone name", () => {
  for (const { countryCode, group } of rawTimeZones) {
    for (const name of group) {
      assert.equal(getCountryCode(name), countryCode, name);
    }
  }
  assert.equal(getCountryCode("Asia/Calcutta"), "IN");
  assert.equal(getCountryCode("UTC"), undefined);
});
