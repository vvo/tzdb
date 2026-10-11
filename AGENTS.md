# AGENTS.md

This package maintains itself. Keep it that way:

- `raw-time-zones.json`, `time-zones-names.json` and `src/tzdb-version.ts` come from `pnpm generate`. Never edit them by hand, fix `scripts/generate.ts` instead.
- `abbreviations.json` is edited by hand.
- The release workflow runs the tests on fresh data before publishing. Tests only assert facts that survive any country changing its time zone, otherwise one law change blocks every release.
- Releases happen through semantic-release and npm trusted publishing: `feat:` and `fix:` commits publish, `chore:` and `docs:` do not. There is no npm token.
- The bundle targets ES2018, so `src/` avoids newer APIs like `Array#toSorted`.
- `pnpm lint` and `pnpm test` run every check CI runs.
