# Responsive page layout primitives

PR11 closes the gap between shell geometry and ordinary page composition by introducing `PageFrame` as the shared owner of application content width and horizontal gutters.

## Contract

`PageFrame` owns only horizontal frame geometry:

- intrinsic shrinkability (`min-width: 0`);
- full available width;
- approved maximum content widths;
- approved responsive horizontal gutters.

It deliberately does not own page-specific grids, vertical rhythm, sticky controls, scroll regions, typography, or domain breakpoints. Those remain composition concerns.

## Profiles

The initial API stays intentionally small:

- `width="standard"` uses the normal public application width;
- `width="wide"` is reserved for genuinely wider operational surfaces;
- `gutter="standard"` matches the public shell and general application content;
- `gutter="compact"` preserves the tighter phone gutter used by dense operational/documentation surfaces while converging to the same tablet and desktop gutters.

New width or gutter profiles require an application-wide layout need. A single page must not add a profile merely to avoid a local composition decision.

## Initial adoption

PR11 migrates the public shell header, shared demo notices, Home and Knowledge Base. These surfaces no longer duplicate `max-w-7xl` plus responsive gutter literals.

Pilot and Packing remain explicit domain exceptions: Pilot is a document-like proposal with its own 1120px page geometry, while Packing is a dense workshop surface with a 1480px cap. Their widths must not be forced into the standard frame merely for visual uniformity.

Operational pages keep their existing composition until their sticky edge-to-edge controls can be migrated without changing their established phone behavior. Their current compact gutter values are represented by the shared primitive rather than creating another layout profile.

## Rule for new pages

A new ordinary public page should begin with `PageFrame`. It may select an existing width/gutter profile, but it should not copy application frame literals such as `max-w-7xl px-4 sm:px-6 lg:px-8` into page JSX.

Page-specific responsive rules remain valid when they express domain composition inside the frame.
