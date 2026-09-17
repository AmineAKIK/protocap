# PR-03 — temporal contract and validation evidence

Base: PR-02 `e9784980433cc871e956f0cce647e8f835e860b5`. Initial incomplete candidate: `375abcd08889ea485a41fd10b5ffdb8fd86e035d`. Final SHA, CI results and review are recorded on PR #176; this document is not an assertion that an unexecuted check passed.

## Scope and ownership

F01 and the PR-03 portions of F02/F04/F14/F22/F24; T01/T02/T03/T04/T05/T09/T16/T42/T43. PR-04 still owns the live clock and wake-up refresh. PR-05/06 own atomic persistence, failed-write recovery, versioned migration and occurrence identity. PR-03 validates and prepares all values before the first legacy setter; it does NOT make those two writes atomic or claim that failed writes are recovered.

## Correction of the first candidate

Its Quality Gate failed with three Node tests: the E2E was not selected, the actual page still used its old handlers/UTC prefill, and the temporal adapter imported an undeclared polyfill while static tests described a different implementation. CodeQL success was not sufficient. The candidate was not merged. The corrected patch wires the real page and both forms, declares the dependency, selects the E2E in CI, and adds real-page regression tests. No existing assertion is removed to conceal these failures.

## Temporal implementation decision

Use `@js-temporal/polyfill` **0.5.1**, explicitly pinned and locked by npm, rather than implementing a custom inverse IANA conversion algorithm from sampled `Intl` offsets. The library handles calendar arithmetic and transition resolution; the small adapter owns accepted input grammar, named-zone validation, gaps, explicit earlier/later choice and output bounds. New runtime dependencies and the complete graph are audited. This deliberately supersedes the initial incorrect “Intl only / no date dependency” description and implementation-specific assertions; tests now verify the declared implementation, dependency integrity and its behavior.

Primary references: https://tc39.es/proposal-temporal/docs/timezone.html and https://github.com/js-temporal/temporal-polyfill/releases/tag/v0.5.1 .

## Contract

`datetime-local` is a wall-clock minute, never a sliced UTC string. The browser's named zone is captured when the form opens and shown to the operator. A nonexistent wall time is rejected. A repeated time requires an explicit occurrence/UTC-offset choice, reset when the date changes. Date/future/chronology validation runs again on submission with the current clock; HTML attributes are not the authority.

New replacements use `calendar-days-v1`, retaining calendar-day addition in the captured zone. The expiry boundary follows compatible calendar arithmetic (earlier on a repeated boundary, forward across a missing boundary); intervention input never silently adopts either. Five days can be 119/121 elapsed hours. The progress bar uses the stored start/end instants, not days multiplied by 24. Zone/rule provenance is recorded only for new events.

All date calculations and field validations finish before either setter. Errors preserve the draft, announce once after submission and associate focus/aria-invalid/aria-describedby with the failing field. The form prevents a second successful submission before unmount. This local guard is not a cross-tab transaction.

## Historical data and compatibility

No blanket +2-hour correction, invented time zone, timestamp rewrite or storage-key migration. Existing timestamps without provenance cannot be reliably repaired. Structurally readable Expiry data is retained even when a date is invalid, a block is missing, or validity metadata is unknown. Semantic checks produce an explicit unknown state, never green and never mislabeled as a known expiration. Invalid dates have safe display helpers; absent lines have an empty-state screen. Unclassifiable history remains visibly separate instead of disappearing from time-based groups. A state-only fallback is labeled as state without a recorded declaration, not as an actual event.

This is not general corrupt-JSON recovery: the legacy hook's initialization writes, unrecoverable structures and version handling remain PR-05/06. Logistics and Packing validators are unchanged. Readability of suspicious legacy data does not grant permission to mutate it.

## Test mapping

- `time.test.ts`: round trips in UTC, Paris summer/winter, New York, Kathmandu; strict calendars; gaps/overlaps including Lord Howe and Apia; output bounds; 119/121-hour intervals.
- `declaration.test.ts`: pure non-mutating preflight, future, chronology, field bounds, unknown statuses, preservation of legacy evidence and calendar progress.
- `DeclarationForm.test.tsx`: accessible errors, focus, draft and occurrence reset.
- `ExpiryCheckPage.test.tsx`: real hook/page integration, both successful paths, zero writes on rejected input, remount and safe rendering of suspicious data.
- `e2e/expiry-time.spec.ts`: deterministic clock, browser zone matrix, both real writes and reload, future rejection, explicit DST resolution and suspect history. Selected by `test:e2e:expiry` on desktop/mobile Chromium and WebKit. Future-error paths include axe checks and document-overflow assertions.
- `temporalRegression.test.mjs`: no UTC slicing, real-page wiring, reviewed Temporal boundary and explicit pinned/installed dependency.

## Validation and rollback

A green final PR must include full repository checks, unchanged coverage floors with the new critical paths included, both audits, Docker build, all existing browser suites, new Expiry suites, CodeQL and a separate critical review of the final SHA. An initial red run is retained as evidence, not relabeled as a passed run. Current execution results belong in the PR and preparation report.

No user data migration occurs. Prefer a forward correction or temporarily disable declarations if needed; do not restore the vulnerable time entry or rewrite stored history. Reverting to the old UI is unsafe for malformed retained records and is not a tested recovery procedure. Production/deployment verification remains separate from branch validation.
