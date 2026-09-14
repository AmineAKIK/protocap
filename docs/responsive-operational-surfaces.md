# Responsive operational surfaces

PR6 migrates Expiry Check and Logistics Call onto the responsive architecture established by PR1–PR5.

The goal is not to make the two pages visually identical. They have different operational tasks, but they now share the same responsive ownership rules: the AppShell owns persistent navigation geometry, the document owns normal vertical scrolling, local rails own intentional horizontal scrolling, and dense multi-column compositions wait until the available width is comfortable.

## Shared shell relationship

Both operational pages run inside `AppShell` and consume the inherited `--app-header-height` custom property for their single mobile/tablet sticky view switcher. Neither page duplicates the public header height as `top-14`, pixels, or rem values.

A page may own a sticky control below the AppShell header when it is part of that page's workflow. It must not stack additional sticky regions using guessed offsets derived from other sticky elements.

## Expiry Check

Expiry Check previously stacked the mobile view switcher and the line selector, with the second layer using `top-[7.25rem]`. That made the page depend on an implicit sum of header and local-control heights.

The migrated composition keeps one sticky view switcher only. The line selector is a normal-flow horizontal rail with local `overflow-x-auto`; it can contain intrinsically non-wrapping line tokens without creating document-level horizontal overflow.

The block/recharge composition now waits until `xl` before using two columns. Date cards collapse to one column below 380px. The washer board uses one, two, then three columns as space becomes available.

Recharge history and the expanded register no longer create nested vertical scroll containers. Their disclosure still bounds cognitive density, but once expanded the document owns vertical scrolling.

## Logistics Call

Logistics Call keeps its line form and logistics board as mutually exclusive views through small-laptop widths. The simultaneous two-column composition now starts at `xl` (1280px), rather than at `lg` (1024px), because each side contains a complete operational workflow with forms, request cards, statuses and actions.

The view switcher remains available below `xl` and is positioned from `--app-header-height`. Request cards and form regions explicitly allow intrinsic contraction and normal word wrapping.

## Validation

Repository tests lock the following invariants:

- operational sticky controls use AppShell geometry rather than duplicated offsets;
- Expiry Check owns only one sticky layer below AppShell;
- Expiry's line rail is the local horizontal-scroll owner;
- Expiry does not introduce page-level nested vertical scroll regions;
- Logistics does not split into two operational columns before `xl`;
- both surfaces explicitly contain shrinkable content and natural text wrapping.

The responsive browser contract exercises Expiry Check and Logistics Call at the minimum phone, phone landscape, tablet landscape and small-laptop profiles. It checks root horizontal containment, primary-action reachability and the view-switching workflow where the split composition is not active.

## Deliberate non-goals

PR6 does not remove the global `overflow-x: hidden` or `overflow-wrap: anywhere` compatibility debt. It does not redesign the domain workflows, persistence model or product boundaries. Those global compatibility rules remain scheduled for the final enforcement pass.
