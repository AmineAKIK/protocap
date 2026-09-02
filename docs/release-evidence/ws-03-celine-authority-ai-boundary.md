# WS-03 — Céline authority and AI-boundary evidence

**Status: COMPLETE — code, tests, documentation, and exact production deployment verified**

## Scope

WS-03 audits Céline as a constrained decision-support boundary. The objective is not to make the model an operational authority or to introduce provider redundancy, shared infrastructure, or a new product surface. The defensible runtime claim is narrower: the model may classify or route within a closed contract, while Protocap owns canonical operational actions, wording, state transitions, and fallback behavior.

## Findings closed

### 1. Provider authority is catalogue-first

PR #93, merged as `14d1f2834bf7d1f3deca71a873dd5d6344fae5de`, closed an implicit-authority path in which provider `route` and `clarify` IDs could reach hard-coded domain semantics before membership in the active routing catalogue was proven.

The server now authorizes provider IDs against the active `celineAuthority` first. Undeclared route or clarification aliases fail to the server-owned safe fallback instead of becoming an alternate implicit provider catalogue. Adversarial HTTP coverage includes known internal aliases omitted from a valid alternate routing contract.

### 2. Provider context records server-approved authority

PR #94, merged as `4ad444e64815130869c8bd460c131fa2502a5a6f`, closed two provider-history integrity gaps:

- when the domain engine remaps an authorized provider suggestion to a safer canonical route based on server-owned operational state, the bounded provider history now records the canonical resolved decision rather than the model's rejected variant;
- deterministic internal clarification IDs that are not part of the provider-facing catalogue remain server-internal and are represented as `unknown` if a provider-shaped context entry is needed.

Second-turn HTTP tests verify both behaviors against the actual history passed to the provider adapter.

### 3. Provider token budget wording matches runtime semantics

`CELINE_PROVIDER_TOKENS_PER_HOUR` is a rolling request-admission threshold based on provider-reported usage already recorded by the running process. Usage becomes known only after a successful response, so an already-admitted request can move the recorded total above the configured threshold; subsequent provider work is then blocked until rolling usage falls below it.

The cost-guard documentation now states this explicitly rather than describing the setting as a reservation-based hard ceiling. No shared quota service, reservation mechanism, or other infrastructure was added because the current single-replica demonstrator does not require it.

## Audit matrix

| Audit item | Result | Evidence |
| --- | --- | --- |
| Deterministic domain handling before provider use | PASS | `createServerApp` calls `handleBeforeProvider` first and returns immediately for handled interactions; HTTP tests verify greetings and deterministic flows do not call the provider. |
| Provider history construction and context minimisation | PASS | The browser contributes only the latest validated user turn to the provider path; server context is bounded to four semantic turns and, after PR #94, contains only provider-valid server-approved decisions. |
| System prompt ownership and server-only boundary | PASS | `buildCelineSystemPrompt` is server-owned, limits the model to closed JSON decisions, and labels site prompt extras as non-authoritative context. |
| Semantic index behavior | PASS | Index entries come only from canonical ShiftGuide actions; a context/scope boost cannot make an action eligible without a real semantic token match. |
| Routing contract validation | PASS | Route/clarification IDs, action references, duplicates, classifier rules, and budgets are validated against the active ShiftGuide configuration; incompatible routing fails application construction when ShiftGuide is enabled. |
| Provider decision parsing | PASS | Only the closed decision kinds `route`, `clarify`, `lexicon`, `emergency`, and `unknown` cross the parser; extra provider prose is discarded. |
| Canonical authority resolution | PASS | PR #93 enforces active-catalogue authorization before domain interpretation; server state remains free to remap a permitted route to the canonical safe variant. |
| Safe fallback behavior | PASS | Malformed or unauthorized model decisions degrade to `CELINE_SAFE_FALLBACK_RESPONSE` or another server-owned `unknown` response rather than provider-authored prose. |
| Operational state transitions | PASS | State is stored and mutated only from server domain-engine results; tests prove provider route variants cannot override known OC/tank state. |
| Checklist/action hydration | PASS | Provider decisions select IDs only; operator checklist text, notes, labels, lexicon definitions, and emergency guidance are hydrated from server-owned canonical data. |
| Cost guard and token/request budgets | PASS with documented demo boundary | Provider call rate, reported-token admission threshold, prompt/history input budgets, user-message size, and completion cap are bounded and tested. The guard is intentionally process-local for the current one-replica deployment. |
| Provider model/config observability | PASS | Startup telemetry records non-secret model, completion cap, call-rate limit, and token threshold; provider telemetry records structural outcome/usage metadata without prompt, operator, token, or API-key content. |
| Prompt-injection architectural boundary | PASS | User/model text cannot create a new canonical action, checklist item, route, clarification, lexicon fact, or emergency instruction outside the validated server catalogue. No impossible model-level immunity guarantee is claimed. |
| Unsupported multi-provider/failover claims | PASS | DeepSeek remains the only production provider and documentation does not claim provider redundancy or failover that does not exist. |

## Exact production verification

The final runtime change for WS-03 was deployed automatically to Railway as deployment `f862233a-ef51-4e5a-be57-66f95ae09a2b`, from exact `main` commit `4ad444e64815130869c8bd460c131fa2502a5a6f`.

Verified deployment evidence:

- Railway deployment status: `SUCCESS`;
- startup reported `shiftGuideConfigured: true` and `deepSeekConfigured: true` without exposing either value;
- startup model/config telemetry reported `deepseek-v4-flash`, completion cap `160`, provider-call limit `8/min`, and reported-token threshold `100000/h`;
- Railway healthcheck request `GET /api/ready` completed with HTTP `200` in 3 ms.

The release-candidate live gate in WS-18 remains responsible for the final external smoke of both `/api/ready` and `/api/health`; WS-03 does not claim that independent final-release probe has already been completed.

## Exit criteria

- **AI failure cannot silently become operational instruction:** CLOSED. Provider output is parsed into a closed decision shape and all operator-facing operational content is server-owned.
- **Contract violations fail safely:** CLOSED. Undeclared or malformed provider decisions do not reach operational authority and degrade to deterministic server-owned fallback behavior.
- **Documentation accurately separates deterministic, model-assisted, canonical, and network-dependent behavior:** CLOSED. The provider boundary, process-local context/cost limits, external provider dependency, and token-threshold semantics are explicit.

## Residual boundaries — not WS-03 blockers

- DeepSeek availability, retention, storage location, and contractual data-governance terms remain external deployment-governance concerns; Protocap only controls the data it sends.
- Provider context and cost accounting are process-local and intentionally match the current single-replica demonstrator. Horizontal scaling would require shared-state reconsideration before being enabled.
- Readiness proves that validated configuration and a callable provider adapter were constructed; it does not perform a live DeepSeek credential or network transaction.
- Final public `/api/health` and full release-candidate smoke verification belong to WS-18.

**WS-03 release decision: CLOSED.**
