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
