---
note_type: decision
template_version: 2
contract_version: 1
title: Use Focused Fred Agents with Deterministic Effect Tools
decision_id: DEC-0010
status: accepted
decided_on: '2026-07-17'
owner: ''
created: '2026-07-17'
updated: '2026-07-17'
supersedes: []
superseded_by: []
related_notes:
  - '[[02_Phases/Phase_05_typed_research_planning_and_bounded_execution/Phase|PHASE-05 Typed Research Planning and Bounded Execution]]'
  - '[[01_Architecture/System_Overview|System Overview]]'
tags:
  - agent-vault
  - decision
  - architecture
---

# DEC-0010 - Use Focused Fred Agents with Deterministic Effect Tools

## Status

- Current status: accepted.
- Revisit when a linked spike contradicts the selected boundary or the documented promotion/scale criterion is met.

## Context

- Fred is required for research planning and orchestration, but many operations are deterministic, security-sensitive, or too large for model contexts. Broad autonomous agents would weaken repeatability, cost control, and provenance.

## Decision

- Use small purpose-specific Fred agents for planning, qualitative interpretation, sufficiency/contradiction judgments, and synthesis.
- Implement hashing, parsing, manifests, retrieval, SQL validation/execution, aggregation, citation validation, persistence, and authorization as typed Effect services/tools.
- Validate model outputs against schemas and deterministic policy before execution.
- Batch and aggregate corpora deterministically; never make one model call per file by default.

## Alternatives Considered

- One general autonomous agent — rejected because authority, failure, cost, and evaluation boundaries are unclear.
- No agents, deterministic pipeline only — rejected because nuanced planning and synthesis need model judgment.
- Agent-generated application code/SQL executed directly — rejected because it expands the trusted computing base.

## Tradeoffs

- More explicit tools and agents require contract design.
- Some questions will return insufficient evidence rather than improvise.

## Consequences

- Tool registry and agent capability maps are versioned.
- Model/provider routing is policy-driven and observable.
- Evaluation separates deterministic correctness from model quality.

## Related Notes

<!-- AGENT-START:decision-related-notes -->
- Phase: [[02_Phases/Phase_05_typed_research_planning_and_bounded_execution/Phase|PHASE-05 Typed Research Planning and Bounded Execution]]
- Architecture: [[01_Architecture/System_Overview|System Overview]]
- Product requirements: `docs/product-brief.md`
<!-- AGENT-END:decision-related-notes -->

## Change Log

<!-- AGENT-START:decision-change-log -->
- 2026-07-17 - Accepted during greenfield architecture planning; implementation remains gated by the linked phase and spikes.
<!-- AGENT-END:decision-change-log -->
