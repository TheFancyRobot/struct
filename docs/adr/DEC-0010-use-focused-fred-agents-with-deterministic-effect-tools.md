# DEC-0010: Use Focused Fred Agents with Deterministic Effect Tools

## Status

Accepted.

## Context

The research product needs planning, evidence collection, deterministic computation, recursive analysis, and synthesis, but the brief explicitly prefers a small number of focused agents and many deterministic tools. Too many overlapping agents would make behavior harder to test, bound, and explain.

## Decision

Use a compact set of focused Fred agents for planning and synthesis responsibilities, and delegate retrieval, schema inspection, SQL execution, file reading, citation validation, and similar operations to deterministic Effect-based tools and services with typed schemas, bounded outputs, and typed failures.

## Alternatives

- Create many narrow agents for every subtask.
- Use one monolithic agent for planning, retrieval, SQL, and synthesis.
- Replace deterministic tools with free-form model reasoning wherever possible.

## Consequences

- The system stays easier to test, trace, and secure because core operations remain deterministic.
- Agent prompts can stay smaller and more purpose-built.
- More upfront design is required for tool contracts, validation, and observability.
- Capability expansion remains possible by adding tools and targeted agent roles instead of multiplying opaque agent behavior.

## Related Phase

- [PHASE-05 Typed Research Planning and Bounded Execution](../../.agent-vault/02_Phases/Phase_05_typed_research_planning_and_bounded_execution/Phase.md)
