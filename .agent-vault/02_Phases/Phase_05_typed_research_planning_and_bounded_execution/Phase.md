---
note_type: phase
template_version: 2
contract_version: 1
title: Typed Research Planning and Bounded Execution
phase_id: PHASE-05
status: planned
owner: ''
created: '2026-07-17'
updated: '2026-07-17'
depends_on: 
  - '[[02_Phases/Phase_02_document_research_and_hybrid_retrieval/Phase|PHASE-02 Document Research and Hybrid Retrieval]]'
  - '[[02_Phases/Phase_04_structured_datasets_and_deterministic_sql/Phase|PHASE-04 Structured Datasets and Deterministic SQL]]'
related_architecture:
  - '[[01_Architecture/System_Overview|System Overview]]'
  - '[[01_Architecture/Domain_Model|Domain Model]]'
  - '[[01_Architecture/Integration_Map|Integration Map]]'
  - '[[01_Architecture/Agent_Workflow|Agent Workflow]]'
related_decisions: 
  - '[[04_Decisions/DEC-0002_prefer-product-local-adapters-before-fred-core-changes|DEC-0002 Prefer Product-Local Adapters Before Fred Core Changes]]'
  - '[[04_Decisions/DEC-0007_compose-a-product-job-journal-with-fred-checkpoints|DEC-0007 Compose a Product Job Journal with Fred Checkpoints]]'
  - '[[04_Decisions/DEC-0010_use-focused-fred-agents-with-deterministic-effect-tools|DEC-0010 Use Focused Fred Agents with Deterministic Effect Tools]]'
related_bugs: []
tags:
  - agent-vault
  - phase
  - v1
---

# Phase 05 Typed Research Planning and Bounded Execution

Use this note as the canonical bounded milestone. Detailed execution belongs in linked step companion notes; architecture and durable choices belong in their linked notes.

## Objective

- Introduce schema-validated research plans and bounded Fred orchestration that route deterministic tools, persist progress, enforce budgets, and resume or cancel safely.

## Why This Phase Exists

- Research must be inspectable and recoverable rather than an opaque agent loop. A typed plan is the contract between intent, tool policy, workflow execution, evidence, and user-visible progress.

## Scope

- Define typed question classification, research plan, plan node, dependency, budget, tool policy, evidence requirement, and execution-state schemas.
- Use Fred agents to propose plans, then validate and normalize them deterministically before any tool executes.
- Compile valid plans to bounded Fred workflows/graphs with capability-aware model routing and focused agents.
- Compose Fred checkpoints with product job/event persistence, cancellation, leases, idempotency keys, and large artifacts by reference.
- Register typed Effect tools with explicit inputs, outputs, failures, retry classes, authorization, and observability.
- Evaluate plan validity, budget enforcement, replay, model/provider failure, tool failure, cancellation, and restart recovery.

## Non-Goals

- Unbounded autonomous loops, agent-authored executable code, or model calls for deterministic transforms.
- Making Fred checkpoints the sole product job or event store.
- Upstreaming product-specific behavior into Fred before a generic need is demonstrated.

## Dependencies

- Depends on [[02_Phases/Phase_02_document_research_and_hybrid_retrieval/Phase|PHASE-02 Document Research and Hybrid Retrieval]].
- Depends on [[02_Phases/Phase_04_structured_datasets_and_deterministic_sql/Phase|PHASE-04 Structured Datasets and Deterministic SQL]].

## Acceptance Criteria

- [ ] Every run persists a schema-valid plan or a typed planning failure before execution begins.
- [ ] Invalid tools, cycles, missing dependencies, excess fan-out, unsupported capabilities, and budget violations are rejected deterministically.
- [ ] Fred executes only registered typed tools and focused agent nodes under workspace, model, cost, time, and concurrency policies.
- [ ] Live progress derives from committed product events and survives reconnect, cancellation, worker replacement, and cross-process resume.
- [ ] Tool and model failures preserve typed categories, retry eligibility, attempt history, evidence, and operator diagnostics.
- [ ] Replay and golden-trace tests detect plan, routing, tool-contract, and workflow regressions.
- [ ] Candidate generic Fred gaps are documented with portable reproductions; product delivery does not wait for optional upstream changes.

## Delivery Strategy

- **Safe parallel work:** Planner/schema work, product job journal work, and tool-registry work may proceed in parallel against agreed contracts; graph execution integrates them before evaluation.
- **Gate:** The phase closes only when all acceptance criteria have reproducible evidence and the relevant docs, migrations, security checks, telemetry, and evaluations are updated.
- **Boundary:** Post-v1 work must not be pulled forward in a way that weakens v1 completeness or its release gates.

## Linear Context

<!-- AGENT-START:phase-linear-context -->
- Previous phase: [[02_Phases/Phase_04_structured_datasets_and_deterministic_sql/Phase|PHASE-04 Structured Datasets and Deterministic SQL]]
- Current phase status: planned
- Next phase: [[02_Phases/Phase_06_recursive_corpus_analysis/Phase|PHASE-06 Recursive Corpus Analysis]]
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
- [[04_Decisions/DEC-0002_prefer-product-local-adapters-before-fred-core-changes|DEC-0002 Prefer Product-Local Adapters Before Fred Core Changes]]
- [[04_Decisions/DEC-0007_compose-a-product-job-journal-with-fred-checkpoints|DEC-0007 Compose a Product Job Journal with Fred Checkpoints]]
- [[04_Decisions/DEC-0010_use-focused-fred-agents-with-deterministic-effect-tools|DEC-0010 Use Focused Fred Agents with Deterministic Effect Tools]]
<!-- AGENT-END:phase-related-decisions -->

## Related Bugs

<!-- AGENT-START:phase-related-bugs -->
- None yet.
<!-- AGENT-END:phase-related-bugs -->

## Steps

<!-- AGENT-START:phase-steps -->
- [ ] [[02_Phases/Phase_05_typed_research_planning_and_bounded_execution/Steps/Step_01_define-typed-research-plan-and-execution-schemas|STEP-05-01 Define Typed Research Plan and Execution Schemas]]
- [ ] [[02_Phases/Phase_05_typed_research_planning_and_bounded_execution/Steps/Step_02_implement-fred-planner-with-validated-deterministic-plans|STEP-05-02 Implement Fred Planner with Validated Deterministic Plans]]
- [ ] [[02_Phases/Phase_05_typed_research_planning_and_bounded_execution/Steps/Step_03_implement-bounded-graph-orchestration-and-model-routing|STEP-05-03 Implement Bounded Graph Orchestration and Model Routing]]
- [ ] [[02_Phases/Phase_05_typed_research_planning_and_bounded_execution/Steps/Step_04_persist-checkpoints-events-budgets-and-cancellation|STEP-05-04 Persist Checkpoints Events Budgets and Cancellation]]
- [ ] [[02_Phases/Phase_05_typed_research_planning_and_bounded_execution/Steps/Step_05_implement-tool-registry-typed-failures-retries-and-recovery|STEP-05-05 Implement Tool Registry Typed Failures Retries and Recovery]]
- [ ] [[02_Phases/Phase_05_typed_research_planning_and_bounded_execution/Steps/Step_06_evaluate-planning-execution-replay-and-recovery|STEP-05-06 Evaluate Planning Execution Replay and Recovery]]
<!-- AGENT-END:phase-steps -->

## Notes

- Product requirements: authoritative repository document `docs/product-brief.md`.
- Human-readable roadmap: `docs/roadmap.md`; concise index: `docs/implementation-plan.md`.
- Assumption policy: reversible uncertainties use the documented default until spike evidence requires a decision update; no hidden architectural assumption is carried only in chat.
