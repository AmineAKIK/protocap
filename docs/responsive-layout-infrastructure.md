# Responsive layout infrastructure

PR2 turns the responsive architecture contract into a small shared shell layer. The goal is not to replace Tailwind or page-level composition rules. It is to centralize the dimensions and safe-area compensation that pages must never own themselves.

## Sources of truth

`src/layout/responsiveGeometry.ts` owns geometry that is also needed by runtime TypeScript, notably the public header height, ShiftGuide mobile navigation reserve, desktop rail width, and ShiftGuide mobile/desktop media queries.

`src/responsive-shell.css` owns shell layout behavior that belongs in CSS: responsive bottom padding, safe-area insets, and the transition between mobile navigation compensation and desktop rail compensation.

The React shells expose the TypeScript geometry to CSS custom properties. This keeps keyboard-aware JavaScript behavior and CSS layout compensation aligned without copying the same number into multiple components.

## Shared shell classes

The public shell uses:

- `app-shell-header-inner` for the shared header height;
- `app-shell-content` for persistent bottom-navigation compensation;
- `app-shell-mobile-nav` for safe-area padding on the fixed mobile navigation.

ShiftGuide uses:

- `shiftguide-standard-content` for standard-route mobile bottom reserve and desktop rail offset;
- `shiftguide-celine-content` for the immersive Céline viewport and desktop rail offset;
- `shiftguide-mobile-nav` for safe-area padding on the fixed mobile navigation.

These classes are infrastructure primitives. They should not contain domain-specific page composition.

## Migration rule

Pages should consume shell behavior rather than duplicate shell dimensions. New page code must not add padding such as `calc(5rem + env(safe-area-inset-bottom))`, desktop rail offsets such as `pl-24`, or fixed-header dimensions merely to compensate for an application shell.

The existing global `overflow-x: hidden` and `overflow-wrap: anywhere` rules remain compatibility debt during the staged migration. PR2 deliberately does not remove them; the final cleanup PR removes those safety wheels only after the high-risk routes have migrated and the responsive test matrix can prove that the application no longer depends on them.
