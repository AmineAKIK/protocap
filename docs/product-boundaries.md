# Product boundaries and demonstration status

The purpose of this document is to make the product surface auditable. A recruiter, engineer or potential customer should be able to distinguish working behavior from simulation without reverse-engineering the UI.

| Surface | What the demo proves | What it does **not** claim |
| --- | --- | --- |
| ShiftGuide | Protected configuration delivery, guided workflows, local progress and session lifecycle | Production IAM, durable distributed sessions or a complete MES integration |
| Céline | Authenticated server-mediated AI guidance with a protected prompt/provider key | Autonomous control of equipment, offline AI, or a provider-neutral backend contract |
| LinePulse | Role-specific operational visualisation and decision-support UX | Live telemetry, real-time plant synchronisation or measured operational impact |
| Expiry Check | Interactive validity/status workflow and local history | Shared quality database, validated electronic batch record or cross-device synchronisation |
| Logistics Call | Request lifecycle, prioritisation, elapsed-time UX and status transitions | Multi-user messaging, websocket/event streaming or real-time logistics synchronisation |
| Knowledge Base | Search/navigation model for operational references | Connection to an enterprise document-management system |
| Packing Calculator | Deterministic local packaging calculations and manual pallet-dispatch progress | ERP/master-data integration, shared dispatch state or automatic production-order execution |
| Pilot proposal | A structured controlled-pilot proposal and guard-rail thinking | Approval, deployment, production validation or measured benefits |

## Mock and fictitious data

Public demonstration data is intentionally fictitious. LinePulse explicitly uses the repository fixture `src/data/linePulseMock.json`.

Statements about expected gains, KPIs or operational value in reports and presentation material are design hypotheses or evaluation criteria unless explicitly identified as measured results. They should not be read as validated business outcomes.

## Local persistence

Expiry Check, Logistics Call and Packing Calculator use browser storage. ShiftGuide progress also uses browser persistence. These choices keep the demonstrations self-contained, but they do not create a shared source of truth between users or devices.

## Network dependency

The PWA can cache static application assets. Server-dependent behavior still requires connectivity, notably:

- ShiftGuide unlock and session validation;
- Céline chat requests;
- any future external integration.

Therefore Protocap is not described as a fully offline application.

## Data and confidentiality posture

The public repository must not contain production secrets, customer credentials, private operational exports or company-confidential datasets. Protected ShiftGuide configuration is provided through the deployment environment rather than committed to the repository.

The public pilot proposal and other non-software documents have their own rights perimeter; public visibility does not automatically place them under the software licence. See `LICENSING.md`.
