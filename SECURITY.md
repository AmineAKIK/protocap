# Security Policy

## Supported version

This repository is maintained from the `main` branch. Security fixes target the current deployed version rather than historical tags.

## Reporting a vulnerability

Do not publish secrets, credentials, private operational data, or exploitable details in a public issue.

For a suspected vulnerability, use GitHub's private vulnerability reporting feature when available. If private reporting is unavailable, contact the repository owner privately before disclosing technical details publicly.

Please include:

- the affected route, component, or workflow;
- clear reproduction steps;
- the expected and observed behavior;
- the potential impact;
- any suggested mitigation, if known.

## Secrets and protected data

Production secrets belong in the deployment environment and must never be committed to Git. The repository intentionally exposes only variable names through `.env.example`.

ShiftGuide protected configuration and Céline provider credentials are handled server-side. Any change that moves credentials, protected operational content, or authorization decisions into the client bundle should be treated as a security regression.

ShiftGuide browser persistence has explicit failure policies: authenticated session state fails closed when `sessionStorage` cannot be written and verified, while non-sensitive local state may degrade to page-memory with an operator warning instead of crashing the UI. See [`docs/storage-resilience.md`](docs/storage-resilience.md).

Céline also crosses a third-party AI data boundary. The application minimizes provider context, but operator text sent for classification still leaves the Protocap trust boundary. Deployment owners must define which data classes may be entered and validate the active provider contract, retention, storage-location and transfer requirements before using Céline with sensitive information. See [`docs/ai-data-governance.md`](docs/ai-data-governance.md).

Browser speech recognition is a separate boundary: depending on browser/platform capabilities, microphone audio may be processed by a browser/vendor recognition service rather than locally. Protocap must not claim that voice audio always remains on-device unless the deployment enforces and verifies local recognition support.
