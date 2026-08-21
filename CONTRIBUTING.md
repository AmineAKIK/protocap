# Contributing

This repository uses a small, review-first workflow intended to keep `main` deployable and the history easy to audit.

## Local setup

Use the Node.js version declared in `.nvmrc`.

```bash
npm ci
npm run dev
```

## Before opening a pull request

Run the canonical repository check:

```bash
npm run check
```

It validates server syntax, runs the automated test suite, enforces ESLint with zero warnings, type-checks the application, and builds the production bundle.

## Pull request workflow

1. Branch from the latest `main`.
2. Keep the branch focused on one concern.
3. Open the pull request as a draft while work or CI is still in progress.
4. Require the `Quality gate` workflow to pass on the exact pull-request head.
5. Review the final diff for scope, security, test coverage, accessibility, and documentation impact.
6. Prefer squash merge so `main` keeps one clear commit per reviewed change.

Do not commit generated directories, local environment files, credentials, access tokens, production data, or company-confidential material.

## Change quality

Changes should preserve existing behavior unless the pull request explicitly documents a behavior change. New domain logic should be isolated from rendering where practical and covered by focused tests. Security-sensitive changes should state their threat boundary and failure behavior in the pull request description.

## Licensing and contribution rights

Only submit material that you have the right to contribute.

Contributions to original software code must be compatible with the repository's [PolyForm Noncommercial License 1.0.0](LICENSE) and the licensing perimeter described in [LICENSING.md](LICENSING.md). Submitting a pull request does not automatically transfer ownership of the contribution or grant AkikSystems rights beyond those expressly provided by the contributor and applicable law.

If a substantial contribution may later be included in a separately licensed commercial distribution, the maintainer may require a separate written contribution or licensing agreement before accepting that contribution. This avoids silently assuming commercial relicensing rights that were never granted.

## Deployment

Railway is the production deployment target. A successful GitHub Quality Gate validates the repository, but deployment status must be checked independently when production behavior matters.
