# WS-01 — Railway production configuration hygiene

Status: **IN PROGRESS / release-blocking until production cleanup is verified**

This evidence record tracks WS-01 from the release-readiness master plan. It is intentionally narrow: align the Railway production variable namespace with ProtoCap's documented server-side secret boundary without changing product behavior.

## Baseline

Production service: `protocap`  
Production branch: `main`  
Baseline application commit: `ac68d21a72e61e28f81a069852c11849e5330d42`  
Baseline Railway deployment: `888542c1-57a2-46b0-82f9-1dc8b29830ee`  
Baseline deployment status: `SUCCESS`

The connected Railway production environment currently exposes these application-managed variable names:

- `DEEPSEEK_API_KEY`
- `SG_LEXIQUE`
- `SG_MODULES`
- `SHIFTGUIDE_CODE`
- `VITE_DEEPSEEK_API_KEY`
- `VITE_OPENAI_API_KEY`
- `VITE_SHIFTGUIDE_CODE`

Railway-provided platform variables are intentionally omitted from this evidence list.

## Repository dependency check

Application-code search found no references to:

- `VITE_DEEPSEEK_API_KEY`
- `VITE_OPENAI_API_KEY`
- `VITE_SHIFTGUIDE_CODE`

The repository does contain documentation references because `docs/shiftguide-config.md` defines the safe legacy-to-canonical Railway migration procedure. The runtime contract accepts only canonical server-side names: `SHIFTGUIDE_CODE` and `DEEPSEEK_API_KEY`.

Therefore, the legacy names are not considered an application-code dependency and their presence is not evidence of an active client-side secret leak.

## Railway reference dependency guard

A remaining production risk must be resolved before deletion: the connected Railway OAuth integration returns variable **names only** and redacts rendered values/references. This means this audit session cannot prove whether either canonical variable currently resolves from a same-service legacy reference such as:

```text
SHIFTGUIDE_CODE=${{ VITE_SHIFTGUIDE_CODE }}
DEEPSEEK_API_KEY=${{ VITE_DEEPSEEK_API_KEY }}
```

Deleting a legacy source variable while one of those canonical references still depends on it could break production readiness. For that reason, no legacy variable is deleted until the Railway dashboard/API with secret-value visibility confirms that both canonical variables are independently backed by canonical secret values or otherwise safe references.

## Required production mutation

Once the reference dependency guard is satisfied:

1. remove `VITE_SHIFTGUIDE_CODE`;
2. remove `VITE_DEEPSEEK_API_KEY`;
3. remove `VITE_OPENAI_API_KEY`;
4. preserve `SHIFTGUIDE_CODE`, `DEEPSEEK_API_KEY`, `SG_MODULES`, and `SG_LEXIQUE`;
5. trigger/accept the resulting production deployment only after the configuration state is verified;
6. verify `/api/health` and `/api/ready`;
7. run the controlled live smoke checks;
8. inspect runtime logs for startup/readiness errors;
9. record the resulting Railway deployment ID and exact Git commit.

## Acceptance criteria

- [x] Production legacy `VITE_*` secret-like names identified.
- [x] Application code has no dependency on the legacy names.
- [x] Safe migration semantics are documented in the repository.
- [ ] Canonical Railway variables confirmed independent from legacy references.
- [ ] Legacy `VITE_*` production variables removed.
- [ ] Required canonical variables remain present.
- [ ] Post-cleanup Railway deployment succeeds.
- [ ] `/api/health` succeeds post-cleanup.
- [ ] `/api/ready` succeeds post-cleanup.
- [ ] Live smoke verification succeeds.
- [ ] No functional/product behavior change observed.

## Non-goals

- no secret rotation unless required to break a legacy reference safely;
- no application feature change;
- no authentication redesign;
- no dependency upgrade;
- no Railway architecture/scaling change;
- no new environment-variable abstraction.

WS-01 remains open until the unchecked acceptance criteria are supported by production evidence.