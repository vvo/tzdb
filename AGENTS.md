# AGENTS.md

This package maintains itself. Keep it that way:

- `raw-time-zones.json`, `time-zones-names.json`, `src/tzdb-version.ts` and `src/countries.ts` come from `pnpm generate`. Never edit them by hand, fix `scripts/generate.ts` instead.
- `abbreviations.json` is edited by hand.
- The release workflow runs the tests on fresh data before publishing. Tests only assert facts that survive any country changing its time zone, otherwise one law change blocks every release.
- Releases happen through semantic-release and npm trusted publishing: `feat:` and `fix:` commits release, `chore:`, `ci:` and `docs:` do not. There is no npm token.
- semantic-release versions, tags, creates the GitHub release and packs a tarball, but does not publish. A separate `stage` job runs `npm stage publish` on that tarball, and the version goes live only after Vincent approves it with 2FA on npmjs.com (Staged Packages tab) or with `npm stage approve`. The trusted publisher only allows `npm stage publish`.
- The job holding `id-token: write` never installs dependencies. Every action is pinned to a commit SHA, and installs run with `--ignore-scripts`.
- The bundle targets ES2018, so `src/` avoids newer APIs like `Array#toSorted`.
- `pnpm lint` and `pnpm test` run every check CI runs.
