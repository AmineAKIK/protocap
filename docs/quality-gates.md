# Quality gates

ProtoCap uses `npm run check` as the repository-level local and CI quality gate. It is designed to catch regressions that matter to an engineering demonstrator without turning coverage or lint scores into vanity metrics.

## What `npm run check` verifies

1. Server and shared JavaScript syntax checks.
2. Node test suite under `tests/`.
3. Frontend Vitest suite with V8 coverage enabled.
4. ESLint, including targeted type-aware async checks for TypeScript source under `src/`.
5. A production frontend build through TypeScript and Vite.

The GitHub Quality Gate then adds a production Docker build, critical Chromium E2E journeys, and a production-dependency audit.

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
