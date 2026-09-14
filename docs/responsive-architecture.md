# Responsive architecture contract

ProtoCap treats responsiveness as an application invariant, not as page-level polish.

This document defines the contract that future layout infrastructure, shared components, shells, and pages must satisfy. It intentionally describes behavior before implementation so that later refactors can change technical details without weakening the guarantees.

## Architectural objective

A new ProtoCap page should inherit sane responsive behavior from the application infrastructure. Page code may define domain-specific composition changes, but it must not have to reinvent gutters, safe-area handling, shell offsets, overflow policy, viewport ownership, or baseline test coverage.

A responsive implementation is considered successful when it remains usable across supported widths and short-height layouts without relying on global clipping, arbitrary text breaking, or page-specific compensation for shell geometry.

## Core invariants

### Document overflow

- The root document must not scroll horizontally at supported viewports from 320 CSS px upward.
- Horizontal scrolling is allowed only inside an explicit local scroll surface such as a true data table, carousel, timeline, or intentionally non-reflowable rail.
- Global `overflow-x: hidden` must never be used as the mechanism that makes a page appear responsive. During migration, existing global clipping is considered compatibility debt to remove, not part of the target architecture.

### Intrinsic sizing and text

- Flex and grid children that are expected to shrink must allow intrinsic contraction, normally through `min-width: 0` or an equivalent component contract.
- Ordinary prose and labels must wrap at natural language boundaries. Arbitrary character-by-character breaking is not a baseline responsive strategy.
- Atomic values that genuinely must stay together, such as short status tokens or numeric measures, may use no-wrap only when their parent layout can absorb that constraint.
- Long identifiers, URLs, user-provided values, and other unbounded strings need an explicit containment strategy appropriate to their semantics.

### Layout adaptation

- A multi-column composition must collapse when readability or interaction quality becomes poor, not only when it physically overflows.
- Breakpoints are implementation tools, not product requirements. Layout transitions should be justified by content needs and available space.
- Reusable components should prefer behavior based on their available container space when viewport breakpoints would make them unnecessarily coupled to page placement.
- Page-specific responsive rules are acceptable only when they express domain composition rather than repair a missing global primitive.

### Shell ownership

- Application shells own page gutters, maximum content width, safe-area padding, persistent-navigation compensation, and shared sticky offsets.
- Pages must not hard-code shell dimensions to position content below headers or above bottom navigation.
- Safe-area insets are handled by the owning shell or primitive, not copied into every page.

### Scroll ownership

Every scrollable surface must have one clear owner.

- Standard pages: the document owns vertical scrolling.
- Dialogs and constrained overlays: the dialog content region owns overflow when necessary.
- Immersive/mobile-chat surfaces may intentionally lock document scrolling and delegate scrolling to a named internal region.
- Tables, carousels, and rails may own local horizontal scrolling.
- Nested competing vertical scroll containers should be avoided unless the interaction explicitly requires them.

### Fixed and sticky UI

- Persistent navigation, headers, sticky controls, and floating actions must not hide required content or primary actions.
- Sticky offsets must derive from shell-owned geometry rather than duplicated magic numbers.
- Short viewport heights and mobile landscape are first-class validation cases for fixed and sticky compositions.

### Viewport height

Responsive quality includes height as well as width.

- Full-height experiences must use modern viewport behavior appropriate to mobile browser chrome.
- Keyboard-sensitive views may use `VisualViewport` or equivalent runtime handling when CSS alone cannot preserve usability.
- A low viewport height must not make essential actions unreachable.

### Accessibility and interaction

- Responsive rearrangement must preserve semantic order, keyboard reachability, focus visibility, and usable interactive target sizes.
- Hiding secondary labels or content at small sizes must not remove the accessible name of an action.
- Responsive behavior must remain compatible with the repository accessibility gate; responsive tests do not replace accessibility tests.

## Supported validation matrix

The shared responsive harness defines named viewport profiles instead of scattering width literals through individual specs.

The baseline matrix covers:

- 320 x 568: minimum supported phone
- 390 x 844: modern phone portrait
- 844 x 390: phone landscape
- 640 x 800: small tablet / intermediate width
- 768 x 1024: tablet portrait
- 1024 x 768: tablet landscape
- 1180 x 820: small laptop
- 1280 x 720: compact laptop / short desktop
- 1366 x 768: common laptop
- 1440 x 900: desktop

Not every route must run every viewport on every CI job. Coverage is risk-based, but every principal surface must eventually have representative width and height coverage, and shared invariants must remain reusable from one harness.

## Test policy

Responsive automation checks invariants, not screenshots of accidental implementation details.

The shared harness should be used to assert, where applicable:

- no root horizontal overflow;
- essential content is present;
- primary actions remain visible or reachable;
- persistent navigation does not cover required content;
- local horizontal overflow is confined to an intentional scroll surface;
- representative short-height and landscape layouts remain usable.

Visual judgment is still required for composition quality. Passing a no-overflow assertion is necessary but not sufficient: content can fit technically and still be too compressed to be considered well designed.

## Migration rule

During the responsive infrastructure programme, existing pages fall into two states:

1. **Enforced**: the route is already healthy enough for shared invariant tests to block regressions.
2. **Migration pending**: known debt is documented and addressed by a later PR before the final enforcement pass.

A pending route must not receive new responsive debt. New pages created after the infrastructure PRs should enter the enforced state immediately.

## Definition of done for a new page

A new page is not complete unless:

1. it uses the appropriate application shell and shared layout infrastructure;
2. it has no root horizontal overflow from 320 px upward;
3. it remains usable in phone landscape and representative short-height viewports;
4. its essential actions are not obscured by fixed or sticky UI;
5. ordinary text wraps naturally rather than through arbitrary character breaking;
6. intentional horizontal scrolling is local, explicit, and semantically justified;
7. it does not hard-code shell offsets or safe-area compensation;
8. it has at least one responsive browser smoke path or is covered by a documented equivalent shared contract test;
9. any exception to the architecture contract is explicit and justified;
10. it does not change global CSS to repair a page-local layout defect.

## Non-goals

This contract does not require a large internal responsive DSL or replacement for Tailwind. Tailwind and CSS remain valid implementation tools. Shared primitives should exist only where they encode a real application-wide rule.

The target is a small, predictable responsive infrastructure with strong defaults and explicit exceptions, not a second layout framework.