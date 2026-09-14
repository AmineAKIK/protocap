# Responsive shell architecture

PR4 makes shell ownership explicit without forcing ProtoCap's public application and ShiftGuide to share the same navigation presentation.

## Contract

A shell owns persistent navigation, safe-area compensation, shell geometry and the boundary between navigation chrome and route content. A shell must not know domain page names merely to attach page-specific styling or behavior.

Each shell exposes a `data-shell-content` region. Shell-level runtime behavior may target that region, but should not scan unrelated navigation, overlays or the entire document when a narrower owner exists.

## Public application shell

`AppShell` owns:

- the persistent public header;
- desktop and mobile navigation landmarks;
- mobile navigation compensation and safe-area handling;
- the main shell content boundary.

Route-specific scopes such as `pilot-proposal-page` and `packing-calculator-page` are owned by routing composition in `App.tsx`, not by `AppShell`. They remain temporary migration hooks until their respective page migrations remove the need for legacy scoped CSS.

## ShiftGuide shell

`ShiftGuideLayout` owns:

- desktop rail and mobile navigation placement;
- persistent navigation compensation;
- the standard versus immersive Céline content mode;
- degraded-storage status chrome;
- the explicit ShiftGuide shell content boundary.

`useShiftGuideShell` may manage route scroll restoration, mobile document locking and keyboard-aware Céline viewport height, but those behaviors must target the content boundary rather than treating every descendant of the shell as application content.

## Different shells, shared rules

The public application and ShiftGuide intentionally keep different navigation forms and breakpoints because their information density and interaction models differ. The shared architecture is the ownership contract, not visual uniformity.

Both shells must guarantee:

1. one identifiable route-content region;
2. persistent navigation that does not require page-owned compensation;
3. safe-area handling at shell level;
4. route-agnostic shell components;
5. shell runtime behavior scoped to the smallest responsible region;
6. semantic navigation landmarks with accessible names.

## Migration rule

A page may define domain composition and temporary page-scoped migration hooks, but it must not teach a shell about its route name, hard-code shell geometry, or require shell-wide DOM scanning to behave correctly.
