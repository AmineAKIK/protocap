# WS-06 — Test strategy and risk-based coverage evidence

**Status: COMPLETE — risk layers, coverage claims, CI behavior, and deterministic browser checks verified**

## Scope

WS-06 audits whether ProtoCap proves release-significant behavior at the right test layer instead of chasing a repository-wide coverage percentage. The objective is an actionable regression system for the current engineering demonstrator, not maximal test count or synthetic coverage inflation.

This workstream does not close unrelated runtime/security workstreams. In particular, any future WS-02 or other P0/P1 finding still requires its own regression coverage before merge where technically reasonable.

## Findings closed

### 1. Frontend coverage semantics are now explicit

`vitest.config.ts` uses V8 coverage with an explicit include list rather than measuring every frontend file. The configured regression floors are:

- statements: 60%;
- branches: 50%;
- functions: 50%;
- lines: 60%.

`docs/quality-gates.md` now states directly that this percentage is **risk-targeted, not repository-wide**. Large integration surfaces may remain outside the V8 denominator when their behavior is better proven by focused Vitest tests plus browser journeys.

`src/pages/shiftguide/CelinePage.tsx` is the explicit high-risk example: its request lifecycle and persisted-history behavior have direct Vitest regressions, while the protected Céline path is also exercised through Playwright. Its exclusion from the percentage is therefore not an exclusion from automated testing.

The thresholds remain appropriate as regression floors. No percentage was raised merely to create a stronger-looking metric, and no production code was changed to improve coverage numerically.

### 2. The critical Web Lock journey no longer depends on a fixed sleep

PR #105, merged as `d2732b41e0221fad523f63ac0ba2e8e466cde6ef`, removed the only explicit Playwright `waitForTimeout` in the repository.

The ShiftGuide cross-tab progress test previously slept for 150 ms before asserting that a second mutation was blocked behind `protocap:shiftguide:progress`. That delay was not evidence of lock state and could become flaky under CI load.

The test now polls `navigator.locks.query()` until the second lock request is actually present in the browser's pending queue, then proves persistence has not changed. After the first tab releases the lock, the existing poll proves the queued mutation eventually commits.

The exact reviewed head passed the critical Chromium journey in GitHub Actions, so the new synchronization check was verified in the real browser gate rather than only by TypeScript compilation.

## Six-layer audit

| Layer | Result | Release risk covered |
| --- | --- | --- |
| Node unit/runtime tests | PASS | Server contracts, configuration validation, Céline authority/context/cancellation/cost behavior, shared persistence contracts, quality-gate configuration and live-smoke logic are exercised without live external dependencies. |
| Frontend Vitest | PASS | Behavior-bearing hooks/components/clients/storage boundaries use jsdom tests; coverage runs in `npm run check` with explicit risk-targeted floors. High-risk integration pages can have direct tests without being part of the percentage denominator. |
| Desktop Chromium critical journeys | PASS | Protected deep links, invalid/valid unlock, session persistence/logout, progress reload, Web Lock serialization, keyboard/focus behavior, choice-module semantics and the deterministic Céline service-unavailable boundary are exercised end to end. |
| Mobile Chromium + desktop WebKit smoke | PASS | Public shell/PWA metadata, responsive overflow and protected ShiftGuide deep-link usability are checked without duplicating every desktop journey across engines. |
| Accessibility regression scan | PASS with explicit limitation | Axe checks public landing, ShiftGuide lock, authenticated module and confirmation dialog for serious/critical WCAG A/AA findings. This remains an automated regression detector, not a claim of complete accessibility conformance. |
| Production/live smoke | PASS as an implemented test layer; final RC run remains WS-18 | `.github/workflows/live-smoke.yml` supports manual dispatch and a daily schedule. `scripts/live-smoke.mjs` performs read-only HTTPS probes of `/`, `/api/health`, `/api/ready` and `/robots.txt`, including security headers, no-store/request-ID contracts and readiness/liveness shape. `tests/liveSmoke.test.mjs` verifies the smoke behavior deterministically and proves it does not call protected unlock/Céline routes. |

## Risk-to-regression mapping

| Known release-significant risk | Regression evidence |
| --- | --- |
| Protected ShiftGuide access and session lifecycle | Node server tests plus the Chromium deep-link/bad-code/session/logout journey. |
| Secret/config readiness and fail-closed server behavior | Server/readiness/security tests plus exact Railway deployment readiness checks. External Railway variable correctness itself is verified operationally because it is not reproducible as a repository unit test. |
| Céline provider authority and server-owned operational output | Céline contract/authority/domain/provider-context tests plus adversarial server-app coverage and the deterministic browser boundary. |
| Async cancellation and stale frontend responses | Node cancellation tests and direct Céline page lifecycle tests. |
| Browser persistence corruption/stale data | Shared persistence/progress tests and frontend hydration regressions added during WS-05. |
| Cross-tab ShiftGuide progress mutation | Shared concurrency tests plus the Chromium Web Lock journey, now synchronized on actual pending lock state rather than elapsed time. |
| Keyboard/dialog regressions | Critical Chromium focus/Escape journey plus axe dialog scan. |
| Mobile/WebKit regressions | Dedicated smoke projects rather than multiplying the full suite across browsers. |
| Public production health/security surface | Unit-tested live-smoke script plus scheduled/manual production workflow; final release-candidate execution remains WS-18. |
| Production dependency vulnerability regression | `npm audit --omit=dev` is a mandatory Quality Gate step. |

## CI signal quality

The pull-request Quality Gate executes:

1. exact checkout and Node setup;
2. `npm ci`;
3. generated-directory hygiene;
4. `npm run check`;
5. production Docker build;
6. Chromium/WebKit installation;
7. critical Chromium journeys;
8. mobile Chromium/WebKit smoke;
9. accessibility smoke;
10. production dependency audit.

CodeQL runs separately. Branch rules require the Quality Gate and resolved review conversations before merge. Release work in this audit has additionally used the exact PR head SHA as the merge precondition, preventing a green result from an older commit from being treated as evidence for a newer head.

The test strategy intentionally avoids live AI-provider calls in PR CI. Provider behavior is isolated behind deterministic adapters/contracts, while the production live smoke stays read-only and does not exercise protected or billable operations.

## Exact verification for the final WS-06 change

PR #105 passed on exact head `f341c98282ed2d407667c6b80273e3cc21f1a5b7`:

- Quality Gate run #382: `success`, including the updated critical Chromium Web Lock journey;
- CodeQL run #79: `success`;
- no unresolved review threads at merge;
- squash merge produced `d2732b41e0221fad523f63ac0ba2e8e466cde6ef` on `main`.

Railway then deployed that exact `main` commit as deployment `56c97f4b-58e7-4708-b1a8-bdf5131a1329` with status `SUCCESS`; startup reported the configured ShiftGuide/DeepSeek dependency booleans without secret values, and the Railway readiness request `GET /api/ready` returned HTTP `200` in 3 ms.

That deployment evidence confirms the repository remained releasable after the test-strategy change. It is not a substitute for the independent final release-candidate smoke required by WS-18.

## Exit criteria

- **Each known P0/P1 release risk has regression coverage where technically reasonable:** CLOSED for the risks implemented and audited to date. Repository-testable contracts map to Node, Vitest or browser layers; external deployment configuration is verified through deployment/readiness evidence. Any later P0/P1 finding must add or update regression coverage as part of its own PR.
- **Coverage claims exactly match configuration:** CLOSED. Frontend coverage is explicitly described as risk-targeted with the exact configured 60/50/50/60 floors and documented high-risk exclusions from the percentage denominator.
- **CI failure signals are actionable rather than noisy:** CLOSED. The explicit Playwright sleep was replaced by observable lock-state synchronization; no other `waitForTimeout` remains in the repository E2E suite.

## Residual boundaries — not WS-06 blockers

- Coverage floors are not repository-wide percentages and must not be presented that way.
- Automated axe scans do not replace manual accessibility review.
- Mobile/WebKit use focused smoke coverage rather than the full desktop critical suite.
- PR CI intentionally does not call the live DeepSeek provider or mutate production ShiftGuide state.
- The scheduled/manual live-smoke layer proves only public read-only production surfaces; the final release-candidate execution and broader live verification belong to WS-18.
- Open runtime/security workstreams remain open; WS-06 establishes the regression strategy but does not pre-approve future findings.

**WS-06 release decision: CLOSED.**
