# Responsive enforcement

Responsive behavior is enforced as an application contract, not as a page-by-page convention.

## Principal surface registry

`src/responsive/surfaceRegistry.ts` lists every principal user-facing route that must carry named responsive coverage. Redirect-only aliases and wildcard fallback routes are excluded because they are not independent product surfaces.

Adding a new principal route without registering it makes `tests/responsiveSurfaceRegistry.test.mjs` fail. Each registry entry must declare whether it is covered by the shared browser contract or by a specialized responsive contract.

The registry is intentionally explicit. It is not a second router and it does not attempt to infer product intent from React component structure.

## Browser proof

`npm run test:e2e:responsive` runs:

- the shared responsive architecture contract;
- principal-surface coverage for Home, Knowledge Base and ShiftGuide Home;
- a controlled reduced-`visualViewport` scenario for Céline;
- the specialized Packing responsive contract.

The Quality Gate workflow runs that command on pull requests and on `main`.

## Hidden overflow policy

Global or shell-level horizontal clipping is forbidden. TSX source must not introduce Tailwind `overflow-x-hidden` as a fallback for responsive defects.

If a genuinely local clipping case ever requires that utility, the owning element/file must carry an explicit `data-responsive-overflow-exception` marker and the exception must be justified in review. This escape hatch exists for legitimate local visual clipping; it is not permission to hide document overflow.

`overflow-hidden` remains valid for local visual ownership such as rounded media, progress tracks, overlays or intentionally bounded immersive regions.
