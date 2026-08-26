# Server configuration budgets

Protocap treats ShiftGuide and Celine configuration as trusted deployment input, but trusted input is still bounded.
These limits are safety fuses against accidental configuration growth, not product sizing targets.

## Invariant

A configuration must remain finite in both structure and derived provider context. The server fails during startup when a configured structure exceeds its declared budget instead of accepting an unbounded configuration and failing later under memory or provider pressure.

## Central contract

All numeric configuration budgets live in `shared/configBudgets.js` so ShiftGuide validation, Celine routing validation and prompt construction use one source of truth.

Current safety budgets include:

- up to 500 top-level modules;
- up to 200 submodules per choice module;
- up to 500 actions per module/submodule and 10,000 actions in total;
- up to 2,000 lexicon entries;
- identifiers up to 256 characters;
- short labels up to 1,024 characters;
- general text fields up to 16 KiB characters;
- `systemPromptExtra` up to 64 KiB characters, subject to the stricter aggregate prompt ceiling below;
- up to 1,000 Celine routes and 500 clarifications;
- the pre-existing routing limits remain 100 classifier rules and 200 action IDs per route;
- the final Celine classifier system prompt is capped at 32 KiB measured as UTF-8 bytes.

Emergency collections are also bounded independently.

## Why both local and aggregate limits exist

Local limits stop a single field or collection from becoming pathological. They are not sufficient by themselves: many individually valid modules or routes can still create excessive aggregate cost.

ShiftGuide therefore also caps total actions, and Celine prompt construction independently caps the final UTF-8 payload after all routing, lexicon and supplemental context have been rendered. The aggregate prompt ceiling is intentionally much smaller than the sum of all individual configuration limits because the provider receives only the compact routing/classification projection, not full protected procedure content.

## Startup behavior

These checks are fail-start checks. Invalid or oversized deployment configuration is rejected before the server begins serving ShiftGuide as ready. Error messages identify the offending path and budget where possible.

After validation, ShiftGuide and Celine routing configuration are projected into canonical runtime objects containing only fields understood by Protocap. Unknown deployment metadata remains tolerated at input for compatibility, but it is ignored by runtime behavior, semantic revisions, provider context and browser payloads.

The prompt-size guard is deliberately enforced inside `buildCelineSystemPrompt()` as a final defense even when that function is invoked outside the normal validated startup path.

## Runtime provider budget

Configuration size is only one part of provider cost control. `server/celineCostGuard.mjs` independently bounds provider-call frequency, rolling provider-reported token usage and provider-history size before network work starts. See `docs/celine-cost-guard.md` for that runtime contract.

## Compatibility boundary

No Railway variable or secret must change for these defaults to take effect. Existing deployments use the default provider budgets unless the server-only tuning variables are explicitly configured.

An existing `SG_SYSTEM_PROMPT`, lexicon or routing override that makes the derived classifier prompt exceed 32 KiB will fail startup. This is intentional: a classifier prompt that large is outside the cost envelope of the current demonstrator and should be reduced rather than silently accepted.

## Deliberate non-goals

These budgets do not:

- replace the existing `128kb` HTTP JSON request-body limit;
- define DeepSeek's model context window;
- provide billing or per-user quotas;
- coordinate provider budgets across multiple server instances;
- change ShiftGuide or Celine business semantics.

The provider guard is a conservative application safety boundary. It complements, rather than replaces, DeepSeek account-level limits and operational monitoring.
