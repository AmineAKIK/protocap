# CI security controls

ProtoCap keeps CI security proportional to its role as a public technical demonstrator. The goal is reviewable, reproducible controls without implying enterprise compliance.

## Controls

- GitHub Actions dependencies are pinned to immutable commit SHAs; human-readable major-version comments remain beside the pins.
- The Quality Gate runs with read-only repository contents permission.
- CodeQL analyzes JavaScript/TypeScript on pull requests, pushes to `main`, and a weekly schedule. Its only write permission is `security-events: write`, required to publish code-scanning results.
- `npm run audit:prod` audits production dependencies only and is part of the Quality Gate.
- Browser-facing source files are regression-tested to ensure they never reference server-side secret identifiers.
- Generated output (`dist`, `coverage`, Playwright output) must remain untracked.

## Branch rules

The active `main` ruleset requires pull requests, thread resolution, the `Quality gate` status, squash-only merges, linear history, and blocks deletion/non-fast-forward updates. The repository intentionally does not require a separate approving reviewer because it is currently maintained as a solo demonstrator; adding a nominal approval requirement would not add meaningful assurance.

CodeQL is kept as an independent security workflow rather than folded into the main quality job. This separates static security analysis from normal build/test failures and keeps its elevated `security-events: write` permission out of the general-purpose CI workflow.
