# Packing and dense-surface responsive contract

Packing Calculator is an intentional dense-surface exception without creating a second responsive architecture.

## Why Packing is exceptional

Packing is an at-a-glance workshop tool: large operational numbers, preparation strategies, manager KPIs and primary execution actions must remain visible and comparable. That justifies stronger local density than an ordinary content page.

The exception is about **visual density and cockpit fit**, not shell ownership or a separate global breakpoint system. AppShell still owns persistent navigation and safe-area compensation. Packing consumes the shell geometry through inherited CSS variables rather than duplicating header or navigation dimensions.

## Composition regimes

Packing has two document-behavior regimes:

- narrow/mobile and short-height surfaces keep normal document scrolling;
- from `1024px` wide and `700px` tall, the cockpit enters viewport-fit mode and the Packing route occupies exactly the shell content height.

In viewport-fit mode:

- reference/decision and execution content render side by side;
- the manager cockpit stays visible above the operator panel;
- the primary `Déclarer une charge` action stays in the first viewport;
- the preparation rail and operator panel may scroll locally when their secondary content grows;
- the root document must not gain horizontal or vertical scroll.

Below `1280px`, AppShell still owns the fixed bottom navigation, so Packing subtracts `--app-mobile-nav-reserve` and the safe-area inset from its available height. At `1280px` and above, that reserve becomes zero because the desktop shell navigation is authoritative.

The strategy cards keep their existing content-driven behavior: three columns at `sm`, one column inside the narrower `xl` preparation rail, then three columns again at `2xl` when the rail has enough width.

## Local CSS ownership

Packing-specific overrides live in `src/packing-responsive.css`, not `src/index.css`.

The stylesheet is route-scoped by `.packing-calculator-page`. Business regions keep their accessible ARIA boundaries, while compaction uses stable hooks such as:

- `.packing-primary-input`;
- `.packing-plan-metrics` and `.packing-plan-metric`;
- `.packing-cockpit-primary` and `.packing-cockpit-secondary`;
- `.packing-cockpit-metric`;
- `.packing-operator-panel`.

The responsive stylesheet must not rediscover meaning through JSX tree order. `:has()`, `first-child`, `last-child`, `first-of-type`, `last-of-type` and `nth-*` selectors remain excluded from the Packing responsive contract.

## Intrinsic sizing and business numbers

Ordinary French copy uses normal browser wrapping. Packing does not carry a route-wide `overflow-wrap` or `word-break` reset.

Atomic business values remain explicit with `.tabular-nums { white-space: nowrap; }`, and the surrounding layout is responsible for giving those values enough room. In viewport-fit mode the manager summary uses a compact 4+4 metric grid so large operational values stay readable without forcing document overflow.

## Validation

Packing remains part of the responsive architecture CI gate. The dense-surface contract still covers narrow and low-height behavior, including:

- 320×568 minimum phone;
- 844×390 mobile landscape / low height.

The viewport-fit contract additionally exercises the complete desktop/laptop target matrix:

- 1024×768;
- 1180×820;
- 1280×720;
- 1366×768;
- 1440×900;
- 1920×1080.

For every viewport-fit profile, the test verifies:

- no document horizontal overflow;
- no document vertical overflow;
- manager cockpit visible in the viewport;
- `Déclarer une charge` visible in the viewport;
- document scroll position remains at the origin after activation.

Static tests additionally prevent Packing rules from returning to `index.css`, reintroducing DOM-discovery selectors, duplicating shell geometry, or abandoning local scroll ownership.

## Final enforcement state

Packing does not use a global overflow-hiding safety wheel. The route earns no-scroll behavior by consuming the exact shell content height and by assigning overflow only to the dense subregions that can legitimately grow.

Packing remains exceptional only in presentation density and cockpit fit; it does not own an alternative shell or global responsive policy.
