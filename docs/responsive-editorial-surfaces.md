# Responsive editorial surfaces

PR7 migrates the Operational Report and Presentation Mode onto the responsive architecture established by PR1–PR6.

These surfaces are editorial rather than operational. Their responsive risk is not primarily sticky workflow controls; it is preserving readable line lengths, preventing dense side-by-side compositions from activating before they are comfortable, and keeping presentation controls reachable when viewport height is constrained.

## Operational Report

The report keeps normal document scrolling and does not introduce local page scroll containers.

Editorial sidebars now wait until `xl` before sitting beside long-form copy. At smaller widths the callout follows the text in normal flow. The same rule applies to the prototype dossier body and the conclusion composition: a layout becomes multi-column because the content is comfortable, not merely because it technically fits.

Summary and impact cards use two columns only from medium widths. Hero statement cards use three columns from medium widths. Report primitives explicitly allow intrinsic contraction and natural word wrapping so the final enforcement PR can remove the global wrapping compatibility rule without exposing hidden dependencies.

## Presentation Mode

Presentation Mode is a viewport-owned overlay, not a second application shell.

Its height contract is `100dvh`. The overlay is a grid with explicit rows for progress, header, a `minmax(0, 1fr)` slide body, and footer. Header and footer remain outside the slide scroll region. The body is the sole vertical scroll owner and uses `min-h-0`, `overflow-y-auto` and overscroll containment.

This matters on low-height landscape devices and small laptops: long slide content may scroll, but the close and navigation controls remain reachable without relying on guessed viewport heights.

Dense slide grids collapse before their text becomes cramped. Phone-width layouts use a single column where necessary, then recover two- or three-column compositions as width becomes comfortable.

## Breakpoint policy

PR7 does not create a new global breakpoint scale.

- `sm` and `md` are used for ordinary card grids where the content remains readable.
- `xl` is used for long-form report sidebars and dossier splits because both columns carry substantial editorial content.
- height behavior is handled through dynamic viewport units and scroll ownership, not a collection of height media queries.

## Validation

Static architecture tests lock the report's delayed editorial splits and Presentation Mode's viewport/scroll ownership. Browser coverage exercises the report and presentation overlay on minimum phone, phone landscape, small laptop and low-height desktop profiles, checking root horizontal containment and persistent presentation controls.

## Deliberate non-goals

PR7 does not change report copy, presentation narrative, application shell geometry or domain behavior. It does not remove the global `overflow-x: hidden` or `overflow-wrap: anywhere` compatibility debt; PR10 remains responsible for that enforcement cleanup.
