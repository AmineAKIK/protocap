# Céline v3 — Architecture and implementation plan

Status: implementation plan

Branch: `feat/celine-v3-architecture`

## 1. Objective

Build Céline as an operational assistant that is simultaneously:

- natural to use in French on the shop floor;
- precise on procedure questions;
- deterministic for operational state transitions;
- unable to invent authoritative procedure content;
- cheap enough that routine use does not depend on a premium model;
- measurable through domain-quality, latency and token/cost telemetry;
- compatible with the current ShiftGuide trust boundaries, session model and revision semantics.

The target principle is:

> The LLM understands language. The domain engine decides. The ShiftGuide authority supplies canonical content. The UI executes and presents the workflow.

This plan deliberately does **not** restore the former design where the provider received complete procedure text and generated operator-facing checklists.

## 2. Current-state diagnosis

The current implementation has strong security and data-governance boundaries but an overly narrow dialogue protocol.

Today:

1. the browser sends only the latest operator message;
2. the server adds a bounded semantic history;
3. DeepSeek returns one closed decision: `route`, `clarify`, `lexicon`, `emergency`, or `unknown`;
4. the server resolves that decision against canonical ShiftGuide configuration;
5. a route is rendered as the complete checklist for the route.

This gives strong authority control, but it creates four product limitations:

- the model cannot express fine-grained questions such as “what sampling do I need to do?”;
- route selection and route presentation are coupled, so a matched route becomes a full checklist dump;
- conversation history acts as a weak substitute for explicit operational state;
- deterministic UI events such as known shortcut buttons, workflow completion and yes/no answers can still trigger provider calls.

A second structural issue is that current progress is keyed by template action ID, while real operations contain repeated *occurrences* of the same workflow/action across several OCs, tanks or shifts.

## 3. Non-negotiable invariants

These invariants must remain true throughout the migration.

### 3.1 Authority

- Provider-authored procedure text is never shown as authoritative operational content.
- Canonical action text, notes, lexicon definitions and emergency content remain server-owned.
- Every action/workflow ID returned by a provider is validated against the active ShiftGuide authority before use.
- The server rejects impossible or unauthorized state transitions even when the provider selects a syntactically valid identifier.

### 3.2 Data minimization

- Do not send full rendered checklists or full browser conversation history to the provider.
- Do not send more operational content than needed for the current interpretation task.
- Prefer compact semantic indexes (`id`, topics, aliases, phase) over full action text for provider disambiguation.
- Do not log operator text, auth tokens, provider secrets or protected procedure text.

### 3.3 Product truth

- “Nouveau poste” must mean a real new shift occurrence, or it must be renamed.
- A workflow shown in Céline and the same workflow shown in ModuleView must share one source of truth.
- A template action such as `doc_01` must not be treated as permanently complete across several OC occurrences.

### 3.4 Cost

- Deterministic interactions do not call the LLM.
- Provider output is strongly bounded.
- Token usage and estimated provider cost are observable without logging sensitive text.
- Model selection is driven by Céline-specific evaluation, not generic benchmarks.

## 4. Target architecture

```text
Operator input
     |
     v
+--------------------------+
| Fast deterministic paths |
| shortcuts / yes-no /     |
| workflow nav / lexicon   |
+------------+-------------+
             | unresolved natural language
             v
+--------------------------+
| Céline NLU adapter       |
| intent + entities only   |
+------------+-------------+
             |
             v
+--------------------------+
| Céline domain engine     |
| explicit operational    |
| state + transition rules |
+------------+-------------+
             |
             v
+--------------------------+
| ShiftGuide authority     |
| canonical actions/facts  |
+------------+-------------+
             |
             v
+--------------------------+
| Presentation planner     |
| message/question/step/   |
| targeted answer/full list|
+------------+-------------+
             |
             v
          Céline UI
```

### Ownership boundaries

**NLU/provider owns:** interpretation of free-form language, intent, semantic target and extracted entities.

**Domain engine owns:** known facts, missing prerequisites, workflow transitions, current workflow occurrence, current step, completion and allowed next transitions.

**Authority owns:** canonical action text, notes, lexicon, emergency wording, workflow/action membership.

**Presentation layer owns:** whether to show one current action, a question, a targeted set of actions or an explicitly requested full checklist.

## 5. Target domain model

Introduce a server-tested operational state contract before changing the prompt.

```ts
interface CelineOperationalState {
  shiftRunId: string | null;
  context: 'debut_equipe' | 'debut_oc' | 'production' | 'evenement' | 'cloture' | 'tri' | 'reprise';
  lineMode: 'unknown' | 'stopped' | 'production';

  oc: {
    status: 'unknown' | 'none' | 'open' | 'closed';
    runId: string | null;
  };

  tank: {
    status: 'unknown' | 'none' | 'open' | 'closed';
    runId: string | null;
  };

  changeType: null | 'lot' | 'pays' | 'formule' | 'format';

  activeWorkflow: null | {
    runId: string;
    workflowId: string;
    actionIds: string[];
    currentIndex: number;
  };

  pendingQuestion: null | {
    id: string;
    field: string;
    answerType: 'boolean' | 'enum' | 'text';
    allowedValues?: string[];
  };
}
```

The first implementation may keep this state process-local to match the current demonstration architecture. The abstraction must nevertheless make persistence replaceable later.

## 6. Workflow occurrence model

Replace template-only progress semantics with explicit workflow occurrences.

Proposed shape:

```ts
interface WorkflowRun {
  id: string;
  shiftRunId: string;
  workflowId: string;
  startedAt: number;
  completedAt: number | null;
  currentIndex: number;
  actions: Record<string, 'pending' | 'validated' | 'na'>;
}
```

Requirements:

- the same workflow can be executed repeatedly in one shift;
- each OC/tank occurrence has independent progress;
- Céline and ModuleView read/write the same `WorkflowRun`;
- old `shiftguide_progress_v3` data is migrated deliberately, not silently interpreted as occurrence-aware data;
- storage revision/version moves to a new version with explicit migration tests.

## 7. New NLU contract

Do not let the provider choose final combined routes. It should describe meaning.

Initial intent set:

```text
conversation
start_workflow
resume_workflow
navigate_workflow
query_procedure
explain_current
provide_answer
lexicon
emergency
unknown
```

Suggested provider result:

```json
{
  "intent": "query_procedure",
  "target": "sampling",
  "workflowHint": "production",
  "entities": {}
}
```

or:

```json
{
  "intent": "start_workflow",
  "target": "debut_oc",
  "entities": {
    "previousOcClosed": null
  }
}
```

Provider output remains closed JSON. It must not include operator-facing prose or procedure text.

### Fast paths before provider

The request pipeline must first resolve these deterministically:

- suggestion/shortcut commands;
- yes/no or enum answer to an active server question;
- next/previous/show-all/resume on an active workflow;
- workflow action validated/N/A/completed events;
- exact lexicon lookup;
- greeting/thanks/basic acknowledgement;
- exact semantic action lookup when confidence is unambiguous.

Only unresolved language reaches the provider.

## 8. Semantic action index

Add a compact semantic index instead of a vector database in v3.

Recommended shape:

```ts
interface CelineSemanticAction {
  actionId: string;
  workflowId: string;
  topics: string[];
  aliases: string[];
  phase?: string;
}
```

Example:

```json
{
  "actionId": "prod_02",
  "workflowId": "production",
  "topics": ["microbiologie", "prelevement"],
  "aliases": ["prélever", "prélèvement", "échantillon", "microbio"]
}
```

Search flow:

1. normalize message;
2. filter by current operational context/workflow if known;
3. score aliases/topics deterministically;
4. return immediately on a single high-confidence match;
5. if ambiguous, send only compact candidate metadata to the NLU provider;
6. authority resolves selected IDs to canonical text.

Do not add embeddings/vector infrastructure unless the golden suite later proves the compact index insufficient.

## 9. Server response contract

Replace the overloaded `{ message, checklist, followUp }` shape with discriminated response types.

Conceptual target:

```ts
type CelineResponse =
  | { type: 'message'; message: string }
  | {
      type: 'question';
      message: string;
      questionId: string;
      answers?: Array<{ id: string; label: string }>;
    }
  | {
      type: 'workflow';
      message: string;
      workflow: {
        runId: string;
        workflowId: string;
        title: string;
        currentIndex: number;
        total: number;
        currentAction: CelineAction;
      };
    }
  | {
      type: 'procedure_answer';
      message: string;
      actions: CelineAction[];
    };
```

A separate explicit request/event can ask for a full workflow view.

## 10. Presentation behavior

Default behavior must be task-sized, not route-sized.

### Starting a workflow

Expected interaction:

```text
Operator: je lance un OC
Céline: L’OC précédent est-il déjà clôturé ?
Operator: oui
Céline: D’accord. Début OC — étape 1/16.
        Vérifier la disponibilité des AC et les commander si besoin.
        [Valider] [N/A] [Voir toute la procédure]
```

### Targeted procedure question

```text
Operator: je dois faire quoi comme prélèvement ?
Céline: En production : faire les prélèvements microbio — 5 minimum par OC.
        [Voir dans Production]
```

If ambiguity remains:

```text
Céline: Tu parles des prélèvements en production ou de fin de cuve ?
```

### Small talk

Greetings, thanks and acknowledgements receive a short local response and do not mutate operational state.

### Unknown

Reserve the current “référentiel” fallback for genuine unsupported operational questions, not conversational messages.

## 11. UI changes

### Keep

- main ShiftGuide navigation;
- message input and voice input;
- canonical action validation/N/A controls;
- session/auth boundaries.

### Change

- remove duplicate navigation/chrome from the central Céline experience where it competes with the active task;
- expose a compact operational-state strip (`Production · OC ouvert · Cuve ouverte` when known);
- show one current workflow action by default;
- provide explicit “Voir toute la procédure” rather than automatic full checklist dumps;
- remove automatic synthetic `C'est fait.` messages;
- distinguish “Nouvelle conversation” from a real “Nouveau poste” domain event;
- make suggested actions structured commands instead of French strings routed back through the LLM.

## 12. Provider adapter and model strategy

Keep DeepSeek as the baseline until the new architecture is measurable.

Refactor the provider result to return structured metadata:

```ts
{
  content,
  model,
  finishReason,
  usage: {
    promptTokens,
    completionTokens,
    cachedTokens,
    cacheMissTokens
  }
}
```

Requirements:

- keep reasoning/thinking disabled for the classification workload;
- lower output budget after golden-suite validation (target range roughly 100–200 tokens, not 4,000);
- make provider/model configuration injectable through environment/server construction without introducing a large framework;
- no automatic provider fallback until behavior is explicitly tested and governed.

## 13. Observability

Add privacy-safe Céline telemetry.

Log fields may include:

```text
requestId
providerCalled
model
intent
decisionOutcome
inputTokens
cachedTokens
cacheMissTokens
outputTokens
estimatedCost
providerDurationMs
totalDurationMs
fallbackReason
```

Never log:

- operator message text;
- auth/session tokens;
- API keys;
- protected procedure text;
- raw provider prompt/response.

Add counters/reporting sufficient to answer:

- provider calls per 100 operator interactions;
- tokens and cost per 100 interactions;
- cache-hit ratio;
- `unknown` rate;
- provider-error/fallback rate;
- latency p50/p95 from external telemetry if available.

## 14. Evaluation strategy

Create a Céline-specific golden evaluation corpus before changing behavior materially.

Suggested location:

```text
evals/celine-golden.jsonl
```

Each case contains state, user message and expected semantic/domain outcome.

Categories must include:

- greetings and acknowledgements;
- start/end shift;
- start/end OC;
- tank start/end/change;
- OC changes: lot/pays/formule/format;
- production questions;
- sampling questions;
- precise action questions;
- `oui` / `non` / enum answers to pending questions;
- `et après ?`, `précédent`, `montre tout`, `reprends`;
- ambiguous statements such as `j'ai fini mon OC`;
- contradictions and corrections;
- typos and spoken French;
- browser speech-recognition-like phrasing;
- out-of-scope questions;
- emergency queries.

The evaluation runner should distinguish:

1. deterministic fast-path tests;
2. domain-engine transition tests;
3. provider/intent evaluation with recorded or explicitly enabled live provider calls.

Live provider evals must not run accidentally in ordinary CI unless a dedicated secret-enabled job is intentionally configured.

## 15. Quality gates

Target acceptance criteria before v3 replaces the current path:

- 0 provider-generated authoritative procedure statements;
- 0 unauthorized domain transitions in deterministic tests;
- >= 99% correctness on critical safety/workflow golden cases;
- >= 97–98% overall semantic golden accuracy before choosing a model;
- ~0 provider calls for deterministic interactions;
- targeted procedural questions return 1–3 relevant actions by default, not a whole route;
- start/resume workflow displays one current step by default;
- Céline and ModuleView resolve the same workflow occurrence state;
- token usage and estimated cost are observable per provider call;
- no sensitive text enters logs;
- current auth/config/authority revision invariants continue to pass.

## 16. Migration sequence

The implementation must be incremental and keep the repository buildable after each phase.

### Phase 0 — Baseline and safeguards

Deliverables:

- golden corpus skeleton and deterministic eval runner;
- baseline scenarios representing current known failures and good behaviors;
- provider usage capture without changing user-visible behavior;
- cost estimation utility isolated from provider logic;
- architecture decision record for Céline v3.

Files likely involved:

```text
evals/celine-golden.jsonl
scripts/eval-celine.mjs
server/providers/deepSeekProvider.mjs
server/observability.mjs
tests/*
docs/*
package.json
```

Exit criteria:

- current behavior is measurable;
- no sensitive text is logged;
- `npm run check` remains green.

### Phase 1 — Operational state and domain engine

Deliverables:

```text
server/celineOperationalState.mjs
server/celineDomainEngine.mjs
tests/celineDomainEngine.test.mjs
```

Implement:

- explicit facts;
- pending question representation;
- workflow transition rules;
- deterministic start/end OC/tank/shift transitions;
- state invariant validation.

Do not change the provider prompt yet beyond what is required for compatibility.

Exit criteria:

- all core transitions are unit-tested;
- impossible transitions fail closed;
- domain behavior does not depend on provider prose.

### Phase 2 — Workflow occurrences and progress v4

Deliverables:

- `WorkflowRun` contract;
- progress storage v4;
- explicit migration/reset policy from v3;
- shared selectors/actions consumed by ModuleView and Céline;
- concurrency/storage tests updated.

Exit criteria:

- repeated OC/tank workflows do not reuse previous occurrence completion;
- Céline and ModuleView display identical state for the same run;
- reload and multi-tab behavior is tested.

### Phase 3 — Semantic action index

Deliverables:

```text
server/celineSemanticIndex.mjs
server/celineSemanticSearch.mjs
tests/celineSemanticSearch.test.mjs
```

Add curated metadata to the protected ShiftGuide configuration or a server-owned companion configuration.

Exit criteria:

- common precise questions resolve deterministically when unambiguous;
- ambiguous matches produce a clarification/candidate set;
- no vector database is introduced.

### Phase 4 — NLU contract v3

Deliverables:

```text
shared/celineContract.js
server/celinePrompt.mjs
server/celineNlu.mjs
server/app.mjs
```

Replace route-centric provider decisions with intent/entity parsing.

Keep a temporary compatibility adapter only if needed for incremental rollout; remove it once v3 is proven.

Exit criteria:

- provider cannot emit operator-facing procedure content;
- domain engine, not model, selects allowed transitions;
- golden semantic accuracy reaches threshold.

### Phase 5 — Deterministic interaction fast paths

Implement:

- shortcut commands;
- yes/no pending-answer handling;
- workflow navigation;
- workflow completion event;
- exact lexicon;
- greeting/acknowledgement;
- high-confidence semantic search.

Remove the synthetic automatic `C'est fait.` provider request.

Exit criteria:

- deterministic interaction provider-call rate is ~0;
- no regression in workflow state.

### Phase 6 — Response protocol and Céline UX

Deliverables:

- discriminated server response contract;
- workflow-current-step component;
- targeted procedure-answer component;
- explicit full-workflow view;
- compact state strip;
- corrected “Nouveau poste” semantics;
- reduced duplicate page navigation/chrome;
- suggestion buttons become structured commands.

Exit criteria:

- start workflow shows one step by default;
- targeted questions no longer dump full routes;
- mobile and desktop critical journeys pass Playwright.

### Phase 7 — Model benchmarking and cost optimization

After v3 semantics are stable:

- make model/provider choice configurable;
- benchmark candidate providers against the exact golden suite;
- measure accuracy, p50/p95 latency and estimated cost;
- lower maximum output tokens to the smallest safe bound;
- choose the default model based on the product scorecard.

Do not choose a provider solely from advertised token price.

### Phase 8 — Rollout hardening

Add:

- transition abuse/fuzz tests;
- malformed NLU output tests;
- session expiry during workflow;
- provider outage while deterministic paths remain usable;
- storage degradation;
- multi-tab conflicts;
- config/authority revision changes;
- rollout telemetry and documented rollback strategy.

## 17. Feature-flag / rollout strategy

Avoid a single irreversible cutover.

Recommended server-side mode:

```text
CELINE_ENGINE=v2 | v3
```

During development:

- production/default remains v2;
- branch/preview deployment can run v3;
- golden tests exercise v3 directly;
- once acceptance thresholds are reached, v3 becomes default;
- compatibility code is removed only after a stabilization window.

Do not run both providers for every production request solely for shadow comparison because that doubles cost and sends additional data externally. Offline/replay evaluation is preferred.

## 18. Configuration work required before final production validation

GitHub does not expose the deployment values for:

```text
SG_MODULES
SG_LEXIQUE
SG_SYSTEM_PROMPT
SG_CELINE_ROUTING
```

Before final production rollout:

- inspect their real sizes and semantics in Railway without exposing secrets;
- verify whether `SG_CELINE_ROUTING` overrides the repository default;
- confirm `SG_SYSTEM_PROMPT` is concise site/classification context and not a legacy full handbook;
- derive semantic metadata from the actual protected procedure catalog;
- validate the v3 authority revision against the production configuration.

Never copy `DEEPSEEK_API_KEY` or the ShiftGuide access code into issues, commits, logs or chat output.

## 19. Repository file strategy

### Preserve and evolve

```text
server/app.mjs
server/celineAuthority.mjs
server/celinePrompt.mjs
server/providers/deepSeekProvider.mjs
shared/celineContract.js
shared/shiftGuideContract.*
shared/shiftGuideProgress.js
src/pages/shiftguide/CelinePage.tsx
src/pages/shiftguide/ModuleView.tsx
```

### Add

```text
server/celineOperationalState.mjs
server/celineDomainEngine.mjs
server/celineSemanticIndex.mjs
server/celineSemanticSearch.mjs
server/celineNlu.mjs
shared/celineOperationalContract.js
shared/celineWorkflowContract.js
evals/celine-golden.jsonl
scripts/eval-celine.mjs
tests/celineDomainEngine.test.mjs
tests/celineSemanticSearch.test.mjs
```

Names may change slightly during implementation if the repository's existing boundaries indicate a cleaner location, but responsibilities should remain separated.

## 20. Pull-request decomposition

Do not implement this as one giant PR.

Recommended sequence:

1. **PR A — Céline telemetry + golden baseline**
2. **PR B — Domain state engine**
3. **PR C — Workflow occurrence/progress v4**
4. **PR D — Semantic action index**
5. **PR E — NLU contract v3 + fast paths**
6. **PR F — Response protocol + UX redesign**
7. **PR G — Provider benchmark/configuration + token cap**
8. **PR H — rollout hardening / cleanup / removal of v2 compatibility**

Each PR must be independently reviewable, have explicit migration notes and leave `npm run check` green.

## 21. Senior-review checklist for every PR

Before merge, answer:

- What new invariant does this PR establish?
- What old behavior is intentionally changed?
- Can the provider now influence anything it could not influence before?
- Can a browser fabricate state the server trusts?
- What happens on reload, expiration, process restart and provider outage?
- Does the change increase provider data exposure?
- Does it create a second source of truth?
- Are repeated workflow occurrences handled correctly?
- Is the behavior represented in the golden suite?
- Is the cost/latency effect measurable?
- Is rollback straightforward?

## 22. Definition of “Céline parfaite” for this project

Céline v3 is complete when an operator can speak naturally and receive a concise, context-aware response while the application remains deterministic about operational truth.

The target experience is:

- natural language at the edge;
- explicit machine state in the middle;
- canonical procedures at the core;
- progressive task presentation at the UI;
- LLM usage only where ambiguity actually exists;
- objective evaluation and cost telemetry around every model decision.

The architecture should make a cheaper small model replaceable without changing the business logic. If changing the provider changes procedure behavior, the architecture is still wrong.
