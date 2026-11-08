# AGENTS.md

This package maintains itself. Keep it that way:

- `raw-time-zones.json`, `time-zones-names.json`, `src/tzdb-version.ts` and `src/countries.ts` come from `pnpm generate`. Never edit them by hand, fix `scripts/generate.ts` instead.
- `abbreviations.json` is edited by hand.
- The release workflow runs the tests on fresh data before publishing. Tests only assert facts that survive any country changing its time zone, otherwise one law change blocks every release.
- Releases happen through semantic-release and npm trusted publishing: `feat:` and `fix:` commits release, `chore:`, `ci:` and `docs:` do not. There is no npm token.
- semantic-release versions, tags, creates the GitHub release and packs a tarball, but does not publish. A separate `publish` job compares the new tag with the version live on npm. When only the four generated data files changed, it runs `npm publish`. Otherwise it runs `npm stage publish` and opens an issue: the version goes live only after Vincent approves it with 2FA on npmjs.com (Staged Packages) or with `npm stage approve`.
- Dependency updates come from Dependabot as pull requests, with a 7-day cooldown. Never push code or dependency changes to main from CI: that would bypass the approval step.
- The job holding `id-token: write` never installs dependencies. Every action is pinned to a commit SHA, and installs run with `--ignore-scripts`.
- The bundle targets ES2018, so `src/` avoids newer APIs like `Array#toSorted`.
- `pnpm lint` and `pnpm test` run every check CI runs.
