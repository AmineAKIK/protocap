# Responsive shared component contracts

PR3 hardens the small set of shared UI primitives so pages inherit safer responsive behavior instead of compensating locally.

## Principles

Shared components must be intrinsically shrinkable, must not depend on arbitrary character breaking for ordinary labels, and must own overflow only when their interaction semantics require it.

### Buttons

`Button` and `ButtonLink` accept constrained parents without forcing horizontal overflow. Icons stay atomic while labels may shrink and wrap at natural boundaries.

### Badges

`Badge` wraps by default because a generic shared badge cannot assume every future label is short. Callers may opt into `nowrap` only for genuinely atomic status tokens whose parent layout can absorb the constraint.

### Dialogs and modals

`AccessibleDialog` does not assume a fixed header height. The dialog uses a bounded two-row layout where the header sizes naturally and the content region exclusively owns vertical overflow. This keeps long titles, descriptions, short-height viewports, and mobile landscape usable without nested document scrolling.

`Modal` remains a thin placement/content-padding wrapper around `AccessibleDialog` rather than implementing a second dialog layout system.

### Informational surfaces

`StatCard` and `DemoBoundaryNotice` explicitly allow intrinsic shrink and restore natural word-boundary wrapping while the application-wide emergency `overflow-wrap:anywhere` rule remains temporary migration debt.

## Scope

PR3 changes shared defaults only. It does not migrate bespoke controls inside individual pages, redesign page composition, or remove the global overflow/text-wrap compatibility rules. Those remain staged work for later migration PRs.
