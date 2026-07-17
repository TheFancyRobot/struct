---
note_type: phase
template_version: 2
contract_version: 1
title: Architecture Spikes and Delivery Foundations
phase_id: PHASE-00
status: completed
owner: ''
created: '2026-07-17'
updated: '2026-07-17'
depends_on: []
related_architecture:
  - '[[01_Architecture/System_Overview|System Overview]]'
  - '[[01_Architecture/Domain_Model|Domain Model]]'
  - '[[01_Architecture/Integration_Map|Integration Map]]'
  - '[[01_Architecture/Agent_Workflow|Agent Workflow]]'
related_decisions:
  - '[[04_Decisions/DEC-0001_consume-stable-fred-packages-from-a-standalone-monorepo|DEC-0001 Consume Stable Fred Packages from a Standalone Monorepo]]'
  - '[[04_Decisions/DEC-0002_prefer-product-local-adapters-before-fred-core-changes|DEC-0002 Prefer Product-Local Adapters Before Fred Core Changes]]'
  - '[[04_Decisions/DEC-0003_use-typescript-bun-and-effect-with-explicit-runtime-boundaries|DEC-0003 Use TypeScript Bun and Effect with Explicit Runtime Boundaries]]'
  - '[[04_Decisions/DEC-0009_sandbox-filesystem-roots-and-allowlist-read-only-sql|DEC-0009 Sandbox Filesystem Roots and Allowlist Read-Only SQL]]'
  - '[[04_Decisions/DEC-0012_keep-fred-at-the-orchestration-boundary-for-typed-research-runs|DEC-0012 Keep Fred at the Orchestration Boundary for Typed Research Runs]]'
  - '[[04_Decisions/DEC-0013_use-tailwind-css-and-daisyui-with-a-custom-theme-for-frontend-styling|DEC-0013 Use Tailwind CSS and DaisyUI with a Custom Theme for Frontend Styling]]'
related_bugs: []
tags:
  - agent-vault
  - phase
  - v1
---

# Phase 00 Architecture Spikes and Delivery Foundations

Use this note as the canonical bounded milestone. Detailed execution belongs in linked step companion notes; architecture and durable choices belong in their linked notes.

## Objective

- Retire the highest-risk Fred, streaming, recovery, DuckDB, runtime, security, and evaluation uncertainties before the product architecture becomes expensive to change.

## Why This Phase Exists

- The product combines agentic orchestration, durable jobs, exact computation, native modules, hostile source content, and large recursive corpora. Narrow executable spikes must turn assumptions into measured contracts before the walking skeleton is built.

## Scope

- Pin and exercise the public Fred APIs for agents, tools, workflows, checkpoint stores, model routing, evaluation, replay, hooks, and observability.
- Prove or reject live progress, cancellation, cross-process resume, checkpoint composition, and large-result-by-reference approaches.
- Measure DuckDB Node Neo under Bun for JSON and Parquet, resource isolation, cancellation, concurrency, and failure containment.
- Define the monorepo boundaries, local production-like stack, trust boundaries, threat model, and evaluation corpus specification.
- Classify every integration gap as a product-local adapter, deferred concern, or candidate generic Fred contribution.

## Non-Goals

- Build end-user product features or a production UI.
- Commit to an uncertain Fred or DuckDB integration topology without spike evidence.
- Fork Fred or add application-specific behavior to Fred core.

## Dependencies

- No prior phase; this is the pre-implementation evidence gate.

## Acceptance Criteria

- [ ] A versioned compatibility matrix identifies the exact Fred packages and public APIs the product will consume.
- [ ] Executable spike evidence records whether live events, cancellation, restart recovery, and large outputs by reference meet defined thresholds.
- [ ] DuckDB/Bun/Parquet topology is selected from measured results, with isolation and fallback boundaries documented.
- [ ] The repository architecture, package boundaries, local stack, migration ownership, and CI quality gates are specified.
- [ ] The threat model covers registered filesystem roots, hostile content, SQL, tools, secrets, workspace isolation, and denial-of-service budgets.
- [ ] The approximately 25,000-JSON-file corpus, ground truth, deterministic generator, seed policy, and evaluation gates are specified.
- [ ] All unresolved findings have an owner, a bounded follow-up, and a product-local default; no spike silently becomes production code.

## Delivery Strategy

- **Safe parallel work:** Fred/runtime spikes, DuckDB topology work, security modeling, and evaluation-corpus specification may run in parallel. Repository contracts are finalized only after their evidence is reviewed.
- **Gate:** The phase closes only when all acceptance criteria have reproducible evidence and the relevant docs, migrations, security checks, telemetry, and evaluations are updated.
- **Boundary:** Post-v1 work must not be pulled forward in a way that weakens v1 completeness or its release gates.

## Linear Context

<!-- AGENT-START:phase-linear-context -->
- Previous phase: none
- Current phase status: completed
- Next phase: [[02_Phases/Phase_01_walking_skeleton/Phase|PHASE-01 Walking Skeleton]]
<!-- AGENT-END:phase-linear-context -->

## Related Architecture

<!-- AGENT-START:phase-related-architecture -->
- [[01_Architecture/System_Overview|System Overview]]
- [[01_Architecture/Domain_Model|Domain Model]]
- [[01_Architecture/Integration_Map|Integration Map]]
- [[01_Architecture/Agent_Workflow|Agent Workflow]]
<!-- AGENT-END:phase-related-architecture -->

## Related Decisions

<!-- AGENT-START:phase-related-decisions -->
- [[04_Decisions/DEC-0001_consume-stable-fred-packages-from-a-standalone-monorepo|DEC-0001 Consume Stable Fred Packages from a Standalone Monorepo]]
- [[04_Decisions/DEC-0002_prefer-product-local-adapters-before-fred-core-changes|DEC-0002 Prefer Product-Local Adapters Before Fred Core Changes]]
- [[04_Decisions/DEC-0003_use-typescript-bun-and-effect-with-explicit-runtime-boundaries|DEC-0003 Use TypeScript Bun and Effect with Explicit Runtime Boundaries]]
- [[04_Decisions/DEC-0009_sandbox-filesystem-roots-and-allowlist-read-only-sql|DEC-0009 Sandbox Filesystem Roots and Allowlist Read-Only SQL]]
- [[04_Decisions/DEC-0012_keep-fred-at-the-orchestration-boundary-for-typed-research-runs|DEC-0012 Keep Fred at the Orchestration Boundary for Typed Research Runs]]
- [[04_Decisions/DEC-0013_use-tailwind-css-and-daisyui-with-a-custom-theme-for-frontend-styling|DEC-0013 Use Tailwind CSS and DaisyUI with a Custom Theme for Frontend Styling]]
<!-- AGENT-END:phase-related-decisions -->

## Related Bugs

<!-- AGENT-START:phase-related-bugs -->
- None yet.
<!-- AGENT-END:phase-related-bugs -->

## Steps

<!-- AGENT-START:phase-steps -->
- [x] [[02_Phases/Phase_00_architecture_spikes_and_delivery_foundations/Steps/Step_01_spike-fred-runtime-and-workflow-integration|STEP-00-01 Spike Fred Runtime and Workflow Integration]]
- [x] [[02_Phases/Phase_00_architecture_spikes_and_delivery_foundations/Steps/Step_02_spike-live-events-cancellation-and-checkpoint-recovery|STEP-00-02 Spike Live Events Cancellation and Checkpoint Recovery]]
- [x] [[02_Phases/Phase_00_architecture_spikes_and_delivery_foundations/Steps/Step_03_spike-duckdb-bun-parquet-and-isolation-topology|STEP-00-03 Spike DuckDB Bun Parquet and Isolation Topology]]
- [x] [[02_Phases/Phase_00_architecture_spikes_and_delivery_foundations/Steps/Step_04_specify-repository-architecture-contracts-and-local-stack|STEP-00-04 Specify Repository Architecture Contracts and Local Stack]]
- [x] [[02_Phases/Phase_00_architecture_spikes_and_delivery_foundations/Steps/Step_05_specify-security-threat-model-and-trust-boundaries|STEP-00-05 Specify Security Threat Model and Trust Boundaries]]
- [x] [[02_Phases/Phase_00_architecture_spikes_and_delivery_foundations/Steps/Step_06_establish-evaluation-corpus-specification-and-quality-gates|STEP-00-06 Establish Evaluation Corpus Specification and Quality Gates]]
<!-- AGENT-END:phase-steps -->

## Notes

- Product requirements: authoritative repository document `docs/product-brief.md`.
- Human-readable roadmap: `docs/roadmap.md`; concise index: `docs/implementation-plan.md`.
- Assumption policy: reversible uncertainties use the documented default until spike evidence requires a decision update; no hidden architectural assumption is carried only in chat.

## Phase-Wide Refinement Contract

### Execution Mode

- This phase is **documentation-first plus disposable executable spikes**. Put durable evidence in `docs/spikes/` and non-canonical harnesses in `spikes/`; label every spike harness as disposable.
- Do not create the production `apps/` or `packages/` tree in Phase 0. [[02_Phases/Phase_01_walking_skeleton/Steps/Step_01_scaffold-monorepo-and-runtime-applications|STEP-01-01]] owns the first canonical monorepo scaffold.
- Existing ADRs remain authoritative. Update one only when measured evidence contradicts it; do not create placeholder `ADR-xxxx` files.

### Refined Sequencing

- STEP-00-01 establishes the Fred compatibility and ownership boundary first.
- STEP-00-02 and STEP-00-03 may execute in parallel after STEP-00-01 publishes the shared runtime handoff.
- STEP-00-05 and STEP-00-06 may research and draft in parallel. STEP-00-06 finalizes its adversarial/gate matrix only after STEP-00-05 publishes accepted threat categories and provisional limits.
- STEP-00-04 is the integration gate: draft it while spikes run, but call it final only after it reconciles STEP-00-01 through STEP-00-03 evidence and STEP-00-05/06 constraints.

### Evidence Contract

Every spike or specification must record:

- exact dependency versions, runtime versions, source commit when applicable, platform, CPU/memory assumptions, and the commands that produced the evidence;
- machine-readable raw results or trace/artifact references plus a human-readable decision table;
- pass/fail thresholds, observed failures, rejected alternatives, and recovery/fallback behavior;
- each unresolved gap classified as `product-local adapter`, `candidate generic Fred contribution`, or `deferred`, with owner, follow-up phase, and a safe product-local default;
- an explicit handoff naming what downstream steps may rely on and what remains provisional.

### Phase Close Rule

- The phase is ready to close only when all six step Outcome notes contain reproducible evidence or specification review evidence, every acceptance criterion is mapped to an artifact, and no spike code is silently treated as production code.
