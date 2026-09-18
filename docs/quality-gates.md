# Quality gates

ProtoCap uses layered quality controls. The layers answer different questions and are not interchangeable: a global report does not replace a regression threshold, a Docker build does not prove the container starts, and a retry that passes does not make an intermittent failure disappear.

## Entry points

### `npm run check`

The stable local regression gate runs:

1. JavaScript syntax checks for server, shared and quality scripts.
2. The Node test suite under `tests/`.
3. The risk-targeted frontend Vitest suite with blocking V8 coverage floors.
4. ESLint, including type-aware async rules for application TypeScript.
5. The production TypeScript/Vite build.

This command remains the normal developer feedback loop and preserves the pre-PR-11 coverage denominator and floors.

### `npm run check:ci`

The extended evidence command runs `npm run check`, then adds:

- the repository-wide frontend coverage report;
- separate Node/server coverage collection;
- three temporary critical mutation checks.

GitHub Actions invokes `check:ci`. The Docker runtime smoke and browser suites remain workflow-level checks because they require Docker and installed browser engines.

## Frontend coverage: two separate products

### Risk-targeted blocking gate

`vitest.config.ts` owns the blocking coverage denominator. It contains behavior-bearing modules with direct unit/component regressions and keeps these repository floors:

- statements: 60%;
- branches: 50%;
- functions: 50%;
- lines: 60%.

The denominator is intentionally stable during this transition. Widening a denominator can lower a percentage without a product regression or raise it without improving a critical path; the targeted gate therefore remains independently visible under `coverage/frontend-targeted/`.

New critical modules introduced by the remediation programme have explicit per-file objectives rather than relying only on the aggregate:

- `src/features/shiftguide/demoRuntime.ts`: at least 90% statements/lines and 85% branches/functions;
- `src/features/logistics/logisticsModel.ts`: at least 90% statements/lines and 85% branches/functions.

These objectives supplement invariant tests and E2E behavior. They must not be lowered merely to recover a green badge.

### Repository-wide descriptive report

`vitest.global.config.ts` produces `coverage/frontend-global/`. Its denominator is all production `src/**/*.{ts,tsx}` except:

- `src/**/*.test.{ts,tsx}`;
- `src/test/**` test infrastructure;
- `src/types/**` declaration-only domain types;
- generated or hand-written `*.d.ts` declarations.

The global report has no percentage threshold in PR-11. It establishes an honest baseline and makes unmeasured surfaces visible; it is not presented as an improvement over the targeted percentage. A future threshold needs a reviewed baseline and cannot replace the targeted gate silently.

Both reports retain text, JSON summary, HTML and LCOV output. `reportOnFailure` remains enabled so a threshold failure still leaves useful diagnostic evidence.

## Server coverage

`npm run test:server:coverage` uses the Node 24 test runner's built-in coverage collection. It covers:

- `server.mjs` and `server/**/*.mjs`;
- `shared/**/*.js`;
- `demo/**/*.mjs`.

The textual summary and raw V8 data are written under `coverage/server/`. This report is separate from frontend V8 coverage because the runtimes, source sets and test runners differ. PR-11 does not invent a server threshold without first observing a stable denominator; the report is descriptive and retained as CI evidence.

## Mutation smoke policy

`npm run test:mutation:smoke` makes three temporary source mutations and requires the focused tests to fail:

1. invert a Logistics transition permission;
2. add an erroneous extra calendar day to Expiry;
3. ignore a failed Logistics post-write verification.

Each file is restored in a `finally` block. The mutations are never committed and are not a general mutation-testing score. Their purpose is narrower: prove that selected high-risk tests detect the defect class they claim to guard.

A surviving mutation fails `check:ci`. Adding a mutation requires a deterministic exact replacement and a focused test that fails for the right behavioral reason.

## E2E suite selection

`scripts/e2e-suites.mjs` is the sole suite manifest. It maps every `e2e/**/*.spec.ts` file to a named npm script, Playwright configuration and browser projects. `tests/e2eSelection.test.mjs` checks that:

- every spec is selected by the manifest;
- every manifest entry names at least one spec and browser project;
- every referenced file/configuration exists;
- every npm E2E command delegates to the manifest runner;
- every named command is invoked by the Quality Gate.

`scripts/run-e2e-suite.mjs` performs `playwright test --list` before execution and rejects a suite that discovers zero tests or produces an unreadable discovery result. A new spec cannot pass CI merely because no command selected it.

## Browser and timezone matrix

Browser coverage is risk-based rather than a full Cartesian product:

- critical ShiftGuide and Packing journeys: desktop Chromium;
- responsive architecture contracts: desktop Chromium across named viewport regimes;
- public shell/PWA smoke: Chromium mobile and WebKit;
- accessibility: Chromium plus focused keyboard assertions in modified journeys;
- Expiry temporal journeys: Chromium desktop, Chromium mobile and WebKit;
- Logistics reliability: Chromium desktop, Chromium mobile and WebKit;
- local multi-tab concurrency: Chromium with Web Locks;
- isolated public demo: Chromium desktop, Chromium mobile and WebKit across protected and demo origins.

Temporal browser tests explicitly select UTC, Europe/Paris summer/winter and America/New_York where the invariant depends on timezone behavior. The complete application suite is not duplicated in every timezone because that would add cost without proportionate signal.

The axe gate blocks automated WCAG A/AA findings with `critical` or `serious` impact. It remains a regression detector, not a declaration of full accessibility conformance; keyboard, focus order, semantics and visual hierarchy still require direct review.

## Hermetic browser-test servers

Playwright starts identified synthetic servers with `reuseExistingServer: false`. A process already bound to a configured test port is a hard failure rather than an implicitly trusted service.

The harness replaces the inherited process environment with deterministic fixtures before loading the production server bootstrap. Provider credentials are empty, protected host configuration is discarded and no browser suite calls the live DeepSeek provider. `tests/e2eHarness.test.mjs` poisons the parent environment with sentinels and verifies the boundary.

The public-demo suite starts both protected and demo origins, each with its own explicit harness. This exercises cross-origin navigation without borrowing a deployed service or a maintainer secret.

## Retries and intermittent failures

CI uses one Playwright retry to capture a trace and distinguish a transient first failure from a deterministic failure. It also sets `failOnFlakyTests: true`; therefore a test that fails first and passes only on retry still makes the Quality Gate fail.

The first failure evidence is retained. A recurring intermittent test is tracked and corrected like any other defect; increasing retry counts, swallowing an assertion or lengthening a timeout without a demonstrated timing contract is not an accepted closure.

## Browser artifacts

On failure, Playwright retains:

- trace;
- screenshot;
- video;
- JSON result report;
- HTML report.

Each named suite writes to its own directory under `test-results/playwright/` and `playwright-report/`. The workflow uploads those directories plus all three coverage products with `if: always()` and a 14-day retention period.

Fixtures are synthetic. Tests must not write protected configuration, bearer tokens, localStorage snapshots containing protected data, provider prompts or user-entered operational content into public artifacts. Artifact retention is diagnostic evidence, not permission to broaden logging.

## Production-container runtime proof

CI first builds the repository Docker image and then executes `scripts/container-runtime-smoke.mjs` against that exact local image. The smoke:

- starts the container on loopback with the repository's synthetic demo profile;
- waits for `/api/ready`;
- checks ShiftGuide/Céline synthetic readiness;
- verifies the public-demo session endpoint is active;
- verifies the protected code-unlock endpoint is absent;
- removes the container even when an assertion fails.

This proves more than `docker build` while remaining provider-free and non-destructive. It does not prove a Railway deployment; live deployment correlation belongs to PR-13.

## Supply-chain audit policy

Dependency risk is split by trust surface:

- `npm run audit:full` audits the development/build graph from low severity;
- `npm run audit:prod` audits the production graph from low severity;
- registry errors remain failures and are exercised through a loopback failure fixture;
- `npm ci` must preserve `package.json` and `package-lock.json`;
- installed Vitest packages must match the exact patched lockfile graph;
- install scripts are explicitly reviewed and pinned through `allowScripts`.

There are no active audit exceptions. A future exception needs exact advisory/package/version scope, rationale, compensating controls, owner, tracking issue and expiry. Documentation alone cannot bypass the native npm audit gate.

The historical PR-02 evidence remains dated evidence only. Every new PR executes current audits again.

## Type-aware lint and build

Type-aware ESLint analysis rejects floating promises and promises used in unsafe contexts for `src/**/*.{ts,tsx}`. The production build runs TypeScript and Vite after tests and lint. Generated output (`dist`, coverage and Playwright evidence) must remain untracked.

## Maintenance rule

A quality-gate change must name the failure mode it prevents. Required check names remain stable: `Quality gate` and the independent `CodeQL JavaScript/TypeScript` analysis are not renamed as an incidental cleanup.

Checks must be deterministic, use synthetic data, avoid live external providers and preserve their evidence on failure. A green retry, global percentage or historical workflow run is never substituted for the exact reviewed SHA and required gate.
