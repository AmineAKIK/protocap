# Packing and dense-surface responsive contract

PR9 treats Packing Calculator as an intentional dense-surface exception without creating a second responsive architecture.

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

The stylesheet is route-scoped by `.packing-calculator-page` and relies primarily on existing semantic boundaries:

- `section[aria-label='Référence et résultat exact']`;
- `section[aria-label='Découpage final et suivi manuel']`;
- `section[aria-labelledby='packing-exact-title']`;
- `section[aria-labelledby='packing-shipment-title']`;
- the strategy `radiogroup` and `radio` roles.

PR9 removes the previous `:has()`-driven tree discovery from the Packing rules. A future JSX refactor should not require CSS to rediscover which deeply nested anonymous `div` represents a business region.

Some shallow structural selectors remain inside already semantic regions for purely visual compaction. They are local implementation details, not application-wide layout rules.

## Intrinsic sizing and business numbers

Packing opts out of the global emergency `overflow-wrap: anywhere` compatibility rule. Ordinary French copy wraps naturally, while `.tabular-nums` remains atomic with `white-space: nowrap`.

The narrow-phone regime keeps large shipment/progress numbers scaled down rather than character-breaking. The theoretical result stacks below 480 px instead of squeezing both sides of the row.

The load-progress counter and shipped-volume percentage remain intentionally distinct: the first answers “how many loads?”, while the second answers “how much volume?”. The load percentage stays visually suppressed.

## Validation

Packing remains covered by its workflow E2E suite and is now also part of the responsive architecture CI gate. The dedicated responsive contract exercises:

- 320×568 minimum phone;
- 844×390 mobile landscape / low height;
- 1024×768 tablet landscape;
- 1280×720 compact laptop at the `xl` transition;
- 1366×768 common laptop.

For every profile the test checks document horizontal containment, primary shipment-action reachability, atomic business numbers and whether the page is stacked or split in the intended regime.

Static tests additionally prevent Packing rules from returning to `index.css` or reintroducing `:has()` tree discovery.

## Deliberate non-goals

PR9 does not remove the repository-wide `overflow-x: hidden` or `overflow-wrap: anywhere` compatibility debt. That remains PR10 scope, where the migration can be enforced globally after the exceptional surfaces are explicitly protected.

PR9 also does not change packing mathematics, persistence, shipment semantics, AppShell geometry or navigation behavior.
