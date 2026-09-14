# Packing and dense-surface responsive contract

Packing Calculator is an intentional dense-surface exception without creating a second responsive architecture.

## Why Packing is exceptional

Packing is an at-a-glance workshop tool: large operational numbers, three preparation strategies, a selected plan, shipment progress and primary execution actions must remain visible and comparable. That justifies stronger local density than an ordinary content page.

The exception is about **visual density**, not shell ownership or a separate breakpoint system. AppShell still owns persistent navigation and safe-area compensation. Packing still uses normal document scrolling.

## Composition regimes

The page keeps its existing content-driven composition:

- below `xl` (1280 px), reference/decision and execution content remain stacked;
- at `xl` and above, the page becomes a two-column workshop composition;
- the three strategy cards use three columns at `sm`, collapse to one inside the narrower left workshop column at `xl`, then recover three columns at `2xl` when that column becomes comfortable again.

This is an intentional example of a reusable responsive principle: a component can reduce density when its **container context** becomes narrower even while the viewport becomes wider.

## Local CSS ownership

Packing-specific overrides live in `src/packing-responsive.css`, not `src/index.css`.

The stylesheet is route-scoped by `.packing-calculator-page`. Business regions keep their accessible ARIA boundaries, while responsive compaction that needs a more precise target uses explicit stable hooks such as:

- `.packing-primary-input`;
- `.packing-exact-summary` and `.packing-exact-value`;
- `.packing-plan-metrics` and `.packing-plan-metric`;
- `.packing-primary-number`;
- `.packing-shipment-progress`;
- `.packing-load-progress` and `.packing-volume-progress`.

The responsive stylesheet must not rediscover meaning through JSX tree order. `:has()`, `first-child`, `last-child`, `first-of-type`, `last-of-type` and `nth-*` selectors are intentionally excluded from the Packing responsive contract. JSX may therefore gain wrappers or reorder sibling regions without silently retargeting responsive rules.

## Intrinsic sizing and business numbers

Ordinary French copy uses normal browser wrapping. Packing does not carry a route-wide `overflow-wrap` or `word-break` reset; PR10 removed the global compatibility rule that previously made such an opt-out necessary.

Atomic business values remain explicit with `.tabular-nums { white-space: nowrap; }`, and the surrounding layout is responsible for giving those values enough room. The narrow-phone regime scales large shipment/progress numbers down rather than character-breaking them. The theoretical result stacks below 480 px instead of squeezing both sides of the row.

The load-progress counter and shipped-volume percentage remain intentionally distinct: the first answers “how many loads?”, while the second answers “how much volume?”. The load percentage stays visually suppressed through the explicit `.packing-load-percent` hook.

## Validation

Packing remains covered by its workflow E2E suite and is part of the responsive architecture CI gate. The dedicated responsive contract exercises:

- 320×568 minimum phone;
- 844×390 mobile landscape / low height;
- 1024×768 tablet landscape;
- 1280×720 compact laptop at the `xl` transition;
- 1366×768 common laptop.

For every profile the test checks document horizontal containment, primary shipment-action reachability, atomic business numbers and whether the page is stacked or split in the intended regime.

Static tests additionally prevent Packing rules from returning to `index.css`, reintroducing tree-discovery selectors, or depending on route-wide wrapping overrides.

## Final enforcement state

The repository-wide `overflow-x: hidden` and `overflow-wrap: anywhere` safety wheels are gone. Packing must therefore pass the same root-overflow contract as ordinary surfaces while keeping its intentional local density rules.

Packing remains exceptional only in presentation density; it does not own an alternative shell, scrolling model, or global responsive policy.
