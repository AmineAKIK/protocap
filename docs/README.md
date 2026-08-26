# Documentation

The repository keeps reviewable engineering documentation under `docs/` and keeps legacy binary source documents out of the project root.

- [`architecture.md`](architecture.md) — current architecture, trust boundaries and deliberate trade-offs.
- [`product-boundaries.md`](product-boundaries.md) — implemented vs mock/local/future behavior.
- [`quality-gates.md`](quality-gates.md) — local/CI quality gate, coverage policy and type-aware linting scope.
- [`ci-security.md`](ci-security.md) — pinned Actions, CodeQL, production audit and browser-secret invariants.
- [`release-and-operations.md`](release-and-operations.md) — production live smoke, structured observability, deployment verification and the `v0.1.0-demo` release procedure.
- [`archive/`](archive/) — historical/source Word documents retained for traceability. They are archival inputs, not the primary review format for the repository.

The public application routes `/rapport` and `/proposition-pilote` are the preferred reviewable representations of the corresponding current public material where applicable.
