# Execution Brief

## Exact Outcome

- Produce the concrete contracts, artifacts, and bounded implementation/design surfaces for Security Threat Model and Trust Boundaries that this step is responsible for before any broader follow-on work begins.

## Prerequisites

- Re-read [[02_Phases/Phase_00_architecture_spikes_and_delivery_foundations/Phase|Phase 00 architecture spikes and delivery foundations]] and confirm the step still matches the current roadmap sequence.
- Confirm the handoff from [[02_Phases/Phase_00_architecture_spikes_and_delivery_foundations/Steps/Step_04_specify-repository-architecture-contracts-and-local-stack|STEP-00-04 Specify Repository Architecture Contracts and Local Stack]] before widening scope.
- Keep deterministic work in typed Effect services, repositories, and tools; reserve Fred for agentic orchestration only.
- Treat the listed files as planned starting points; create only the smallest set needed to land the slice.

## Planned Starting Files

- These paths may not exist yet; use them as the first bounded implementation or design surface.
- `docs/threat-model.md`
- `docs/adr/ADR-xxxx-trust-boundaries.md`
- `apps/api/src/auth/authorization.ts`
- `packages/ingestion/src/path-safety.ts`
- `packages/data-engine/src/sql-policy.ts`

## Required Reading

- [[02_Phases/Phase_00_architecture_spikes_and_delivery_foundations/Phase|Phase 00 architecture spikes and delivery foundations]]
- [[01_Architecture/System_Overview|System Overview]]
- [[01_Architecture/Code_Map|Code Map]]
- [[01_Architecture/Agent_Workflow|Agent Workflow]]
- [[02_Phases/Phase_00_architecture_spikes_and_delivery_foundations/Steps/Step_04_specify-repository-architecture-contracts-and-local-stack|STEP-00-04 Specify Repository Architecture Contracts and Local Stack]]
- `docs/product-brief.md` sections 5-7, 13, 18-19, 21, 24, 26, and 29-31.

## Concrete Deliverables

- Define the concrete contract for Security Threat Model and Trust Boundaries in the first planned domain, persistence, or documentation files so downstream implementation does not need to rediscover the boundary.
- Use `packages/ingestion/src/path-safety.ts` to make discovery, classification, refresh, or job state deterministic before any model-dependent behavior is introduced.
- Land the data-engine boundary in `packages/data-engine/src/sql-policy.ts` with deterministic execution, explicit limits, and source-linked outputs.
- Expose only the minimal API surface in `apps/api/src/auth/authorization.ts` needed to exercise this step end to end.

## Smallest Bounded Checklist

- First, define the concrete contract for Security Threat Model and Trust Boundaries in the first planned domain, persistence, or documentation files so downstream implementation does not need to rediscover the boundary.
- Then, use `packages/ingestion/src/path-safety.ts` to make discovery, classification, refresh, or job state deterministic before any model-dependent behavior is introduced.
- Next, land the data-engine boundary in `packages/data-engine/src/sql-policy.ts` with deterministic execution, explicit limits, and source-linked outputs.
- Finish by leaving one observable typed path—test, route, worker flow, or UI state—that proves the slice is ready for the next dependent step.

## Constraints and Non-Goals

- Keep Phase 0 work decision-oriented: prove boundaries, not broad production scaffolding.
- Keep deterministic work in typed Effect services and adapters; use Fred only where agentic judgment is actually required.
- Record tradeoffs and rejected options explicitly so later implementation steps do not need to rediscover them.

## Related Notes

- Step: [[02_Phases/Phase_00_architecture_spikes_and_delivery_foundations/Steps/Step_05_specify-security-threat-model-and-trust-boundaries|STEP-00-05 Specify Security Threat Model and Trust Boundaries]]
- Phase: [[02_Phases/Phase_00_architecture_spikes_and_delivery_foundations/Phase|Phase 00 architecture spikes and delivery foundations]]

## Refinement Addendum

### Canonical Starting Point and Method

- Extend `docs/security-model.md`; do not create a competing threat-model document. Update DEC-0009 only if evidence contradicts it. Listed auth/path/SQL files are enforcement handoff targets, not Phase 0 implementation tasks.
- Read `docs/security-model.md` completely; `docs/architecture.md` sections 3.2, 4, 6.3, 8-10, and 14; DEC-0009; `docs/evaluation-strategy.md` adversarial/release sections; and `docs/product-brief.md` sections 16, 21, and 23-26.
- Use a STRIDE-style pass per trust boundary grounded in existing assets, actors, controls, and failure modes.

### Required Artifacts

1. Trust-boundary table: assets, crossing data, actor, enforcing component, owner, authorization, audit event, and safe failure.
2. Threat register: asset, actor, precondition, abuse, impact, preventive/detective control, residual risk, status, and implementation/verification phase.
3. Abuse catalog: traversal/encodings, symlink escape/cycles, devices/sockets, hostile/oversized files, archive expansion, prompt injection across supported types, cross-workspace access, SQL `ATTACH`/`COPY`/`INSTALL`/`LOAD`/DDL/DML/unsafe pragmas, unbounded output/fan-out, cancellation bypass, secret leakage, and retry duplication.
4. Provisional defaults/limits table: each value numeric or `TBD` with owner, needed evidence, fail-closed default, and calibration phase. Archives and OCR-heavy binaries are unsupported until designed.
5. Threat-to-test matrix mapping every abuse to a future unit, integration, adversarial, or recovery check.
6. Deferred-risk list with severity, owner, due phase, and compensating control.
7. STEP-00-06 handoff: accepted abuse categories, filesystem/SQL rules, quotas, sanitization/privacy, audit events, and unsupported defaults.

### Constraints and Review Rules

- Do not implement production authentication, a general policy engine, filesystem walker, or DuckDB executor.
- Controls enforce outside prompts and fail closed with typed, sanitized errors.
- Do not copy real secrets, private host paths, PII, or customer content into fixtures/examples.
- Every threat needs a named control or accepted residual risk; every boundary needs an enforcement owner. Missing ownership or a silent `TBD` is a blocker.
