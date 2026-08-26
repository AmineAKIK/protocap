# Demo operations and release runbook

ProtoCap is a public technical demonstrator, not an enterprise production platform. This runbook keeps the public demo reviewable and observable without introducing a heavy monitoring stack or scheduled AI traffic.

## Public production target

Canonical deployment:

- `https://protocap-production.up.railway.app`
- Railway production healthcheck: `/api/ready`
- GitHub deployment source: `main`

A custom domain can replace the Railway hostname later if an owned domain is available. The live smoke target, `robots.txt`, sitemap and canonical metadata must then be changed together.

## External live smoke

`.github/workflows/live-smoke.yml` runs once per day at `06:17 UTC` and can also be started manually with `workflow_dispatch`.

The probe is intentionally read-only and secret-free. It performs only `GET` requests against:

- `/` — public HTML shell and security headers;
- `/api/health` — process liveness contract;
- `/api/ready` — application readiness contract;
- `/robots.txt` — public indexing contract.

It does **not** call `/api/shiftguide/unlock`, `/api/shiftguide/session` or `/api/celine/chat`. Scheduled monitoring therefore consumes no ShiftGuide credential attempts and no AI-provider tokens.

The smoke also checks HTTPS-only targeting, expected security headers, API `no-store` behavior, API request IDs and the production sitemap declaration.

GitHub schedules run from the latest default-branch commit and may be delayed under Actions load. For a public repository, GitHub also disables scheduled workflows after 60 days without repository activity; a manual run or re-enable may therefore be needed after a long dormant period.

Run the same probe manually from a Node 24 environment with:

```bash
npm run smoke:live
```

Override the target only when validating an intentional alternate HTTPS deployment:

```bash
PROTOCAP_BASE_URL=https://example.invalid npm run smoke:live
```

## Runtime observability

The server emits structured JSON logs rather than request bodies or user prompts.

Useful event families:

- `server_started` — runtime start and bounded Céline configuration;
- `http_request` — request ID, method, normalized API path, status/outcome and duration;
- `celine_domain` — deterministic decision handled without a provider call;
- `celine_provider` — provider outcome, duration, model and provider-reported token counts when available;
- graceful-shutdown lifecycle events from the runtime lifecycle handler.

For provider-cost investigation, aggregate `celine_provider` events in Railway by outcome and sum `totalTokens`, `promptTokens`, `completionTokens`, `promptCacheHitTokens` and `promptCacheMissTokens` over the relevant period. The application deliberately does not expose a public metrics endpoint containing this information.

Important limitation: these logs provide operational evidence for the demo, not durable billing-grade accounting. Provider-reported usage and the provider billing console remain the source of truth for external token spend.

## Deployment verification

For every runtime-affecting merge to `main`:

1. confirm the GitHub Quality Gate is green before merge;
2. record the squash-merge commit SHA;
3. confirm Railway creates a deployment for that exact SHA;
4. wait for Railway `SUCCESS`;
5. confirm `/api/ready` returns HTTP 200;
6. run or inspect the external live smoke when the change affects public HTTP behavior.

Do not continue a release from a broken `main` or from a Railway deployment whose commit does not match the intended release commit.

## `v0.1.0-demo` release procedure

The first public release is intentionally named `v0.1.0-demo` to communicate maturity accurately.

Create the tag/release only after PR10 is merged and the resulting `main` commit has passed Railway production verification. The tag must point to that verified `main` commit, not to the PR branch head.

Release checklist:

1. Quality Gate and CodeQL are green on the merged work;
2. Railway deployment for the release commit is `SUCCESS`;
3. `/api/ready` is 200;
4. the live smoke passes against production;
5. release notes describe the repository as a technical demonstrator and do not claim enterprise availability, compliance or accessibility certification;
6. create `v0.1.0-demo` on the verified commit and publish the GitHub release.

Suggested release-note scope:

- reproducible Node 24 containerized runtime;
- graceful Railway lifecycle handling;
- canonical ProtoCap product/public-demo polish;
- bounded Céline provider usage and server-side secrets;
- strengthened CI, CodeQL, production dependency audit and browser-secret invariants;
- Chromium critical journeys, mobile/WebKit smoke coverage and axe regression gates;
- external production live smoke and documented release verification.

The tag/release is a deliberate public mutation and should be created only with explicit release authorization.
