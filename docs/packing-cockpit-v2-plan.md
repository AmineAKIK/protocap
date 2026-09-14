# Packing Cockpit V2 — implementation plan

## Purpose

Packing Calculator must evolve from a calculation-first workshop tool into a production cockpit that remains fast for the line operator while exposing manager-readable KPIs at a glance.

This is not a visual reskin. The target product model changes from:

> calculate a packing strategy and increment a sequential shipment counter

into:

> create a production run, execute it through quantitative declarations, and derive trustworthy operational KPIs from declared state

The implementation stays deliberately honest: V2 has no machine telemetry, no live cadence, no OEE/TRS, and no wall-clock countdown. Cadence is a manually entered **reference cadence**.

## Product principles

### One business truth, two reading levels

The operator and manager consume the same underlying state through different visual priorities.

Manager scan:

- planned units;
- declared units;
- progress;
- remaining units;
- plan variance;
- reference cadence;
- estimated production time.

Operator action:

- reference inputs;
- strategy choice;
- complete/partial declaration;
- correction;
- explicit new-run/reset actions.

No KPI may claim to be live, actual, measured, or machine-derived unless such a source genuinely exists.

### Units are the canonical execution quantity

All execution arithmetic normalizes to units.

For a declaration:

```text
declaredUnits = completeCartons * unitsPerCarton + partialCartonUnits
```

`partialCartonUnits` means units contained in the final incomplete carton. They are not loose/unpacked units.

### A declaration is an event, not a counter increment

Every operator declaration is a first-class immutable record. Progress is derived from active declaration records, not persisted as a generic count of completed loads.

### Derived values are not persisted

Values that can be reconstructed from run inputs and declarations — totals, progress ratio, remaining quantity, duration estimates — remain derived state. Persistence stores source facts only.

## Business invariants

These invariants are mandatory and must be locked by unit tests before the new cockpit UI becomes authoritative.

1. `requestedUnits`, `unitsPerCarton`, `cartonsPerLoad`, `plannedUnits`, and `referenceCadenceUnitsPerMinute` are positive safe integers.
2. Strategy calculations preserve the existing `exact`, `round-carton`, and `round-pallet` arithmetic unless a later business decision explicitly changes them.
3. `plannedUnits` equals the selected strategy `totalPrepared`.
4. Production estimates use `plannedUnits`, never requested units.
5. A declaration input contains non-negative safe integers for `completeCartons` and `partialCartonUnits`.
6. A declaration must represent a strictly positive quantity after normalization. `0 cartons + 0 units` is rejected.
7. `partialCartonUnits >= unitsPerCarton` is normalized into additional complete cartons plus a remainder in `[0, unitsPerCarton - 1]`.
8. Normalization must remain in the safe-integer domain. Unsafe multiplication/addition is rejected.
9. Declaration records persist only normalized source quantities (`completeCartons`, `partialCartonUnits`) plus identity/timestamp. `totalUnits` is derived and is **not** a persisted second source of truth.
10. `declaredUnits` is the sum of all active declaration quantities derived against the immutable run `unitsPerCarton`.
11. `remainingUnits = plannedUnits - declaredUnits` and must never be negative.
12. A new declaration that would make cumulative `declaredUnits > plannedUnits` is rejected with an explicit domain validation error. It is never silently capped, split, or accepted.
13. Correction/removal targets a declaration identity, not a generic counter.
14. Removing/correcting a declaration deterministically recomputes declared units, progress, remaining units, and duration estimates.
15. `progressRatio = declaredUnits / plannedUnits` and remains in `[0, 1]`.
16. Raw duration arithmetic retains full numeric precision in **minutes as a finite number**: `plannedUnits / referenceCadenceUnitsPerMinute` and `remainingUnits / referenceCadenceUnitsPerMinute`.
17. Display duration uses a single explicit policy: **round any positive fractional minute upward**, implemented as `Math.ceil(minutes)` for non-negative durations, then format as hours/minutes. This prevents the displayed estimate from understating production duration. Business arithmetic never mutates source quantities to satisfy display rounding.
18. No wall-clock countdown is allowed in V2.
19. No KPI may be labelled measured/live/actual unless derived from recorded operator declarations or a real external source.

## Target domain model

The existing `src/utils/packing.ts` remains the calculation foundation. The new execution domain is run-oriented.

Conceptual shape:

```ts
interface PackingRun {
  id: string;
  createdAt: string;
  requestedUnits: number;
  unitsPerCarton: number;
  cartonsPerLoad: number;
  selectedPolicy: PackingPolicy;
  plannedUnits: number;
  varianceUnits: number;
  referenceCadenceUnitsPerMinute: number;
  declarations: PackingDeclaration[];
}

interface PackingDeclaration {
  id: string;
  createdAt: string;
  completeCartons: number;
  partialCartonUnits: number;
}

interface PackingRunProgress {
  declaredUnits: number;
  remainingUnits: number;
  progressRatio: number;
  declarationCount: number;
  estimatedTotalMinutes: number;
  estimatedRemainingMinutes: number;
}
```

Names can evolve during implementation, but these responsibilities must not collapse back into one numeric progress counter.

## Storage and migration strategy

The current parameter-derived progress key is unsuitable as a production-run identity. V2 introduces a packing-specific persisted schema without changing the shared version of unrelated public storage.

### Versioning rule

`useLocalStorage` currently appends one shared `DATA_VERSION` to every public key. **Packing V2 must not bump that shared version**, because that would orphan unrelated Expiry, Logistics, and other persisted data.

PR2 must therefore use packing-specific schema/versioning, for example a new logical key such as:

```text
lineops.packing.active-run.v1
```

or a dedicated packing storage adapter that owns its own version marker. The final choice must isolate Packing migrations from unrelated features.

### Active-run identity and history scope

V2 guarantees that the currently persisted production run has its own unique identity. A new run with exactly the same calculation parameters must never recover progress from a previous run merely because the parameters match.

PR2 may persist a single active run (or an equivalent active-run record keyed by its unique run ID). Replacing/completing that run may replace the previously active persisted record.

The declarations attached to the active run are its correction/history source of truth. **A durable archive of multiple completed/replaced runs is not a V2 requirement.** If a cross-run journal is needed later, it belongs in a separate feature/PR rather than expanding PR2.

### Legacy state

Old sequential progress is **not** converted into fake declaration history. The new runtime ignores it. On first V2 use, the operator starts a new run from the current calculation.

### Persistence truthfulness

The current UI phrase `Enregistré sur cet appareil` cannot survive unchanged while storage writes can fail silently.

PR2 must provide one of these truthful behaviors:

- an observable persisted/degraded storage state; or
- removal of any positive persistence claim.

A failed write must never leave a UI assertion that durable storage succeeded.

## State ownership

The target page separates:

1. editable calculation draft;
2. selected strategy / plan candidate;
3. immutable production-defining snapshot of the active run;
4. declaration draft UI;
5. declaration history;
6. derived cockpit KPIs.

Once a run is active, production-defining parameters do not silently mutate when draft inputs change. Replacing the plan requires an explicit transition such as `Nouveau run` / `Remplacer le plan`.

## UX architecture

### Working-screen contract

The completed cockpit is a one-viewport operational surface on working landscape screens.

Mandatory no-document-scroll viewports:

- 1024×768;
- 1180×820;
- 1280×720;
- 1366×768 — primary industrial reference;
- 1440×900;
- 1920×1080.

Mobile remains vertically composed and scrollable. Tablet portrait may remain scrollable if fitting would require unreadable typography or undersized touch targets.

The no-scroll contract means critical cockpit content and the primary declaration action fit inside the shell-adjusted viewport **without** `scrollIntoViewIfNeeded()`.

No implementation may satisfy this by clipping inaccessible content with route-level `overflow: hidden`.

### Information architecture

The cockpit has four conceptual areas.

#### KPI scan layer

Manager-readable without interaction:

- planned;
- declared;
- progress percentage;
- remaining;
- estimated remaining production time;
- reference cadence;
- requested-versus-planned variance.

#### Plan/reference controls

Operator-editable before activation:

- requested quantity;
- units/carton;
- cartons/load (UI terminology may still say palette where physically appropriate);
- reference cadence;
- strategy.

#### Production state

Visual centre of gravity:

- planned / declared / remaining;
- progress visualization;
- estimated total and remaining duration;
- selected strategy;
- variance.

#### Declaration action

Fastest operator path:

- one-click complete-load declaration using expected full-load quantity;
- explicit partial declaration path;
- complete cartons + units in final partial carton;
- immediate computed-unit preview;
- correction/removal by declaration identity;
- no ambiguous `next load` wording.

`Déclarer la prochaine charge expédiée` becomes `Déclarer une charge` or an equally non-presumptive label.

## Visual direction

The target is an industrial operations cockpit, not a generic SaaS dashboard.

- large tabular business numbers;
- high contrast between state and controls;
- teal for nominal/action state;
- amber for planned variance/attention;
- red only for genuine error/invalid state;
- dark surfaces reserved for high-priority operational summaries;
- minimal explanatory prose during active execution;
- no decorative fake gauges;
- no tiny typography used merely to force viewport fit;
- short state transitions may animate, but must respect `prefers-reduced-motion` and must not simulate telemetry.

## Architecture decomposition

`PackingCalculatorPage.tsx` must stop owning domain orchestration, storage coordination, and all view components in one file.

Likely target structure:

```text
src/features/packing/
  domain/
    packingRun.ts
    packingRun.test.ts
  persistence/
    packingRunStorage.ts
  components/
    PackingCockpit.tsx
    PackingKpiStrip.tsx
    PackingReferenceControls.tsx
    PackingStrategySelector.tsx
    PackingProductionState.tsx
    PackingDeclarationPanel.tsx
    PackingDeclarationHistory.tsx
```

Exact file names are flexible. Pure domain logic, persistence, orchestration, and visual components must remain separately testable.

## Delivery sequence

### PR1 — Run domain foundation

**Goal:** establish operational truth without changing production UI.

Scope:

- introduce run/declaration domain types and pure functions;
- normalize partial-carton declarations;
- derive declaration totals, run progress, and cadence estimates;
- reject zero, negative/invalid, unsafe, and over-plan declarations deterministically;
- keep raw duration precision separate from display rounding;
- provide duration formatting with upward whole-minute display rounding;
- add exhaustive unit tests;
- document terminology in code.

Acceptance:

- `10 cartons + 120 units` with `480 units/carton` = `4,920 units`;
- `600 partial units` with `480 units/carton` normalizes to `1 carton + 120 units`;
- zero declaration rejected;
- unsafe arithmetic rejected;
- declaration above remaining quantity rejected, never capped;
- removing a declaration restores exact prior progress;
- `400,320 / 60 = 6,672 min = 111 h 12 min`;
- `232,320 / 60 = 3,872 min = 64 h 32 min`;
- fractional raw minutes retain precision while display formatting rounds upward to avoid understatement;
- existing packing arithmetic remains green.

**No UI or persistence changes.**

### PR2 — Run persistence and migration boundary

**Goal:** give the active run an independent durable identity without disturbing unrelated browser data.

Scope:

- packing-specific versioned storage schema;
- unique run ID and timestamps;
- one independently identified active persisted run;
- runtime validation that recomputes all derived totals rather than trusting persisted duplicates;
- a new run with identical parameters must not reuse old progress;
- legacy sequential state ignored, not fabricated into declarations;
- explicit storage degraded state or removal of persistence-success copy;
- corruption and write-failure tests.

Acceptance:

- starting a second run with identical plan parameters creates a new identity and starts with no inherited declarations;
- the active run reloads with its own declaration history;
- durable multi-run archive/history is explicitly out of scope for V2;
- no global `DATA_VERSION` bump;
- corrupt state fails closed;
- write failure does not crash and never claims successful persistence.

### PR3 — Operator declaration workflow

**Goal:** replace sequential increment/decrement with real declarations.

Scope:

- wire active run into page orchestration;
- `Déclarer une charge` primary action;
- one-click full-load declaration;
- partial declaration form;
- exact unit preview;
- correction/removal by declaration identity;
- progress derived from history;
- accessible live feedback;
- remove misleading `looseUnits` wording from the new execution path.

Acceptance:

- complete path is no slower than current one-click flow;
- partial path accepts cartons, partial-carton units, or both;
- over-plan declaration is visibly rejected;
- correction restores exact previous derived state;
- no implicit predetermined `next load` execution assumption remains.

### PR4 — Cadence and production estimates

**Goal:** expose truthful manual production-time planning.

Scope:

- reference cadence input in units/minute;
- total and remaining estimates from run state;
- defined duration formatter;
- cadence captured in immutable run snapshot;
- recalculation after declarations/corrections;
- explicit `référence` / `estimé` labels.

Acceptance:

- known examples above match exactly;
- draft cadence edits never silently mutate an active run;
- nothing counts down with wall time.

### PR5 — Cockpit information architecture and decomposition

**Goal:** rebuild the screen around manager scan + operator action.

Scope:

- decompose monolithic page;
- remove active-state wizard hierarchy `01 / 02 / 03`;
- KPI scan layer;
- production state as visual centre;
- configuration demoted after activation;
- one authoritative instance of each primary KPI;
- truthful terminology and semantic regions.

Acceptance:

- manager can identify plan, progress, remaining, cadence, estimate, and variance without interaction;
- operator primary action is immediately identifiable;
- accessibility remains free of serious/critical automated violations.

### PR6 — Cockpit responsive / viewport-fit contract

**Goal:** true single-screen working cockpit.

Scope:

- height-aware + width-aware composition;
- semantic responsive hooks/tokens instead of route-wide Tailwind utility overrides;
- shell-aware available height;
- wider use of large work screens;
- mobile remains scrollable;
- AppShell keeps ownership of persistent navigation geometry.

Required browser assertions:

- no horizontal document overflow;
- no vertical document scroll for active cockpit at all mandatory working viewports;
- KPI scan layer visible without scrolling;
- primary declaration action visible without scrolling;
- primary business numbers remain atomic/readable;
- usable action target sizes preserved;
- no clipping-based success.

### PR7 — Visual cockpit polish

**Goal:** strengthen industrial command-centre perception without reducing operational clarity.

Scope:

- final hierarchy, typography, spacing, contrast;
- state transitions with reduced-motion support;
- empty/complete/error states;
- cross-browser visual validation;
- validation at 1366×768 and 1920×1080.

No new business logic belongs here.

### PR8 — Closure, debt removal, production proof

**Goal:** remove superseded architecture and prove the shipped system.

Scope:

- retire obsolete sequential shipment execution path once unused;
- remove dead persisted form `policy` if superseded;
- update responsive and operations docs;
- static architecture guards for new boundaries;
- complete CI matrix;
- deploy exact main SHA to Railway and verify `/api/ready`.

## Test strategy

### Unit/domain

Must cover at minimum:

- full declaration;
- partial cartons only;
- partial-carton units only;
- cartons + partial units;
- normalization across carton boundary;
- zero declaration rejection;
- unsafe numeric boundaries;
- over-plan rejection;
- declaration removal/correction;
- progress at zero / intermediate / complete;
- fractional raw duration precision;
- display rounding for exact minutes and positive fractional minutes;
- long-duration formatting.

### Integration/component

Must cover:

- explicit run activation;
- immutable active plan versus editable draft;
- full declaration fast path;
- partial declaration preview/confirmation;
- correction;
- a new identical run does not inherit prior progress;
- corrupted storage recovery;
- storage degraded state.

### Browser/E2E

Must cover:

- full operator journey;
- partial declaration journey;
- correction;
- reload persistence;
- manager KPI correctness;
- mandatory working-screen no-scroll geometry;
- mobile scrollable composition;
- Chromium + WebKit smoke;
- accessibility.

## Explicit non-goals

V2 does not add:

- machine-cell integration;
- automatically measured cadence;
- wall-clock production countdown;
- OEE/TRS/performance KPI without measured inputs;
- backend synchronization;
- multi-user concurrency;
- ERP/MES integration;
- durable multi-run archive/history;
- invented operational telemetry.

Architecture should leave room for a future measured-data source without pretending that it exists today.

## Definition of done

Packing Cockpit V2 is complete only when:

1. execution truth is declaration-based;
2. units are the canonical progress quantity;
3. partial loads match real carton + partial-carton workflow;
4. active run parameters cannot change silently;
5. the active persisted run has a unique identity independent of its calculation parameters;
6. starting a new run never reuses old progress solely because its parameters are identical;
7. storage failures cannot masquerade as successful persistence;
8. cadence/time estimates are manual, truthful, deterministic, and rounded upward for display when fractional;
9. manager KPIs and operator actions share one underlying state;
10. mandatory landscape work screens require no document scroll;
11. mobile remains usable rather than artificially compressed;
12. serious/critical automated accessibility violations are absent;
13. old sequential execution code is removed once no longer authoritative;
14. exact merged SHA passes required GitHub gates;
15. exact main SHA deploys successfully to Railway and `/api/ready` returns 200.
