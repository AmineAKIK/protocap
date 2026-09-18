# CI security controls

ProtoCap keeps CI security proportional to its role as a public technical demonstrator. The goal is reviewable, reproducible controls without implying enterprise compliance.

## Workflow permissions and action integrity

- GitHub Actions dependencies are pinned to immutable commit SHAs; human-readable major-version comments remain beside the pins.
- The `Quality gate` job has read-only repository contents permission.
- CodeQL stays in an independent workflow. It analyzes JavaScript/TypeScript on pull requests, pushes to `main` and a weekly schedule. Its only write permission is `security-events: write`, required to publish code-scanning results.
- Required check names are preserved. A pipeline refactor must not accidentally evade an existing branch rule by renaming a check.

## Dependency and installation controls

- `npm run audit:full` explicitly includes development dependencies and blocks findings from low severity upward.
- `npm run audit:prod` separately applies the same floor to the production graph.
- Registry failures remain failures. Loopback HTTP 503 tests exercise both audit scripts without depending on a live external outage.
- `npm ci` must leave `package.json` and `package-lock.json` unchanged.
- Installed Vitest packages must match the exact lockfile graph and the patched reviewed Vitest 4 floor; a future major requires separate review.
- Install scripts are explicit. The currently required esbuild postinstall is pinned through `allowScripts` rather than approved by a broad wildcard.

## Hermetic test environments

Browser suites do not inherit a trusted application server. Every Playwright configuration starts identified synthetic services with `reuseExistingServer: false` and graceful shutdown.

The harnesses replace the host environment before importing the production bootstrap. Provider credentials are empty, protected configuration sentinels are discarded and no CI browser test calls the live DeepSeek provider. The public-demo suite starts two isolated loopback origins rather than contacting Railway.

The Docker runtime smoke starts the exact image built in the job with a synthetic demo configuration. It binds only to loopback, waits for readiness, verifies that the protected unlock route is absent and removes the container on success or failure.

## Coverage and mutation evidence

Frontend targeted coverage, frontend global coverage and Node/server coverage are generated as separate evidence products. They are not combined into a misleading single percentage.

Mutation smoke modifies only the checked-out workspace, runs focused tests and restores every source file in a `finally` block. Mutated source is never uploaded or committed. A mutation that survives makes the Quality Gate fail.

## Browser artifacts and data minimization

On failure, Playwright retains traces, screenshots, video and JSON/HTML reports. CI uploads browser evidence and coverage with `if: always()` for 14 days so the first failure remains inspectable.

Only synthetic fixtures may appear in public artifacts. Tests must not log or upload:

- provider credentials or protected environment values;
- bearer session tokens;
- protected ShiftGuide configuration;
- real localStorage/sessionStorage content;
- real operator messages or operational documents.

Artifact retention is diagnostic, not a relaxation of data-minimization rules. Generated evidence directories remain gitignored and CI rejects them if tracked.

## Intermittent-failure policy

Playwright may retry once to capture additional diagnostics, but CI sets `failOnFlakyTests: true`. A test that succeeds only on retry therefore remains a failed Quality Gate.

Retry count increases, blanket timeout increases, skipped assertions and `continue-on-error` are not accepted fixes for recurring intermittence. The first failure evidence must remain available and the underlying timing or isolation defect must be tracked.

## Advisory and exception policy

**Active audit exceptions: none.** Lower-severity tooling advisories are not silently accepted merely because tooling is outside the production install.

For every new advisory, record its identifier, package and installed versions, severity, dependency path, development/build/runtime exposure, available fix, owner and decision. Prefer a compatible scoped fix with a fresh installation and the full quality gate. Do not merge unrelated upgrades to obscure an advisory or apply `npm audit fix --force` indiscriminately.

Any future exception requires a separately reviewed policy change with exact advisory/package/version scope, rationale, compensating controls, owner, tracking issue, expiry and a test that rejects the expired exception. Documentation alone does not waive the native npm gate. Global ignores, raised severity thresholds, `|| true` and `continue-on-error` are not substitutes. An unavailable registry blocks validation.

Dependabot grouping does not authorize automatic merge. Review the final installed graph, not only the proposed version label.

Historical reports remain tied to their original date and commit. The [PR-02 dependency evidence](release-evidence/pr-02-dependency-security.md) records the remediation of GHSA-82fw-gwwq-j7x9; a past clean audit is not proof that the current graph is clean.

## Branch and review rules

The active `main` ruleset requires pull requests, thread resolution, the `Quality gate` status, squash-only merges, linear history, and blocks deletion/non-fast-forward updates. CodeQL remains separate from the general-purpose job so its elevated permission is not inherited by build and test steps.

The repository is maintained as a solo demonstrator and does not use a nominal self-approval requirement as a substitute for evidence. The reviewed SHA, status checks, artifacts and explicit critical review remain identifiable.
