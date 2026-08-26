# Quality gates

ProtoCap uses `npm run check` as the repository-level local and CI quality gate. It is designed to catch regressions that matter to an engineering demonstrator without turning coverage or lint scores into vanity metrics.

## What `npm run check` verifies

1. Server and shared JavaScript syntax checks.
2. Node test suite under `tests/`.
3. Frontend Vitest suite with V8 coverage enabled.
4. ESLint, including targeted type-aware async checks for TypeScript source under `src/`.
5. A production frontend build through TypeScript and Vite.

The GitHub Quality Gate then adds a production Docker build, browser-level checks, and a production-dependency audit.

## Browser and accessibility policy

Browser coverage is deliberately layered rather than multiplying every end-to-end journey across every engine:

- the full critical ShiftGuide journey suite stays on desktop Chromium, where state, session, persistence, concurrency, keyboard-dialog and Céline boundary behavior are exercised in depth;
- mobile Chromium and desktop WebKit run focused smoke tests for the public shell, PWA metadata, responsive overflow and a protected ShiftGuide deep link;
- automated accessibility smoke scans use `@axe-core/playwright` on the public landing page, the ShiftGuide lock, and an authenticated module/confirmation-dialog flow.

The axe gate blocks automated WCAG A/AA findings with `critical` or `serious` impact. It is a regression detector, not a claim of full accessibility conformance: keyboard behavior, semantics and visual review still need human judgment.

Cross-browser smoke scripts do not call a live AI provider. They run against the same deterministic local E2E server fixture used by the Chromium journeys.

## Coverage policy

Coverage is intentionally scoped to behavior-bearing frontend modules that have direct automated tests. Large presentation-oriented pages are not counted merely to inflate or depress a global percentage.

Current minimum floors are:

- statements: 60%
- branches: 50%
- functions: 50%
- lines: 60%

These are regression floors, not targets. Thresholds should rise when meaningful behavior gains tests; production code should not be distorted to chase a percentage.

## Type-aware linting

Type-aware ESLint analysis is restricted to `src/**/*.{ts,tsx}`, which is covered by the application TypeScript project. The gate explicitly rejects:

- unhandled/floating promises;
- promises used in contexts where they can be silently misinterpreted, while allowing React event-handler attributes whose return values are intentionally ignored.

This keeps async mistakes visible without applying type-aware parser requirements to unrelated JavaScript, build configuration, or E2E files.

## Maintenance rule

A quality-gate change should explain what failure mode it prevents. New checks should stay deterministic, run without live external providers, and remain part of `npm run check` unless they are inherently environment-specific (for example the production-container and browser checks in GitHub Actions).
