# Quality gates

ProtoCap uses `npm run check` as the repository-level local and CI quality gate. It is designed to catch regressions that matter to an engineering demonstrator without turning coverage or lint scores into vanity metrics.

## What `npm run check` verifies

1. Server and shared JavaScript syntax checks.
2. Node test suite under `tests/`.
3. Frontend Vitest suite with V8 coverage enabled.
4. ESLint, including targeted type-aware async checks for TypeScript source under `src/`.
5. A production frontend build through TypeScript and Vite.

The GitHub Quality Gate then adds a production Docker build, browser-level checks, a high/critical advisory gate for the full development/build graph, and a separate production-dependency audit.

## Browser and accessibility policy

Browser coverage is deliberately layered rather than multiplying every end-to-end journey across every engine:

- the full critical ShiftGuide journey suite stays on desktop Chromium, where state, session, persistence, concurrency, keyboard-dialog and Céline boundary behavior are exercised in depth;
- mobile Chromium and desktop WebKit run focused smoke tests for the public shell, PWA metadata, responsive overflow and a protected ShiftGuide deep link;
- automated accessibility smoke scans use `@axe-core/playwright` on the public landing page, the ShiftGuide lock, and an authenticated module/confirmation-dialog flow.

The axe gate blocks automated WCAG A/AA findings with `critical` or `serious` impact. It is a regression detector, not a claim of full accessibility conformance: keyboard behavior, semantics and visual review still need human judgment.

Cross-browser smoke scripts do not call a live AI provider. They run against the same deterministic local E2E server fixture used by the Chromium journeys.

## Coverage policy

Coverage is intentionally scoped to behavior-bearing frontend modules that have direct automated tests. Large presentation-oriented pages are not counted merely to inflate or depress a global percentage.

The percentage is therefore **risk-targeted, not repository-wide**. High-risk integration surfaces can remain outside the V8 denominator when their release risk is better exercised through focused component tests plus browser journeys. `src/pages/shiftguide/CelinePage.tsx` is one such surface: its request lifecycle and persistence hydration have direct Vitest regressions, while the protected Céline journey is also exercised through Playwright. Exclusion from the percentage must not be read as exclusion from automated testing.

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

## Supply-chain audit policy

Dependency risk is split by trust surface instead of treating every package as equivalent:

- `npm run audit:full` runs `npm audit --audit-level=high` against the complete development/build/runtime graph and fails CI on high or critical advisories;
- `npm run audit:prod` runs `npm audit --omit=dev` and remains the stricter production-runtime gate, where any reported vulnerability fails the command;
- `package-lock.json` is committed and CI installs with `npm ci`, so reviewed transitive resolutions are reproducible;
- dependency install scripts are reviewed explicitly. The current Vite toolchain requires the `esbuild@0.25.12` postinstall script, and `package.json` records that exact version in `allowScripts` rather than approving future esbuild versions implicitly.

The WS-07 refresh removed the then-current full-graph advisories by updating only compatible transitive lockfile resolutions. Both the complete graph and the production-only graph subsequently audited at zero vulnerabilities.

## Known install-time warnings

The locked development/build dependency graph still emits two deprecation warnings during `npm ci`:

- `source-map@0.8.0-beta.0` is deprecated by its maintainer;
- `glob@11.1.0` emits npm's old-version/security-support deprecation notice.

Both are transitive build dependencies under `vite-plugin-pwa -> workbox-build@7.4.1`. They are not direct application dependencies, are excluded from the production-only install, and the current audited graph reports no vulnerability for either package. Workbox 7.4.1 is the current upstream release and still carries this dependency debt, so forcing a major PWA-tooling migration solely to hide these warnings would add more release risk than it removes. The warnings remain visible and should be revisited when upstream Workbox replaces the deprecated dependencies.

The prior npm `allow-scripts` warning for `esbuild@0.25.12` is intentionally resolved through the pinned `allowScripts` policy described above; it is not suppressed generically.

The production Docker build also uses `npm cache clean --force`, for which npm prints its standard `using --force Recommended protections disabled` warning. The flag is limited to cache cleanup in the image build and does not disable runtime application protections.

## Maintenance rule

A quality-gate change should explain what failure mode it prevents. New checks should stay deterministic, run without live external providers, and remain part of `npm run check` unless they are inherently environment-specific (for example the production-container and browser checks in GitHub Actions).
