# WS-01 — Railway production configuration hygiene

Status: **COMPLETE — production verified healthy**

This evidence record closes WS-01 after the Railway production secret namespace was normalized and the resulting runtime configuration was verified through deployment readiness.

## Baseline

Production service: `protocap`  
Production branch: `main`

The initial Railway production environment contained the canonical server-side names:

- `DEEPSEEK_API_KEY`
- `SHIFTGUIDE_CODE`

and the legacy secret-like names:

- `VITE_DEEPSEEK_API_KEY`
- `VITE_OPENAI_API_KEY`
- `VITE_SHIFTGUIDE_CODE`

`SG_MODULES`, `SG_LEXIQUE`, and `RAILWAY_DEPLOYMENT_DRAINING_SECONDS` were also present and are intentionally retained.

The connected Railway OAuth integration exposes variable names but redacts secret values and reference expressions, so the initial dependency topology could not be proven from the connector alone.

## Repository dependency result

Application-code search found no dependency on the legacy `VITE_*` secret names. The runtime consumes only the canonical server-side names `SHIFTGUIDE_CODE` and `DEEPSEEK_API_KEY`.

Repository documentation mentions the legacy names only as migration history/guidance. The browser-facing application does not consume those secrets through `import.meta.env` or another Vite client-secret path.

## Production cleanup and incident evidence

The three legacy `VITE_*` variables were removed from Railway production.

The first rollout after that cleanup failed the `/api/ready` healthcheck with HTTP `503`. The server process itself started, so Railway correctly prevented an unhealthy candidate from becoming the active deployment.

Owner-side inspection then confirmed the concrete cause: the canonical `SHIFTGUIDE_CODE` and `DEEPSEEK_API_KEY` variables still held same-service references to the deleted legacy variables. Once those source variables were removed, the canonical variables resolved to empty values.

WS-02 then added presence-only startup flags, and commit `ad35662d693917a0d0cf7112bd9e0eb6bcb41377` was deployed while the canonical variables were still empty. That failed deployment confirmed:

- `shiftGuideConfigured: false`
- `deepSeekConfigured: false`
- `/api/ready`: `503`

No secret value, length, prefix, hash, or reference expression was logged.

## Recovery and final verification

The canonical variables were rewritten in Railway with their real direct server-side values. The credentials themselves were not copied into repository content or logs and were not disclosed through this audit.

The subsequent production deployment:

- deployment: `f7534d78-7182-40c8-83eb-4a53317e06d0`
- commit: `ad35662d693917a0d0cf7112bd9e0eb6bcb41377`
- status: `SUCCESS`

reported:

- `shiftGuideConfigured: true`
- `deepSeekConfigured: true`
- `/api/ready`: HTTP `200`

The current application-managed Railway namespace contains the canonical secret names and no legacy `VITE_*` secret names.

## Acceptance criteria

- [x] Legacy `VITE_*` names identified.
- [x] Application code has no dependency on those legacy names.
- [x] Runtime consumes canonical server-side variable names.
- [x] Legacy `VITE_DEEPSEEK_API_KEY`, `VITE_OPENAI_API_KEY`, and `VITE_SHIFTGUIDE_CODE` removed from production.
- [x] Canonical variables made independent of the removed legacy references.
- [x] No secret plaintext recorded in repository evidence or runtime logs.
- [x] Failed readiness rollout retained as operational evidence rather than hidden.
- [x] Railway healthcheck prevented the unready candidate from being promoted.
- [x] Recovery deployment reached `SUCCESS` with both canonical capabilities configured.
- [x] `/api/ready` returned HTTP `200` after recovery.
- [x] No application feature, authentication model, or deployment architecture change was introduced by WS-01.

## Release decision

WS-01 is closed. The production namespace now matches the documented trust model: protected credentials use canonical server-side names, no secret-like `VITE_*` variables remain, and the deployed runtime proves both required capabilities are present.

The failed intermediate rollout is not treated as a hidden exception. It demonstrates why dependency/reference checks are required before deleting source variables and why `/api/ready` is an effective deployment gate.

## Residual risk

The Railway OAuth integration still cannot retrieve secret plaintext or reference topology. That tooling limitation remains relevant for future secret maintenance, but it is no longer a release blocker because the current namespace is canonical and the production runtime has been verified healthy.

## Non-goals

- no credential rotation solely for namespace cleanup;
- no secret values committed to the repository;
- no application feature change;
- no authentication redesign;
- no dependency upgrade;
- no Railway architecture/scaling change.
