# PR-03 — temporal contract and validation evidence

Status: implementation candidate. The final SHA, CI URLs and execution results belong in the pull request after the candidate runs.

## Scope

PR-03 owns F01, the PR-03 part of F02/F04/F14/F22/F24 and T01/T02/T03/T04/T05/T09/T16/T42. It does not implement PR-04's live clock, PR-05/06 atomic persistence/migration, or rewrite legacy timestamps.

## Contract

- `datetime-local` is a wall-clock value. `formatLocalMinute` and `parseLocalMinute` are the only new conversion boundary for Expiry declarations.
- The active IANA time zone is captured explicitly on each new replacement/refill event. A repeated wall time requires an explicit earlier/later choice; a nonexistent wall time is rejected. UTC-offset strings are not accepted as time-zone identifiers.
- New replacement validity is `calendar-days-v1`: calendar days in the captured zone, preserving the pre-existing rule. Expiration is stored as an instant. Around DST, five days may be 119 or 121 elapsed hours. The progress percentage uses the stored start/end instants rather than `validityDays * 24`.
- Declaration preflight validates the selected line/block, local date, future instant, chronology, operator/reference/comment limits and current temporal coherence before the page invokes either setter. A refill additionally requires the active block to still be valid.
- Invalid, future-installed or internally contradictory elements produce `unknown`, never green and never silently reclassified as expired. Legacy elements without time-zone/rule metadata remain readable; their timestamps are not shifted or rewritten.
- Public-storage structural validation deliberately keeps suspicious legacy timestamp strings readable for PR-06 recovery. Semantic status/declaration validation is fail-safe instead of deleting those records.

## Historical recovery limit

PR-03 performs no migration and no blanket `+2 h` correction. Existing records do not contain enough provenance to prove which entries were affected by the former UTC-prefill bug. Suspicious history is therefore preserved for inspection and PR-06 recovery work.

## Test mapping

- T01/T02/T03/T09: `src/features/expiry/time.test.ts`.
- T03/T04/T05/T09/T16: `src/features/expiry/declaration.test.ts`.
- T42: `src/features/expiry/DeclarationForm.test.tsx` plus the browser scenario.
- Browser integration: `e2e/expiry-time.spec.ts`, selected by `test:e2e:expiry` and CI.
- Static regression guard: `tests/temporalRegression.test.mjs` prevents the original UTC slicing and untracked time-library introduction.

## Rollback/recovery

No existing timestamp or storage key is migrated in this PR. If the new declaration path regresses, prefer a forward fix or disable that mutation path. Do not restore the known UTC-prefill conversion and do not rewrite stored history as rollback.
