# Architecture and trust boundaries

This document describes the architecture that exists today. It intentionally separates implemented controls from future production-hardening options.

## System shape

Protocap is a React/Vite single-page application served by an Express process. Most public prototypes are browser-side demonstrations. ShiftGuide and Céline cross a server trust boundary because they depend on protected configuration, authentication and an external AI provider.

```mermaid
flowchart TB
  subgraph Browser
    Public[Public prototype routes]
    ShiftUI[ShiftGuide UI]
    SessionStore[sessionStorage\nShiftGuide token + protected config + revisions]
    LocalStore[localStorage\nrevision-bound progress + session-lifetime Céline history]
  end

  subgraph Express
    Unlock[POST /api/shiftguide/unlock]
    Session[GET/DELETE /api/shiftguide/session]
    Chat[POST /api/celine/chat]
    Routing[Céline routing contract\nserver-only + validated]
    Authority[Céline authority resolver\nserver-owned wording]
    Memory[In-memory sessions, rate limits\n+ bounded Céline provider context]
    Static[Static Vite bundle]
  end

  Env[Railway environment\nsecrets + ShiftGuide config + optional routing]
  ProviderAdapter[DeepSeek adapter\n+ cost guard]
  Provider[DeepSeek API]

  Public --> LocalStore
  ShiftUI --> Unlock
  Unlock --> Env
  Unlock --> SessionStore
  ShiftUI --> Session
  ShiftUI --> Chat
  Session --> Memory
  Env --> Routing
  Routing --> Authority
  Chat --> Memory
  Chat --> ProviderAdapter
  ProviderAdapter --> Provider
  Provider --> Chat
  Chat --> Authority
  Authority --> ShiftUI
  Static --> Browser
```

## Frontend boundaries

The root React router owns the public application surface and delegates `/shiftguide/*` to a dedicated ShiftGuide feature boundary. `src/features/shiftguide/ShiftGuideApp.tsx` owns ShiftGuide authentication, internal routes, legacy redirects and protected route-state handling. This keeps public routing independent from protected feature internals.

Within ShiftGuide, `ShiftGuideLayout` is a shell composer rather than a browser-effects container. Desktop/mobile navigation lives in `src/components/shiftguide/ShiftGuideNavigation.tsx`; scroll restoration, route scroll reset, Céline desktop focus, mobile document locking and `visualViewport` sizing live behind `useShiftGuideShell`.

Progress presentation consumes a feature-level selector rather than rebuilding persistence semantics inside a page. `useShiftGuideProgressOverview` reads the canonical `shiftguide_progress_v3` contract, which is bound to the server-issued ShiftGuide configuration revision, applies the shared standard/choice summary rules and subscribes to progress changes.

These boundaries are intentionally pragmatic rather than framework-driven: there is no global state library or artificial component hierarchy.

## Public/browser-local boundary

Expiry Check, Logistics Call and Packing Calculator use browser persistence. This makes the flows useful as interactive demonstrations without inventing a backend that does not exist. It also means their state is not shared across browsers, users or devices.

Knowledge Base is driven by repository data. LinePulse is a visual decision-support concept backed by `src/data/linePulseMock.json`; it is not connected to a plant data source.

## ShiftGuide boundary

ShiftGuide code is part of the public client bundle, but protected operational configuration is not. The server reads `SG_MODULES`, `SG_LEXIQUE`, `SG_URGENCES`, `SG_SYSTEM_PROMPT` and optionally `SG_CELINE_ROUTING` from its environment. Unlock succeeds only when a server-side code comparison passes, after which the server returns a random session token, the protected client payload, a deterministic `configRevision` and the current `celineAuthorityRevision`.

The configuration revision is a SHA-256 identity derived server-side from the validated operational configuration: modules and action text, lexicon, emergency guidance and the additional Céline context. Object-key insertion order does not affect the result.

The browser stores the active ShiftGuide token, protected payload, expiry and both server revisions in `sessionStorage`. The server returns the same identities during session validation. A revision mismatch fails closed instead of allowing an old browser session to claim compatibility with a different procedure or AI authority protocol.

Revision-bound local data uses a separate persistent copy of the current configuration revision. Progress is stored as format version `3` with its `configRevision`. Existing v1/v2 progress has no trustworthy provenance and is deliberately discarded on the first revision-aware unlock.

Céline conversation history has a different lifetime from procedure progress. It may be persisted locally while the current ShiftGuide session is active so navigation and reloads can resume the conversation, but the authentication boundary owns its lifecycle. Every successful unlock starts with fresh Céline memory, and every certain session termination or invalidation — logout, local expiry, server `401`, or config/authority revision mismatch — clears the conversation. Legacy persistent Céline history from earlier builds is also removed. A transient network failure during validation does not erase memory because it does not prove that the server session ended. Operator progress is not cleared by these conversation-lifecycle events.

### Runtime contracts

The server and client use the same ShiftGuide runtime validator from `shared/shiftGuideContract.js`. It enforces module/action uniqueness and complete typed safety content.

Céline routing has a separate server-only compatibility contract in `server/celineRoutingContract.mjs`. A routing spec declares route IDs, labels, selection guidance, ordered action IDs, clarification questions and classifier rules. Validation happens only after ShiftGuide itself is valid, because routing validity depends on the exact configured action catalog.

Every declared route must resolve entirely against the active ShiftGuide action IDs. Duplicate route IDs, duplicate action IDs inside one route, malformed clarifications or empty classifier rules are rejected. When ShiftGuide is enabled, an incompatible routing spec throws during application construction: the server does not silently omit unsupported capabilities.

When `SG_CELINE_ROUTING` is absent, `server/celineRoutingDefault.mjs` provides the repository's current routing contract. Tests and alternate deployments can provide their own complete routing spec without changing browser data or the authority engine.

The `celineAuthorityRevision` is content-addressed from the validated routing specification plus the decision-protocol revision. Changing routing semantics therefore changes the authority identity automatically; there is no manual version constant to remember to bump.

## Server process boundary

`server.mjs` is the production process entrypoint only. It reads environment values, resolves defaults, creates the DeepSeek adapter and in-memory runtime stores, starts periodic cleanup, then calls `listen`.

The Express application itself is built by `createServerApp` in `server/app.mjs`. The factory receives explicit dependencies and does not open a port or schedule background work. Tests can therefore instantiate a complete API with isolated stores, explicit routing and a deterministic provider, then exercise it over a real ephemeral HTTP socket.

This keeps process lifecycle concerns separate from request handling while avoiding a framework or dependency-injection container.

## Céline boundary

Céline is server-mediated and the model is not an operational-content authority:

1. the browser network client sends only the latest operator turn with the ShiftGuide bearer token; local assistant/checklist history is not retransmitted for provider context;
2. the server verifies the session, request shape and rate limits, then combines the latest turn with a bounded server-owned semantic context for that session;
3. that provider context contains at most four previous operator turns plus the corresponding closed Protocap-authorized decisions, never rendered checklist/action state;
4. the server-owned domain engine resolves routine operational intents before the provider path, so deterministic interactions do not consume model calls;
5. the server owns the classification prompt, provider credential and validated routing contract;
6. `server/providers/deepSeekProvider.mjs` owns the DeepSeek-specific request/response envelope, timeout and process-local provider cost guard;
7. before external network work starts, the provider guard checks prompt/history size, rolling provider-call frequency and rolling provider-reported token consumption;
8. the provider selects a compact decision such as a route ID, clarification ID, lexicon key, emergency topic or `unknown`;
9. `shared/celineContract.js` normalizes only trusted decision fields (`kind` and, when required, `id`) and discards any additional provider prose instead of allowing it to cross the authority boundary;
10. `server/celineAuthority.mjs` resolves the decision against the current validated configuration and routing contract, then renders all operator-facing wording, checklist content and follow-up text;
11. malformed or unauthorized model decisions degrade to a deterministic server-owned safe response, while genuine provider/network/rate-limit/timeout failures retain their transport error semantics;
12. `/api/celine/chat` returns the Protocap-owned `{ message, checklist, followUp }` DTO to the browser.

The provider-context store is process memory keyed by the ShiftGuide session token. It is deleted with the session on logout/revocation/expiry and is naturally lost on process restart. The browser cannot inject assistant messages into this context: only the server records the closed decision it actually accepted.

The prompt and resolver derive their route/clarification semantics from the same declarative contract. There is no second list of hard-coded action IDs hidden in the prompt or authority engine. `decisionGuide` values and classifier rules guide model selection, while action text remains server-owned and is not copied into the provider prompt.

Procedure text, lexicon definitions and emergency wording do not need to be copied into the provider prompt to be rendered. Provider-authored prose is ignored rather than shown to the operator. The server remains the only operational-content authority.

`SG_SYSTEM_PROMPT` remains non-authoritative site context. It may influence classification but cannot introduce new routes, instructions or operator-facing responses.

The separate data-governance record in `docs/ai-data-governance.md` documents exactly what Protocap sends to DeepSeek, what is not sent, and the independent browser speech-recognition boundary. The provider cost envelope is documented separately in `docs/celine-cost-guard.md`. These documents deliberately distinguish controls Protocap can enforce from provider/browser retention and processing terms that require deployment-specific review.

## Security controls implemented today

- timing-safe secret comparison;
- random 256-bit session tokens;
- eight-hour session TTL;
- reactive browser expiry enforcement with foreground revalidation;
- server-issued configuration revision enforced across session and progress lifecycles;
- Céline conversation memory explicitly scoped to the authenticated ShiftGuide session and cleared on certain session termination/invalidation;
- content-addressed Céline authority/routing revision with conversation-memory invalidation;
- fail-fast compatibility validation between Céline routes and the active procedure action catalog;
- browser-to-server Céline requests minimized to the latest operator turn;
- bounded server-owned provider context containing only operator text plus closed decision IDs;
- provider context deleted with the associated server session;
- provider decision normalization that discards free-form operator content;
- server-owned rendering of procedure actions, clarification wording, lexicon facts and emergency guidance;
- safe deterministic fallback for malformed or unauthorized model decisions;
- deterministic domain routing before the external provider path;
- independent provider-call and rolling provider-token cost guards;
- 32 KiB aggregate classifier-prompt ceiling and bounded provider-history input;
- per-IP unlock throttling, per-IP chat throttling and per-session chat throttling;
- 128 KB JSON body limit plus a 2,000-character provider-turn limit;
- generic client-facing provider/server errors;
- CSP, frame denial, MIME sniffing protection, restrictive permissions policy and referrer policy;
- `Cache-Control: no-store` for API routes;
- HSTS when the request is secure;
- DeepSeek request timeout and 160-token default completion cap.

## Deliberate current trade-offs

### Process-local session state

Sessions, rate-limit buckets, compact Céline provider context and provider cost guard are process-local to the Express runtime. A restart invalidates active sessions/provider context and resets the cost guard. Multiple replicas would not share state. The current hosted demonstrator does not pretend otherwise.

A distributed store or provider-side shared quota would become justified if horizontal scaling, durable sessions or cross-instance throttling became real requirements.

### Provider availability and governance

The DeepSeek adapter is the only production provider today. The application boundary is provider-independent, but no artificial multi-provider abstraction or fallback routing is implemented because there is no current product requirement for it.

Protocap can minimize the data it sends but cannot create contractual guarantees about DeepSeek retention, storage location or international transfers. Those concerns are deployment governance and are recorded in `docs/ai-data-governance.md` rather than implied by code.

### Routing governance

Routing is configurable but intentionally not editable from the browser or an admin UI. It is server-side deployment configuration and must be changed atomically with any procedure changes it depends on. A future production workflow may add schema tooling or reviewed configuration publishing, but the runtime invariant is already enforced today.

## Deployment boundary

Railway hosts the current public demonstrator. CI and deployment are separate concerns: GitHub Actions proves repository checks pass; it does not by itself prove the external Railway deployment completed successfully.
