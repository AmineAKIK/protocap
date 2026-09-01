# WS-01 — Railway production configuration hygiene

Status: **ACCEPTED DEFERRAL — not release-blocking**

This evidence record closes the release-blocking portion of WS-01 without changing production configuration. The remaining Railway namespace cleanup is intentionally deferred for owner-managed secret maintenance.

## Baseline

Production service: `protocap`  
Production branch: `main`

The connected Railway production environment exposes these application-managed variable names:

- `DEEPSEEK_API_KEY`
- `SG_LEXIQUE`
- `SG_MODULES`
- `SHIFTGUIDE_CODE`
- `VITE_DEEPSEEK_API_KEY`
- `VITE_OPENAI_API_KEY`
- `VITE_SHIFTGUIDE_CODE`

Railway-provided platform variables are intentionally omitted from this evidence list. The connected OAuth integration exposes variable names only; secret values and same-service reference expressions are redacted.

## Repository dependency result

Application-code search found no dependency on:

- `VITE_DEEPSEEK_API_KEY`
- `VITE_OPENAI_API_KEY`
- `VITE_SHIFTGUIDE_CODE`

Repository documentation mentions those names only to describe the legacy-to-canonical Railway migration path. The runtime contract consumes the canonical server-side names `SHIFTGUIDE_CODE` and `DEEPSEEK_API_KEY`.

Therefore:

- the presence of the legacy names is **not evidence of an active client-side secret leak**;
- there is no application-code reason to mutate them as part of this release;
- because Railway redacts their values/reference topology from this integration, deleting or rewriting them without owner-side visibility would create more operational risk than release value.

## Release decision

The remaining namespace cleanup is explicitly deferred. Production secrets will not be rotated, copied, deleted, or renamed by this release audit solely for cosmetic configuration consistency.

This is consistent with the release change rubric: a change that cannot be proven safe from the available evidence should not be performed merely to make the environment look cleaner.

The owner may later normalize or remove legacy variables directly in Railway with full secret/reference visibility. That maintenance is outside the critical path for this release unless new evidence shows an actual client exposure or runtime dependency defect.

## Acceptance criteria

- [x] Legacy `VITE_*` names identified.
- [x] Application code has no dependency on those legacy names.
- [x] Runtime consumes canonical server-side variable names.
- [x] No evidence of active client-side exposure was found from repository usage.
- [x] Railway OAuth visibility limitation documented.
- [x] Unsafe blind mutation rejected.
- [x] Remaining owner-managed namespace cleanup explicitly deferred.
- [x] No functional/product behavior change introduced.

## Residual risk

Using secret-like names in the Vite namespace remains avoidable configuration debt. Its practical risk is limited by the current application-code boundary: the frontend does not import those variables. This residual should be revisited if frontend environment usage changes, if build configuration changes, or when the owner performs Railway secret maintenance.

## Non-goals

- no secret rotation;
- no Railway variable mutation;
- no application feature change;
- no authentication redesign;
- no dependency upgrade;
- no Railway architecture/scaling change.
