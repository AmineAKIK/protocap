# Packing Cockpit V2 — implementation plan

## Purpose

This document defines the implementation plan for turning `PackingCalculatorPage` from a calculation-first workshop tool into a production cockpit that remains operational for the line operator while exposing manager-readable KPIs at a glance.

The plan is intentionally architecture-first. It preserves the arithmetic that is already reliable, replaces the execution model that no longer matches the real workflow, introduces manual cadence-based production estimates without pretending to have machine telemetry, and establishes a viewport-fit cockpit contract for working screens.

This is not a visual reskin. The target changes the product model from:

> calculate a packing strategy and increment a sequential shipment counter

into:

> create a production run, execute it through quantitative declarations, and continuously derive trustworthy operational KPIs from the declared state

## Product principles

### One business truth, two reading levels

The operator and manager must not receive separate dashboards. They consume the same underlying state through different visual priorities:

- manager scan: planned, declared, progress, remaining, variance, reference cadence, estimated production time;
- operator action: reference inputs, strategy, next declaration, complete/partial load entry, correction and reset/start-over controls.

The manager layer must never invent performance data that the prototype does not possess. Terms such as `current cadence`, `actual efficiency`, `OEE`, `live ETA`, or other telemetry-derived claims are out of scope until there is a real machine data source.

### Operator truth before visual spectacle

The cockpit is allowed to be visually strong, but visual impact comes from hierarchy, large business numbers, contrast, and immediate state comprehension. It must not come from decorative gauges, fake live animations, excessive gradients, or metric proliferation.

### Manual data must stay explicit

Cadence is a manually entered **reference cadence in units/minute**. Time values are estimates derived from that reference cadence and the declared production state. They do not count down with wall-clock time.

### Units are the canonical execution quantity

All execution arithmetic is normalized to units.

For a declaration:

```text
declaredUnits = completeCartons * unitsPerCarton + partialCartonUnits
```

`partialCartonUnits` represents units contained in the final incomplete carton, not loose/unpacked units.

### A declaration is an event, not a counter increment

Every operator declaration must become a first-class record. Progress is derived from declaration history, not stored as an opaque sequential load count.

## Business invariants

These invariants are mandatory and must be locked by unit tests before the new cockpit UI becomes authoritative.

1. `requestedUnits` remains a positive safe integer.
2. `unitsPerCarton` remains a positive safe integer.
3. `cartonsPerLoad` remains a positive safe integer. The UI may continue to use pallet terminology where appropriate, but the execution domain must not require every physical load to be a pallet.
4. Strategy calculations preserve the existing `exact`, `round-carton`, and `round-pallet` arithmetic unless a separate business decision changes those policies.
5. `plannedUnits` equals the `totalPrepared` of the selected strategy.
6. Production estimates are calculated against `plannedUnits`, not requested units.
7. `referenceCadenceUnitsPerMinute` is a positive safe integer.
8. `estimatedTotalMinutes = plannedUnits / referenceCadenceUnitsPerMinute`.
9. `declaredUnits` is the sum of active declaration records.
10. `remainingUnits = max(0, plannedUnits - declaredUnits)`.
11. `estimatedRemainingMinutes = remainingUnits / referenceCadenceUnitsPerMinute`.
12. A declaration can be complete or partial.
13. A partial declaration can contain complete cartons, units in one final partial carton, or both.
14. `partialCartonUnits` must normalize into the range `[0, unitsPerCarton - 1]`. Input greater than or equal to `unitsPerCarton` must be normalized into additional complete cartons instead of creating an invalid state.
15. A declaration may not make the cumulative declared production exceed the active run plan unless the product explicitly introduces an over-declaration workflow in a later change.
16. Correction must target a declaration record, not decrement a generic counter.
17. Removing/correcting a declaration must deterministically recompute declared units, progress, remaining units, and time estimate.
18. No wall-clock countdown is allowed in V2.
19. No KPI may be labelled as measured/live/actual unless it is derived from recorded operator declarations or a real external source.

## Target domain model

The existing `packing.ts` arithmetic remains the calculation foundation. The execution layer should be replaced with a run-oriented model similar to the following conceptual shape:

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
  totalUnits: number;
}
```

Names can change during implementation, but the responsibilities must not collapse back into a single numeric progress counter.

Derived state must remain pure and reproducible:

```ts
interface PackingRunProgress {
  declaredUnits: number;
  remainingUnits: number;
  progressRatio: number;
  declarationCount: number;
  estimatedTotalMinutes: number;
  estimatedRemainingMinutes: number;
}
```

No derived KPI should be persisted if it can be reconstructed from the run.

## Storage and migration strategy

The existing persisted progress key is parameter-derived and therefore unsuitable as run identity. V2 must introduce a new persisted schema and storage key.

Recommended approach:

- keep the existing form input persistence for convenience;
- introduce a dedicated active-run key, e.g. `lineops.packing.active-run`;
- register the new schema in `publicStorageValidation.ts`;
- bump the public storage data version if the shared versioning strategy requires it;
- do not migrate old sequential progress into the new run automatically because the old state cannot prove the exact quantities of every prior declaration;
- preserve old data only as legacy storage that the new runtime ignores;
- on first V2 use, require creation/activation of a new run from the current calculation.

This is deliberately conservative: fabricating declaration history from an old integer counter would create false operational truth.

## State ownership

The target page must separate:

1. editable calculation draft;
2. selected strategy / plan candidate;
3. active production run;
4. declaration draft UI;
5. derived cockpit KPIs.

Once a run is active, its production-defining parameters must not silently mutate when the reference form changes. The product must use an explicit transition such as `Recalculer / remplacer le plan` or `Nouveau run` rather than transparently rebinding the active run to edited inputs.

This removes a major ambiguity in the current implementation where changing quantity after selecting a policy silently changes the active plan.

## UX architecture

### Working-screen contract

The cockpit target is a one-viewport operational surface on working landscape screens.

Mandatory no-document-scroll viewports for the completed cockpit:

- 1024×768 — tablet landscape, dense regime;
- 1180×820 — small laptop;
- 1280×720 — compact/short laptop;
- 1366×768 — primary industrial reference viewport;
- 1440×900 — desktop;
- 1920×1080 — large desktop validation.

Mobile remains scrollable and vertically composed. Tablet portrait may remain scrollable if fitting would require substandard touch targets or unreadable typography.

The no-scroll contract means critical cockpit content and the primary declaration action must fit inside the shell-adjusted viewport **without `scrollIntoViewIfNeeded()`**.

No implementation may satisfy this with route-level clipping (`overflow: hidden`) that hides inaccessible content.

### Height-aware composition

The current responsive system is mostly width-driven. V2 must explicitly account for short-height working screens.

The implementation should define at least:

- compact-height landscape cockpit;
- standard landscape cockpit;
- large landscape cockpit;
- stacked/mobile composition.

Exact media/container-query mechanics are an implementation detail, but layout changes must be driven by comfort and available space, not by width alone.

### Information architecture

The cockpit should expose four conceptual areas, even if exact placement changes during implementation:

#### A. KPI scan layer

Manager-readable, immediately visible:

- planned units;
- declared units;
- progress percentage;
- remaining units;
- estimated remaining production time;
- reference cadence;
- plan variance versus requested quantity.

This layer must be readable at a distance. KPI labels must remain semantically honest (`reference cadence`, `estimated`, `declared`).

#### B. Plan/reference controls

Operator-editable before run activation:

- requested quantity;
- units/carton;
- cartons/load or pallet, according to the final terminology decision;
- reference cadence;
- strategy choice.

These controls become secondary once the run is active. The cockpit must not spend permanent vertical space on explanatory copy that is only useful during initial configuration.

#### C. Production state

Central operational state:

- planned / declared / remaining quantities;
- progress visualization;
- estimated total and remaining time;
- selected strategy;
- requested-versus-planned variance.

This is the visual centre of gravity of the page.

#### D. Declaration action

The operator's fastest path:

- one-click complete-load declaration using the expected full-load quantity;
- explicit partial-load path;
- partial declaration form with complete cartons + final partial carton units;
- immediate computed unit total before confirmation;
- correction of the most recent declaration, with a path to inspect/correct history if needed;
- no ambiguous `next load` wording.

The current primary action text `Déclarer la prochaine charge expédiée` must be replaced by wording that does not assume a predetermined complete next load. `Déclarer une charge` is the baseline.

## Visual direction

The target should read as an industrial operations cockpit, not a generic SaaS dashboard.

Guidelines:

- large tabular business numbers;
- high contrast between state and controls;
- teal for nominal/action state;
- amber for planned variance/attention;
- red only for genuine error/invalid state;
- dark surfaces reserved for high-priority operational summaries, not every card;
- minimal explanatory prose during active execution;
- no fake gauges where a number + progress bar communicates more precisely;
- no tiny typography used merely to force viewport fit;
- visual transitions may animate state changes briefly, but must respect `prefers-reduced-motion` and must not simulate real-time telemetry.

## Architecture decomposition

The existing `PackingCalculatorPage.tsx` should stop owning all domain orchestration and view code.

A likely end state is:

```text
src/features/packing/
  domain/
    packingRun.ts
    packingRun.test.ts
  persistence/
    packingRunStorage.ts (only if needed beyond shared validation)
  components/
    PackingCockpit.tsx
    PackingKpiStrip.tsx
    PackingReferenceControls.tsx
    PackingStrategySelector.tsx
    PackingProductionState.tsx
    PackingDeclarationPanel.tsx
    PackingDeclarationHistory.tsx (if history is exposed in V2)
```

The exact file tree is not mandatory. The architectural requirement is that pure business logic, run orchestration, and visual components are separately testable.

`packing.ts` remains the calculation engine unless a future business rule explicitly changes it.

The old `packingShipment.ts` may be retired, reduced to planning helpers, or replaced. It must not remain the authoritative execution model if declarations become quantity-based.

## PR sequence

The implementation should be delivered as a sequence of focused pull requests. Do not combine the complete rewrite into a single PR.

### PR1 — Run domain foundation

**Goal:** establish the new operational truth without changing the production UI.

Scope:

- introduce `PackingRun` / declaration domain;
- implement declaration normalization;
- implement progress derivation;
- implement cadence/time-estimate derivation;
- keep all arithmetic in safe integer domain where applicable;
- define duration formatting separately from arithmetic;
- add exhaustive unit tests including partial declarations and correction/removal;
- document terminology (`partial carton units`, `reference cadence`, `declared units`).

Acceptance:

- complete and partial declarations derive exact totals;
- `10 cartons + 120 units` with `480 units/carton` = `4,920 units`;
- `600 partial units` normalize to `+1 carton + 120 units` for a 480-unit carton;
- progress cannot exceed planned units;
- time estimate uses selected plan quantity;
- no wall-clock dependency;
- existing `packing.ts` tests remain green.

No page redesign in this PR.

### PR2 — Run persistence and migration boundary

**Goal:** give every production run its own durable identity.

Scope:

- create new active-run persistence schema;
- add runtime storage validation;
- add unique run ID and timestamps;
- ensure identical production parameters can create independent runs;
- define explicit reset/new-run behavior;
- leave legacy sequential progress ignored rather than falsely migrated;
- add invalid-storage recovery tests.

Acceptance:

- two runs with identical quantities cannot share progress;
- corrupt persisted run state fails closed to a safe state;
- localStorage write failure does not crash;
- UI/storage status does not claim successful persistence when it cannot be established (if persistence status is surfaced).

No major visual redesign in this PR.

### PR3 — Operator declaration workflow

**Goal:** replace sequential load increment/decrement semantics with real declarations.

Scope:

- wire active run into page orchestration;
- replace `Déclarer la prochaine charge expédiée` with `Déclarer une charge`;
- implement fast complete-load declaration;
- implement partial declaration input;
- preview exact units before confirmation;
- support correction/removal of last declaration;
- derive progress from declaration records;
- update accessible names/live regions;
- remove misleading `looseUnits` terminology from operator-facing UI and new domain.

Acceptance:

- complete declaration is no slower than current one-click flow;
- partial declaration supports cartons, partial-carton units, or both;
- declaration immediately updates declared/remaining units;
- correction restores the exact previous derived state;
- no implicit `next load` assumption remains in execution state.

This PR may retain mostly existing visual composition to reduce risk while changing behavior.

### PR4 — Cadence and production estimates

**Goal:** add truthful manual production-time planning.

Scope:

- add reference cadence input in units/minute;
- derive total estimated duration from `plannedUnits`;
- derive remaining estimated duration from `remainingUnits`;
- integrate duration formatter suitable for long runs (`111 h 12`, etc.);
- persist cadence as part of the run snapshot;
- recalculate estimates after declarations/corrections;
- make all labels explicitly estimated/reference-based.

Acceptance:

- 400,320 units at 60 units/min produces 6,672 min = 111 h 12 min;
- after 168,000 units declared, 232,320 remain = 3,872 min = 64 h 32 min;
- changing a draft cadence does not silently mutate an already active run unless the UX explicitly supports editing the run cadence;
- nothing counts down with real time.

### PR5 — Cockpit information architecture and component decomposition

**Goal:** rebuild the page around the operator/manager dual-read contract.

Scope:

- split monolithic page into cockpit components;
- remove wizard-like `01 / 02 / 03` hierarchy from the active cockpit state;
- introduce KPI scan layer;
- make production state the visual centre;
- demote configuration controls after run activation;
- surface planned, declared, progress, remaining, cadence, estimate, variance;
- preserve clear strategy selection and reference edit flows;
- eliminate redundant explanatory copy during execution;
- keep semantic regions/headings meaningful.

Acceptance:

- manager can identify plan, progress, remaining, cadence, estimate and variance without interacting;
- operator primary action is immediately identifiable;
- there is one authoritative instance of every primary KPI;
- no KPI claims live or measured telemetry that does not exist;
- automated accessibility scan remains free of serious/critical violations.

### PR6 — Cockpit responsive / viewport-fit contract

**Goal:** make the working cockpit fit as a true single-screen surface.

Scope:

- rewrite Packing responsive composition around height + width regimes;
- replace generic route-wide typography overrides with semantic cockpit hooks/tokens;
- expand useful working width beyond the current conservative 1480px treatment where appropriate;
- enforce shell-aware available height;
- retain mobile stacked/scrollable behavior;
- keep AppShell as owner of persistent navigation geometry;
- update responsive documentation.

Required browser assertions:

- no document horizontal overflow;
- no document vertical scroll for active cockpit at 1024×768, 1180×820, 1280×720, 1366×768, 1440×900, 1920×1080;
- primary declaration action visible without scroll;
- manager KPI strip visible without scroll;
- all primary business numbers remain atomic/readable;
- touch/click targets maintain minimum usable dimensions;
- no clipping-based success.

The existing `scrollIntoViewIfNeeded()` proof is insufficient for these working-screen profiles and must be replaced by direct viewport geometry assertions.

### PR7 — Visual cockpit polish and presentation validation

**Goal:** achieve the deliberate high-impact industrial visual finish after behavior and geometry are stable.

Scope:

- final hierarchy/spacing/contrast treatment;
- KPI typography and distance readability;
- brief state-change transitions with reduced-motion support;
- final dark/light surface balance;
- remove leftover calculator-era presentation debt;
- validate screenshots across canonical work screens;
- cross-browser Chromium/WebKit checks;
- final copy/terminology pass.

Acceptance:

- no font-size reductions below the agreed operational readability floor just to fit;
- state transitions remain understandable with animations disabled;
- key KPI values are readable at the primary 1366×768 cockpit viewport;
- no duplicate or decorative KPI pollution;
- all previous domain/E2E gates remain green.

### PR8 — Closure, debt removal and release proof

**Goal:** remove old contracts once V2 is proven.

Scope:

- retire obsolete sequential shipment storage/model code;
- remove dead `form.policy` persistence if it remains unused;
- update static architecture guards;
- update packing responsive documentation to the cockpit contract;
- add route-level release checklist;
- production deploy verification on Railway;
- verify `/api/ready` and latest commit hash;
- perform real-device/operator sanity check after PWA refresh.

Acceptance:

- no code path still reads the old progress counter;
- no old UI copy (`prochaine charge`, `unités libres`) remains where semantically incorrect;
- exact main SHA is deployed;
- Railway healthcheck is green;
- no open review threads;
- required repository checks green on exact merge head.

## Testing strategy

### Unit/domain

Mandatory coverage:

- strategy arithmetic remains unchanged;
- run creation snapshot;
- complete declaration;
- partial declaration cartons only;
- partial declaration partial-carton units only;
- cartons + partial carton units;
- normalization over one carton;
- declaration exceeding remaining units;
- declaration removal/correction;
- identical-parameter run independence;
- cadence duration estimates;
- safe integer boundaries;
- storage validator recovery.

### Component/integration

Mandatory flows:

- explicit strategy selection;
- run activation;
- reference fields cannot silently rewrite active run;
- complete declaration fast path;
- partial declaration path;
- KPI recomputation;
- correction;
- reset/new run confirmation if destructive;
- keyboard strategy interaction must either implement real radiogroup keyboard semantics or use native radio semantics instead of partial ARIA emulation.

### E2E

Canonical scenarios:

1. configure 400,000 / 480 / 50 / 60;
2. select carton strategy => 400,320 planned;
3. verify total estimate 111 h 12;
4. declare several complete loads;
5. declare a partial load (e.g. 10 cartons + 120 units);
6. verify exact declared and remaining units;
7. verify estimate recalculation;
8. correct declaration and verify deterministic restoration;
9. reload and verify active run persistence;
10. start a second identical run and prove progress isolation.

Responsive E2E must separately validate mobile behavior and working-screen zero-scroll behavior.

## Accessibility requirements

- use native form semantics wherever possible;
- avoid role emulation when a native control can express the interaction;
- all declaration inputs must have explicit accessible labels and error descriptions;
- progress must expose the unit-based truth;
- live announcements should announce confirmed declaration outcomes, not every keystroke;
- destructive reset/new-run actions require explicit confirmation if they discard declaration history;
- color is never the only carrier of variance/error state;
- reduced-motion support is mandatory.

## Performance and reliability

- no one-object-per-planned-load allocation for very large plans;
- declaration history scales with actual operator events, not theoretical plan size;
- derived KPIs use memoized/pure calculations as needed but must remain simple enough to recompute safely;
- no network dependency is introduced for the cockpit prototype;
- local persistence remains an enhancement, but the UI must be honest about its status;
- no service-worker-specific state should be used for business persistence.

## Explicit non-goals for V2

The following are intentionally excluded unless separately approved:

- direct machine/cell integration;
- live measured cadence;
- OEE/TRS calculation;
- automatic downtime detection;
- multi-user synchronization;
- backend persistence;
- operator authentication/audit identity;
- production order integration with ERP/MES;
- wall-clock ETA countdown;
- predictive performance analytics.

The architecture should not prevent these later, but V2 must not simulate them.

## Critical decisions still to preserve during implementation

The implementation must not casually change these without explicit product discussion:

- whether UI terminology remains `palette` for the reference packaging field or becomes a generic `charge` label;
- whether the existing `Carton` strategy remains the default recommendation rule or the recommendation label is removed/qualified;
- whether reference cadence is editable on an active run, and if so whether the change should be recorded as run history;
- how much declaration history is visible in the main cockpit versus a secondary panel.

These are product decisions, not details to be silently inferred by implementation.

## Merge discipline

Every implementation PR must:

- be based on current `main`;
- contain one coherent architectural step;
- include tests in the same PR as the behavior change;
- keep exact domain semantics documented;
- preserve current functionality unless that PR explicitly replaces it;
- pass the repository Quality Gate and CodeQL on the exact head;
- have all review threads resolved before squash merge;
- not be merged while required checks are pending or red.

## Definition of done

Packing Cockpit V2 is complete only when all of the following are true:

1. Production progress is declaration-based, not sequential-counter-based.
2. Complete and partial loads are accurately representable.
3. Units are the canonical progress truth.
4. Identical production runs have independent identities and histories.
5. Reference cadence in units/minute drives truthful static production estimates.
6. KPI layer exposes planned, declared, progress, remaining, cadence, estimate and variance.
7. Operator actions remain faster and more obvious than manager-only information.
8. Working landscape screens fit the complete active cockpit without document scroll.
9. Mobile remains usable through an intentional stacked composition.
10. No fake telemetry or live-performance claims exist.
11. Accessibility, responsive, unit, integration and E2E gates all pass.
12. Obsolete shipment-counter code and storage contracts are removed.
13. The exact final `main` commit is successfully deployed to Railway and `/api/ready` passes.

Only after these conditions are met should the page be considered a production-cockpit redesign rather than an upgraded calculator.
