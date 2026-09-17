# PR-02 — Vitest dependency security

## Scope and provenance

- Remediation finding: F15; acceptance scenarios: T32 and T33.
- Parent: `ae6ff45ee46750b8026d2848e8d881e094157fa1` (merged PR-01).
- Generation commit: `39f83eaed87fd5db000377fc674fa5fa337ec29c`.
- Audit date: 17 September 2026, 20:55:23 UTC.
- Execution: GitHub Actions, Ubuntu 24.04.5, Node v24.20.0, npm 11.19.0.
- [Generation and fresh-install run](https://github.com/AmineAKIK/protocap/actions/runs/35273634056).
- Machine-readable before/after reports: [`pr-02-dependency-audit.json`](pr-02-dependency-audit.json).

The local editing environment could not resolve GitHub and did not provide Node 24. Dependency resolution was therefore executed by a temporary, branch-scoped workflow checking out the immutable parent. It did not update any Git ref. The final candidate is built on the generated commit, not on the temporary workflow branch. That preparation workflow is not part of the proposed PR.

This file records dependency preparation, not a forecast of final CI results. The pull request must attach the actual Quality Gate and CodeQL runs for its final reviewed head, plus the critical review result, before merge. Historical PR-01 baseline evidence is preserved unchanged.

## Advisory and exposure

[GHSA-82fw-gwwq-j7x9](https://github.com/advisories/GHSA-82fw-gwwq-j7x9) reports a path-traversal/arbitrary-file-read issue in Vitest mock redirection. The inspected stable Vitest 4.1.10 graph is affected; 4.1.11 is the compatible patched release. The advisory concerns particular development-server/mock-plugin configurations; it is not evidence that ProtoCap's production application was exploited or exposed.

Before correction, a fresh install followed by a full audit at the low severity floor returned code 1 with three moderate package findings associated with this advisory. The production-only audit returned zero. After correction and a second clean `npm ci`, both audits returned code 0 and zero findings. The installed `vitest`, `@vitest/coverage-v8` and `@vitest/mocker` were each read from disk as 4.1.11, and `npm ls` verified the aligned tree.

A clean audit means no advisory reported by that registry at that time, not absence of all vulnerabilities.

## Exact update perimeter

Both direct development dependencies are pinned to 4.1.11. npm generated the lockfile using:

```sh
npm install --package-lock-only --ignore-scripts --save-dev --save-exact vitest@4.1.11 @vitest/coverage-v8@4.1.11
npm ci
npm audit --include=dev --audit-level=low
npm audit --omit=dev --audit-level=low
npm ls vitest @vitest/coverage-v8 @vitest/mocker
```

Nine Vitest-family packages move from 4.1.10 to 4.1.11. npm also refreshed three compatible Vitest dependencies:

| Package / installed path | Before | After | Vitest 4.1.11 requirement |
|---|---|---|---|
| `obug` | 2.1.4 | 2.2.1 | `^2.1.1` |
| `tinyexec` | 1.3.0 | 1.3.1 | `^1.0.2` |
| `vitest/node_modules/picomatch` | 4.0.5 | 4.0.7 | `^4.0.3` |

The first preparation run stopped on this additional drift before publishing any generated commit. Their relationship was checked against the upstream [Vitest v4.1.11 manifest](https://github.com/vitest-dev/vitest/blob/v4.1.11/packages/vitest/package.json). The successful run allowed only these exact additional paths and versions, checked they were development-only and compared the complete production lock graph before and after. These are compatible transitive refreshes, not additional application features or claimed security fixes.

Twelve package entries change, plus the root manifest metadata. No production dependency entry changes. No dependency override, manual integrity hash, audit suppression or application source change was introduced.

Generated lockfile SHA-256: `bee244bd5b79b898f289552de516dbe7da1d9a81b411bff01e9448f793be3b2b`.

## Existing pull requests

Dependabot #115 was inspected. It proposes nine unrelated version updates, including React Router, Playwright, Testing Library, PostCSS and lint tooling, but does not fix the Vitest pair. It remains independent; no files or commits from it were absorbed. Its lockfile should be regenerated against the new base if it is pursued later. The React, Vite, Tailwind, PWA and packaging PRs also remain outside this workstream.

## Regression and audit policy

`tests/dependencySecurity.test.mjs` covers the reviewed stable-version floor, a nested vulnerable mocker, missing/misaligned/runtime-classified toolchain entries, manifest/lock consistency and actual installed versions. It also exercises both npm audit scripts against an intentionally failing loopback registry and requires a nonzero exit.

The full audit now explicitly includes development dependencies and blocks findings from low severity upward. The production audit stays separate and makes the same severity floor explicit. CI rejects manifest drift after installation and records `npm ls` for the toolchain. Existing coverage floors and browser suites are unchanged.

There are no active exceptions. T33 uses the stricter no-exception policy: registry failure is blocking, low/moderate findings are not accepted implicitly, and future scoped exceptions require separate reviewed implementation and expiry tests as specified in `docs/ci-security.md`.

## Compatibility, recovery and rollback

No user-data format, persistence key, authentication flow, application runtime code or Railway setting changes. No data migration or recovery procedure is required for this dependency-only change.

If tooling regresses, prefer a compatible patched forward fix. Reverting only the audit-policy/docs changes does not require reverting the safe dependency versions. Do not automatically restore the vulnerable 4.1.10 graph; doing so would reintroduce F15 and require an explicit security decision. No production deployment is performed by this PR preparation.

## Completion evidence

The before/after audits and clean-install proof above have executed. The final candidate's repository checks, Docker build, browser suites, CodeQL and review are separate gates: their exact run IDs and results belong in the PR conversation after execution. F15 is not considered delivered until the reviewed correction is merged; the plan's PR-01 status column remains a historical snapshot.
