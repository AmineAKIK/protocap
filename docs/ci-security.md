# CI security controls

ProtoCap keeps CI security proportional to its role as a public technical demonstrator. The goal is reviewable, reproducible controls without implying enterprise compliance.

## Controls

- GitHub Actions dependencies are pinned to immutable commit SHAs; human-readable major-version comments remain beside the pins.
- The Quality Gate runs with read-only repository contents permission.
- CodeQL analyzes JavaScript/TypeScript on pull requests, pushes to `main`, and a weekly schedule. Its only write permission is `security-events: write`, required to publish code-scanning results.
- `npm run audit:full` includes development dependencies explicitly and blocks low, moderate, high and critical findings. `npm run audit:prod` separately applies the same severity floor to the production graph.
- Both audit commands use npm directly: registry failures remain failures, not empty successful reports. Loopback registry-failure tests exercise both scripts without calling an external service.
- `npm ci` must leave the reviewed manifests unchanged. Installed Vitest packages must match the lockfile and the patched stable Vitest 4 floor; a future major needs a separate review.
- Browser-facing source files are regression-tested to ensure they never reference server-side secret identifiers.
- Generated output (`dist`, `coverage`, Playwright output) must remain untracked.

## Advisory and exception policy

**Active audit exceptions: none.** Lower-severity tooling advisories are not silently accepted merely because tooling is excluded from the production install. The previous high-only full-graph gate is historical; PR-02 supersedes it.

For every new advisory, record its identifier, package and installed versions, severity, dependency path, development/build/runtime exposure, available fix, owner and decision. Prefer a compatible scoped fix with a fresh installation and the full quality gate. Do not merge unrelated dependency upgrades to hide an advisory or apply `npm audit fix --force` indiscriminately.

Any future exception would require a separately reviewed policy change with exact advisory/package/version scope, rationale, compensating controls, an assigned owner, a tracking issue, an expiry date and tests that fail when it expires. A documentation entry alone does not waive the native npm gate. Global ignores, raised severity thresholds, `|| true` and `continue-on-error` are not accepted substitutes. An unavailable registry blocks validation.

Dependabot groups compatible Vitest and `@vitest/*` version updates separately from other npm updates, and declares a distinct security-update group. These rules do not enable security updates if disabled in repository settings and do not authorize automatic merging. Review the final installed graph, not only the proposed version labels.

Historical reports stay tied to their original date and commit. The [PR-02 dependency evidence](release-evidence/pr-02-dependency-security.md) records the remediation of GHSA-82fw-gwwq-j7x9; a past clean audit is not proof that no new advisory exists today.

## Branch rules

The active `main` ruleset requires pull requests, thread resolution, the `Quality gate` status, squash-only merges, linear history, and blocks deletion/non-fast-forward updates. The repository intentionally does not require a separate approving reviewer because it is currently maintained as a solo demonstrator; adding a nominal approval requirement would not add meaningful assurance.

CodeQL is kept as an independent security workflow rather than folded into the main quality job. This separates static security analysis from normal build/test failures and keeps its elevated `security-events: write` permission out of the general-purpose CI workflow.
