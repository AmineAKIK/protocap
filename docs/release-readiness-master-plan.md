# ProtoCap — Release Readiness Master Plan

## Purpose

This document is the canonical execution plan for taking ProtoCap from an advanced public engineering demonstrator to an exceptionally polished release candidate **without changing its product nature, scope, or demonstration boundaries**.

The objective is not to add product surface area. The objective is to remove ambiguity, inconsistency, avoidable risk, misleading residue, presentation debt, and release friction while preserving the demonstrator's existing architecture and intent.

Every implementation PR following this plan should be small enough to review rigorously, should preserve current product boundaries, and should close one clearly defined class of release risk.

---

## Release invariants

The following constraints are non-negotiable throughout the release audit.

1. **Do not turn the demonstrator into an enterprise platform.**
   - No database, queue, distributed cache, multi-region state layer, provider abstraction, observability platform, or authentication product unless a concrete release defect requires it.

2. **Do not blur demonstration boundaries.**
   - Static/mock data remains explicitly described as static/mock data.
   - Browser-local workflows remain explicitly browser-local.
   - ShiftGuide/Céline protected server behavior remains clearly separated from public browser-only demonstrations.

3. **Do not add features merely to increase perceived sophistication.**
   - Polish, clarity, correctness, resilience, testability, security, performance, and documentation are in scope.
   - New product concepts are out of scope for this release.

4. **No silent security or trust-model regression.**
   - Secrets remain server-side.
   - Model output never becomes operational authority.
   - Existing authentication, validation, rate-limit, canonical hydration, and provider-boundary guarantees must be preserved or strengthened.

5. **Documentation must match reality exactly.**
   - No claim may be stronger than the implementation or deployment evidence supporting it.
   - No obsolete limitation may remain documented after it is fixed.

6. **Every material release change must be reviewable in isolation.**
   - Prefer narrowly scoped PRs with explicit acceptance criteria and regression coverage.

7. **`main` stays releasable.**
   - No long-running integration branch.
   - Each merged PR must independently satisfy the repository quality gate.

---

## Definition of release-ready

ProtoCap is release-ready when all P0 and P1 items are closed, all accepted P2 items are either closed or explicitly documented as intentional boundaries, the public deployment has passed the final live verification checklist, and repository claims are fully aligned with the deployed artifact.

The release candidate must satisfy the following top-level conditions:

- production configuration contains no contradictory or misleading secret/client namespaces;
- production build and runtime are reproducible from repository sources;
- all critical application paths have automated regression coverage proportional to their risk;
- server trust boundaries and failure modes are verified;
- browser-local persistence semantics are intentional and documented;
- PWA/cache behavior does not produce stale-release surprises;
- accessibility and responsive behavior remain credible across key routes;
- public metadata, social preview, repository landing experience, and release documentation are polished;
- warnings, dependency residue, archive material, and configuration artifacts have been reviewed and either removed or explicitly retained;
- final Railway deployment, readiness, smoke checks, and key public routes are verified against the release commit/tag.

---

# Workstream matrix

## WS-00 — Baseline and release evidence

**Priority:** P0  
**Goal:** establish a stable, auditable release baseline before changing anything.

### Audit

- Record current `main` SHA and current production Railway deployment mapping.
- Confirm production source repository, branch, Dockerfile usage, healthcheck path, replica count, restart behavior, and runtime environment.
- Record the complete set of production variable names without exposing values.
- Confirm branch protection/ruleset behavior and required checks.
- Confirm current release/version metadata across `package.json`, docs, and any tags/releases.
- Capture current production dependency audit result and build warnings.
- Capture current bundle/PWA build characteristics for regression comparison.

### Exit criteria

- Release baseline is reproducible and referenced by later PRs.
- No later finding is evaluated without comparison to this baseline.

---

## WS-01 — Railway production configuration hygiene

**Priority:** P0  
**Goal:** make the production environment match the documented trust model exactly.

### Known finding

The current production Railway service exposes legacy variable names in the `VITE_*` client namespace:

- `VITE_DEEPSEEK_API_KEY`
- `VITE_OPENAI_API_KEY`
- `VITE_SHIFTGUIDE_CODE`

Current application code does not appear to reference these names. Repository documentation may still mention them as historical/migration names, so this is not currently treated as proof of an active client-side leak. It is nevertheless a release-blocking configuration inconsistency because the public architecture explicitly states that secrets must never use Vite's client-facing namespace.

### Actions

- Confirm zero application-code references to the legacy variables.
- Inspect Railway variable references/dependencies before deletion, including whether canonical server-side variables resolve from any legacy `VITE_*` names.
- If any canonical variable depends on a legacy reference, migrate it to an independent server-side value/reference first and verify the rendered configuration.
- Confirm generated frontend output does not contain legacy secret values/names where applicable.
- Remove the three obsolete Railway variables only after dependency checks/migration are complete.
- Verify required server-side variables remain present and independently resolved.
- Redeploy only when the configuration cleanup is explicitly approved.
- Re-run readiness and live smoke checks after deployment.
- Update documentation only if production reality or variable requirements change.

### Exit criteria

- No secret-like production configuration exists in the `VITE_*` namespace.
- No required server-side variable depends on a removed legacy reference.
- Production readiness passes after cleanup.
- No functional behavior changes.

---

## WS-02 — Server trust boundary and security audit

**Priority:** P0/P1  
**Goal:** validate the entire server request lifecycle as one coherent security boundary.

### Scope

- application bootstrap and configuration validation;
- ingress trust / client-address resolution;
- security headers and HTTPS-dependent HSTS behavior;
- JSON/body size handling;
- unlock authentication and secret comparison;
- bearer-session generation, validation, expiry, and revocation;
- process-local session/state semantics;
- unlock throttling;
- per-session and per-client chat throttling;
- request cancellation and provider abort behavior;
- provider timeout/error mapping;
- readiness vs liveness semantics;
- static SPA fallback and API route isolation;
- generic error handling and accidental information disclosure;
- structured logging and secret/PII avoidance.

### Required adversarial cases

- malformed JSON;
- oversized request bodies;
- empty/oversized unlock codes;
- invalid/expired/revoked sessions;
- missing authorization;
- repeated unlock attempts;
- repeated chat attempts by session and IP/client identity;
- invalid provider payloads;
- provider timeout/rate-limit/unavailable paths;
- client disconnect during provider request;
- malformed Céline decision output;
- readiness with missing/invalid protected configuration;
- direct access to protected API resources without valid session.

### Exit criteria

- Each trust boundary is either covered by automated tests or explicitly justified.
- No client-controlled value becomes trusted without validation.
- No provider-controlled value becomes operational authority without canonical resolution.
- Runtime logs remain useful without exposing secrets or protected operational content.

---

## WS-03 — Céline safety, authority, and AI-boundary audit

**Priority:** P1  
**Goal:** demonstrate that Céline is a constrained decision-support component, not an unconstrained chatbot embedded in an operational UI.

### Audit

- deterministic domain handling before provider use;
- provider history construction and context minimisation;
- system prompt ownership and server-only boundary;
- semantic index behavior;
- routing contract validation;
- provider decision parsing;
- canonical authority resolution;
- safe fallback behavior;
- operational state transitions;
- checklist/action hydration from canonical ShiftGuide data;
- cost guard and token/request budgets;
- provider model/config observability;
- prompt injection resistance at the architectural boundary (not by claiming impossible model-level guarantees);
- no unsupported multi-provider/failover claims.

### Quality objective

Make the strongest defensible claim visible: **the model may classify/route within a constrained contract, but it does not author canonical operational actions.**

### Exit criteria

- AI failure cannot silently become operational instruction.
- Contract violations fail safely.
- Documentation accurately describes what is deterministic, model-assisted, canonical, and network-dependent.

---

## WS-04 — Frontend architecture and state audit

**Priority:** P1  
**Goal:** verify that the client remains understandable, maintainable, and consistent across all demonstrated surfaces.

### Review dimensions

For every major route/feature:

- route ownership and lazy-loading boundary;
- component responsibility and size;
- duplicated domain logic;
- state ownership;
- browser persistence keys and schemas;
- stale-state/version behavior;
- reset semantics;
- loading/error/empty states;
- async cancellation/race behavior;
- accessibility semantics;
- keyboard behavior;
- mobile/responsive behavior;
- copy consistency;
- error messages and recovery;
- mock/demo boundary visibility;
- accidental coupling to ShiftGuide protected state.

### Major surfaces

- Home / portfolio landing;
- ShiftGuide lock/auth shell;
- ShiftGuide home/modules;
- Céline;
- LinePulse;
- Expiry Check;
- Logistics Call;
- Knowledge Base;
- Packing Calculator;
- operational/analysis reports;
- pilot proposal.

### Exit criteria

- No material duplicated business rule lacks a clear source of truth.
- Browser-local persistence is explicit and resilient to malformed/stale values.
- Major pages behave coherently on desktop and mobile.
- Demo limitations are visible where a user could otherwise infer live/shared behavior.

---

## WS-05 — Persistence and local-data integrity

**Priority:** P1  
**Goal:** ensure browser-local state behaves like deliberate demo state, not accidental pseudo-backend state.

### Audit

- localStorage key naming and ownership;
- schema/version compatibility;
- JSON parse failure handling;
- invalid/partial persisted state;
- bounds and numeric validation;
- reset/clear behavior;
- cross-tab expectations where relevant;
- separation between protected ShiftGuide configuration and local progress;
- no secrets/tokens persisted beyond intended session behavior;
- clear differentiation between local action history and shared operational history.

### Exit criteria

- Corrupted local persistence cannot break the application irrecoverably.
- Every persisted dataset has an explicit lifecycle and user-visible semantics.

---

## WS-06 — Test strategy and risk-based coverage

**Priority:** P1  
**Goal:** prove the important contracts rather than chase decorative coverage percentages.

### Audit layers

1. Node unit/runtime tests.
2. Frontend Vitest component/hook/domain tests.
3. Browser critical journeys.
4. Mobile/WebKit smoke coverage.
5. Accessibility regression scans.
6. Production/live smoke tests.

### Actions

- Map critical risks to at least one automated test layer.
- Identify high-risk modules currently excluded from coverage metrics.
- Review whether current coverage thresholds remain appropriate.
- Prefer targeted tests for uncovered release risks over arbitrary percentage increases.
- Make the documentation explicit that frontend coverage is **risk-targeted**, not repository-wide, unless configuration is changed to make it global.
- Verify test names and fixtures communicate intent.
- Eliminate flaky timing assumptions where found.

### Exit criteria

- Each P0/P1 risk has regression coverage where technically reasonable.
- Coverage claims exactly match configuration.
- CI failure signals are actionable rather than noisy.

---

## WS-07 — Dependency and supply-chain hygiene

**Priority:** P1/P2  
**Goal:** remove avoidable dependency noise and document unavoidable transitive residue.

### Known baseline

Current Railway builds report zero npm vulnerabilities, while the development install emits deprecation warnings including transitive `source-map@0.8.0-beta.0` and `glob@11.1.0`.

### Audit

- direct dependency freshness and necessity;
- transitive source of deprecation warnings;
- production vs development dependency split;
- lockfile consistency;
- npm install-script warnings and allow-script behavior;
- Dependabot configuration;
- GitHub Actions pinning;
- Docker base image strategy;
- whether any cleanup can be achieved without destabilising the release.

### Exit criteria

- Zero known production vulnerabilities.
- Avoidable deprecation/install-script warnings are removed.
- Remaining warnings are understood and documented, not ignored.
- No dependency upgrade is merged solely for novelty.

---

## WS-08 — Docker and runtime packaging

**Priority:** P1  
**Goal:** keep production packaging minimal, reproducible, non-root, and unsurprising.

### Audit

- multi-stage build correctness;
- lockfile-only installation path;
- build/runtime dependency separation;
- `--ignore-scripts` suitability in runtime;
- runtime file allowlist;
- `.dockerignore` completeness;
- non-root execution;
- port handling via Railway `PORT`;
- signal/shutdown lifecycle;
- draining behavior;
- startup/readiness ordering;
- image size only as a secondary metric;
- no documentation/test/archive material accidentally shipped in the runtime image.

### Explicit non-goal

Do not introduce distroless, Alpine, custom init, or additional container complexity unless a measured issue justifies it.

### Exit criteria

- Runtime image contains only what execution requires.
- Railway start/readiness behavior matches docs and tests.

---

## WS-09 — Runtime lifecycle and observability

**Priority:** P1  
**Goal:** ensure failures are diagnosable without turning the demo into an observability platform.

### Audit

- structured request IDs;
- HTTP outcome logging;
- provider latency/outcome/model metadata;
- deterministic vs provider Céline paths;
- startup configuration logging without secrets;
- shutdown/drain behavior;
- readiness transitions;
- expected 4xx vs anomalous 5xx distinction;
- log cardinality and protected-content avoidance;
- live smoke behavior and cost safety.

### Exit criteria

- A production incident can be understood from Railway logs without exposing secrets.
- No scheduled AI traffic is added merely for monitoring.

---

## WS-10 — PWA, caching, and release freshness

**Priority:** P1  
**Goal:** prevent service-worker caching from undermining an otherwise clean release.

### Audit

- service worker update strategy;
- precache scope;
- static asset cache headers;
- SPA shell behavior;
- API `no-store` behavior;
- protected response caching behavior;
- route refresh/deep-link behavior;
- stale client after deploy;
- offline claims vs actual capability;
- manifest metadata/icons/installability;
- base-path compatibility.

### Exit criteria

- New deployments converge predictably on new frontend assets.
- Protected/API responses are not cached incorrectly.
- Offline behavior remains explicitly partial.

---

## WS-11 — Performance and bundle review

**Priority:** P2  
**Goal:** remove obvious performance waste without premature optimisation.

### Audit

- initial JS/CSS size;
- route chunking;
- unexpectedly heavy page chunks;
- repeated large static datasets;
- render churn on interactive pages;
- avoidable network calls;
- image/icon payloads;
- mobile interaction latency;
- PWA precache size.

### Exit criteria

- No obvious regression or accidental eager-loading.
- Any accepted heavy feature is intentional and proportionate to its demo value.

---

## WS-12 — Accessibility and responsive polish

**Priority:** P1/P2  
**Goal:** make the demonstrator credible under keyboard, mobile, and automated accessibility scrutiny.

### Audit

- landmarks/headings;
- form labels and error association;
- dialog focus management;
- focus visibility;
- keyboard-only flows;
- touch target sizing;
- contrast;
- reduced-motion expectations where applicable;
- table/data visualization semantics;
- mobile overflow;
- orientation/narrow-width behavior;
- axe findings and known limitations.

### Exit criteria

- Critical flows pass automated accessibility smoke tests.
- No keyboard trap or inaccessible core control remains.
- Mobile layouts are deliberate rather than merely non-broken.

---

## WS-13 — Public product-boundary consistency

**Priority:** P1  
**Goal:** ensure a client/recruiter cannot accidentally mistake a demonstration for a deployed enterprise integration.

### Audit matrix

For every public surface verify consistency across:

- UI wording;
- README implementation matrix;
- product-boundaries documentation;
- architecture documentation;
- persistence behavior;
- API/runtime reality.

### Key distinctions to preserve

- mock vs live;
- browser-local vs shared;
- static reference vs protected configuration;
- proposal vs deployed capability;
- AI-assisted decision support vs autonomous control;
- partial PWA offline capability vs full offline operation.

### Exit criteria

- No material product claim requires verbal correction during a demo.

---

## WS-14 — Repository hygiene and engineering signal

**Priority:** P2  
**Goal:** make the repository itself communicate senior engineering discipline within minutes.

### Audit

- root-file necessity;
- docs hierarchy;
- archive contents and rationale;
- stale plans vs current source-of-truth documents;
- naming consistency;
- generated/binary file policy;
- dead files and obsolete config;
- comments/TODO/FIXME review;
- contribution instructions;
- security policy;
- CODEOWNERS appropriateness for a solo-maintained portfolio project;
- issue/PR templates;
- Dependabot scope;
- license perimeter clarity.

### Exit criteria

- A reviewer can identify current architecture sources of truth immediately.
- Historical material is clearly historical.
- No obsolete deployment/configuration path competes with the current one.

---

## WS-15 — README and portfolio presentation

**Priority:** P1/P2  
**Goal:** convert the existing strong due-diligence README into a stronger first-impression portfolio surface without weakening technical honesty.

### Narrative hierarchy

The first screen/minute should answer, in this order:

1. What problem class does ProtoCap explore?
2. What can I see in the live demo?
3. What engineering capability does it demonstrate?
4. Which parts are real, local, mocked, protected, or AI-assisted?
5. Why should I trust the implementation quality?
6. Where can I inspect architecture/security/release details?

### Audit

- title/subtitle clarity;
- live-demo CTA prominence;
- concise capability map;
- architecture visual legibility;
- screenshots/social preview value;
- proof points: CI, cross-browser, a11y, security boundary, Railway runtime;
- avoid excessive defensive text above the fold;
- preserve exact product-boundary honesty;
- contact/licensing positioning;
- recruiter/client scanability.

### Exit criteria

- README is impressive in 30 seconds and defensible after 30 minutes.
- Technical depth remains linked and discoverable rather than removed.

---

## WS-16 — Web metadata, social preview, SEO, and install surface

**Priority:** P2  
**Goal:** make direct links look intentional in browsers, chat apps, social networks, and installed PWA contexts.

### Audit

- document title and description;
- canonical URL where appropriate;
- Open Graph metadata;
- social-card asset;
- favicon/PWA icon;
- theme color;
- manifest language/name/description;
- sitemap/robots consistency;
- route discoverability where relevant for an SPA;
- public URLs referenced in README/docs.

### Exit criteria

- Shared links render a professional preview.
- Metadata matches current product positioning.

---

## WS-17 — Documentation source-of-truth audit

**Priority:** P1/P2  
**Goal:** eliminate contradictions between architecture, operations, quality, security, and historical planning documents.

### Canonical-document review

- `README.md`
- `SECURITY.md`
- `LICENSING.md`
- `docs/architecture.md`
- `docs/product-boundaries.md`
- `docs/quality-gates.md`
- `docs/release-and-operations.md`
- `docs/runtime-readiness.md`
- `docs/runtime-lifecycle.md`
- `docs/runtime-observability.md`
- `docs/runtime-packaging.md`
- AI/data-governance and Céline-specific docs
- archived/historical plans

### Exit criteria

- Every current claim has one clear source of truth.
- Historical plans are visibly non-normative.
- No documentation refers to retired deployment/runtime paths as current.

---

## WS-18 — Live production verification

**Priority:** P0 at release candidate  
**Goal:** verify the actual public artifact, not only CI output.

### Required release-candidate checks

- deployment corresponds to intended release SHA/tag;
- Railway status is SUCCESS;
- `/api/health` passes;
- `/api/ready` passes;
- public landing route loads;
- major public demo routes load;
- deep-link refresh works;
- service worker/manifest assets load;
- protected ShiftGuide lock behaves correctly;
- invalid unlock path behaves correctly without revealing configuration;
- authenticated ShiftGuide session flow works using authorised test access;
- Céline deterministic path works;
- one controlled provider-backed path works when appropriate;
- logout/session revocation works;
- mobile smoke passes;
- no unexpected 5xx spikes or runtime errors appear in deployment logs;
- production dependency audit remains clean.

### Exit criteria

- Release evidence references the exact deployed commit.
- No discrepancy remains between repository docs and deployed behavior.

---

## WS-19 — Versioning, tag, release notes, and final freeze

**Priority:** P0 at final release  
**Goal:** make the release externally understandable and internally reproducible.

### Audit/actions

- decide final release identifier (`v0.1.0-demo` or successor based on repository history);
- ensure package/version/docs agree where versioning is intentionally surfaced;
- prepare concise release notes centred on demonstrated capability and engineering guarantees;
- include explicit known boundaries rather than pretending production completeness;
- reference live demo and architecture/security docs;
- tag only the verified commit;
- perform post-tag production verification;
- avoid further feature merges until release verification is complete.

### Exit criteria

- Tag, release notes, repository state, and Railway deployment all point to the same verified artifact.

---

# Priority model

## P0 — Release blockers

A P0 item prevents the release candidate from being considered trustworthy.

Examples:

- secret/client namespace ambiguity;
- active secret exposure;
- broken authentication/session boundary;
- invalid readiness behavior;
- deployment mismatch;
- critical route/runtime failure;
- documentation materially overstating implemented capability.

## P1 — High-confidence release quality

Must normally be closed before release unless explicitly accepted as an intentional demo boundary.

Examples:

- critical test gaps;
- stale-state failure modes;
- service-worker freshness risk;
- misleading UX wording;
- unhandled provider/runtime failure paths;
- major accessibility/mobile issues;
- dependency warnings with actionable clean fixes.

## P2 — Senior polish

Improvements that materially strengthen presentation, maintainability, or reviewer confidence without changing the product.

Examples:

- README narrative hierarchy;
- metadata/social preview;
- documentation hierarchy;
- bundle cleanup;
- archive/repository hygiene;
- non-critical accessibility refinements.

## P3 — Explicitly defer unless evidence changes

Potentially valid engineering ideas that are intentionally outside this release.

Examples:

- database-backed shared state;
- Redis/distributed rate limiting;
- multi-replica session sharing;
- SSO/RBAC platform;
- multi-provider AI orchestration;
- full offline operation;
- full production monitoring stack;
- real manufacturing-system integrations.

These are not release gaps unless the public project claims to provide them.

---

# Proposed implementation PR sequence

The exact numbering will follow repository history. Each PR should reference this master plan and close one coherent risk category.

1. **Production configuration hygiene** — remove obsolete Railway `VITE_*` secret-like variables; verify no client/runtime dependency.
2. **Security/runtime boundary audit fixes** — only concrete issues found in WS-02.
3. **Céline authority and AI-boundary hardening** — only concrete issues found in WS-03.
4. **Persistence/state resilience** — malformed/stale local state, lifecycle, reset semantics.
5. **Frontend structural cleanup** — duplication, responsibility, async/state issues discovered by page audit.
6. **Risk-based regression coverage** — tests driven by findings from PRs 2–5.
7. **Dependency/build warning cleanup** — remove safe actionable warnings; document unavoidable residue.
8. **PWA/cache/release freshness** — service-worker and cache semantics.
9. **Accessibility/responsive polish** — remaining high-value UI issues.
10. **Repository/documentation consistency** — source-of-truth and stale artifact cleanup.
11. **README/portfolio presentation** — first-impression hierarchy, proof points, screenshots/metadata links as justified.
12. **Metadata/social/install polish** — OG/PWA/SEO/public sharing surface.
13. **Release candidate verification** — no feature changes; exact live validation evidence.
14. **Release/tag notes** — final version alignment and release publication.

PRs may be split further when a finding is large enough to deserve isolated review. They should not be merged together merely to reduce PR count.

---

# Change decision rubric

Before implementing any proposed cleanup, answer all five questions:

1. **Does this close an observed release risk or presentation debt?**
2. **Can the value be explained without invoking hypothetical enterprise scale?**
3. **Does it preserve ProtoCap's existing demonstration boundaries?**
4. **Can we regression-test or otherwise verify the change?**
5. **Is the resulting system simpler or more truthful than before?**

If the answer to any of 1, 3, or 5 is no, the change should normally be rejected for this release.

---

# Per-PR acceptance checklist

Every implementation PR should include, where relevant:

- [ ] exact release risk/finding being closed;
- [ ] explicit non-goals;
- [ ] architecture/trust-boundary impact assessment;
- [ ] tests added or reason no new test is needed;
- [ ] documentation impact checked;
- [ ] `npm run check` passes;
- [ ] production Docker image builds;
- [ ] required Playwright/a11y checks pass;
- [ ] production dependency audit passes;
- [ ] no generated artifacts are committed;
- [ ] no new secret/client configuration ambiguity;
- [ ] no product-boundary claim is strengthened without evidence.

---

# Final release gate

The release must not be tagged until all of the following are true:

- [ ] all P0 findings closed;
- [ ] all P1 findings closed or explicitly accepted/documented as intentional boundaries;
- [ ] no unresolved contradictory production configuration;
- [ ] CI Quality Gate green on the release commit;
- [ ] production Docker deployment successful on Railway;
- [ ] `/api/ready` and `/api/health` verified live;
- [ ] live smoke checklist completed against the release deployment;
- [ ] public product-boundary claims re-verified;
- [ ] README and current architecture/security/operations docs aligned;
- [ ] dependency audit clean;
- [ ] release notes identify both demonstrated strengths and known boundaries;
- [ ] tag points to the exact verified deployment commit.

---

## Current first action

The first implementation item after this planning PR is merged is **WS-01 — Railway production configuration hygiene**, starting with a dependency/reference check for `VITE_DEEPSEEK_API_KEY`, `VITE_OPENAI_API_KEY`, and `VITE_SHIFTGUIDE_CODE`; any canonical Railway variable still referencing them must be migrated first, then the obsolete names can be removed before a controlled production redeploy/verification.
