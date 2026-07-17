---
note_type: phase
template_version: 2
contract_version: 1
title: Recursive Corpus Analysis
phase_id: PHASE-06
status: planned
owner: ''
created: '2026-07-17'
updated: '2026-07-17'
depends_on: 
  - '[[02_Phases/Phase_04_structured_datasets_and_deterministic_sql/Phase|PHASE-04 Structured Datasets and Deterministic SQL]]'
  - '[[02_Phases/Phase_05_typed_research_planning_and_bounded_execution/Phase|PHASE-05 Typed Research Planning and Bounded Execution]]'
related_architecture:
  - '[[01_Architecture/System_Overview|System Overview]]'
  - '[[01_Architecture/Domain_Model|Domain Model]]'
  - '[[01_Architecture/Integration_Map|Integration Map]]'
  - '[[01_Architecture/Agent_Workflow|Agent Workflow]]'
related_decisions: 
  - '[[04_Decisions/DEC-0007_compose-a-product-job-journal-with-fred-checkpoints|DEC-0007 Compose a Product Job Journal with Fred Checkpoints]]'
  - '[[04_Decisions/DEC-0010_use-focused-fred-agents-with-deterministic-effect-tools|DEC-0010 Use Focused Fred Agents with Deterministic Effect Tools]]'
  - '[[04_Decisions/DEC-0011_gate-releases-on-a-reproducible-25000-file-evaluation-corpus|DEC-0011 Gate Releases on a Reproducible 25000-File Evaluation Corpus]]'
related_bugs: []
tags:
  - agent-vault
  - phase
  - v1
---

# Phase 06 Recursive Corpus Analysis

Use this note as the canonical bounded milestone. Detailed execution belongs in linked step companion notes; architecture and durable choices belong in their linked notes.

## Objective

- Analyze corpora too large for one context through deterministic partitioning, bounded recursive decomposition, evidence artifacts, contradiction-aware synthesis, and recoverable partial results.

## Why This Phase Exists

- The primary directory use case includes about 25,000 files. It must be solved with hierarchical computation and reuse, not prompt stuffing or one model call per file.

## Scope

- Define typed decomposition, partition, batch-result, aggregation, contradiction, sufficiency, and stop-condition contracts.
- Partition manifests deterministically by schema, path, size, and research plan while enforcing fan-out, depth, token, cost, and concurrency budgets.
- Perform deterministic filtering, extraction, grouping, and aggregation before invoking models.
- Use focused Fred nodes for qualitative batch judgments and hierarchical synthesis over bounded evidence artifacts.
- Persist reusable intermediate artifacts, partial results, progress trees, and restart-safe checkpoints.
- Evaluate recursive exactness, semantic coverage, contradiction retention, prompt injection, budget compliance, failure recovery, and 25,000-file scale.

## Non-Goals

- A model invocation for every file, unbounded recursive spawning, or loading the complete corpus into an agent context.
- Hybrid document-and-dataset final synthesis beyond the contracts needed by Phase 07.
- Hiding partial failures or unsupported sources behind a confident summary.

## Dependencies

- Depends on [[02_Phases/Phase_04_structured_datasets_and_deterministic_sql/Phase|PHASE-04 Structured Datasets and Deterministic SQL]].
- Depends on [[02_Phases/Phase_05_typed_research_planning_and_bounded_execution/Phase|PHASE-05 Typed Research Planning and Bounded Execution]].

## Acceptance Criteria

- [ ] The same corpus version and plan produce deterministic partitions and stable aggregation identities.
- [ ] Recursion respects configured depth, fan-out, concurrency, time, token, model-cost, byte, and artifact limits.
- [ ] Deterministic precomputation materially reduces model input and no per-file model-call path exists.
- [ ] Interrupted and partially failed branches resume or retry without redoing committed work; unaffected artifacts are reused.
- [ ] Final and partial results retain supporting, conflicting, missing, and excluded evidence with complete lineage.
- [ ] Users can inspect progress from run to partition to batch to evidence and understand partial-result quality.
- [ ] The approximately 25,000-file corpus passes recursive-analysis, provenance, prompt-injection, and recovery gates at documented performance/cost bounds.

## Delivery Strategy

- **Safe parallel work:** Deterministic partition/extraction and progress-tree UX can proceed in parallel; Fred recursive synthesis begins after evidence-artifact contracts stabilize.
- **Gate:** The phase closes only when all acceptance criteria have reproducible evidence and the relevant docs, migrations, security checks, telemetry, and evaluations are updated.
- **Boundary:** Post-v1 work must not be pulled forward in a way that weakens v1 completeness or its release gates.

## Linear Context

<!-- AGENT-START:phase-linear-context -->
- Previous phase: [[02_Phases/Phase_05_typed_research_planning_and_bounded_execution/Phase|PHASE-05 Typed Research Planning and Bounded Execution]]
- Current phase status: planned
- Next phase: [[02_Phases/Phase_07_hybrid_cross_source_research/Phase|PHASE-07 Hybrid Cross-Source Research]]
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
- [[04_Decisions/DEC-0007_compose-a-product-job-journal-with-fred-checkpoints|DEC-0007 Compose a Product Job Journal with Fred Checkpoints]]
- [[04_Decisions/DEC-0010_use-focused-fred-agents-with-deterministic-effect-tools|DEC-0010 Use Focused Fred Agents with Deterministic Effect Tools]]
- [[04_Decisions/DEC-0011_gate-releases-on-a-reproducible-25000-file-evaluation-corpus|DEC-0011 Gate Releases on a Reproducible 25000-File Evaluation Corpus]]
<!-- AGENT-END:phase-related-decisions -->

## Related Bugs

<!-- AGENT-START:phase-related-bugs -->
- None yet.
<!-- AGENT-END:phase-related-bugs -->

## Steps

<!-- AGENT-START:phase-steps -->
- [ ] [[02_Phases/Phase_06_recursive_corpus_analysis/Steps/Step_01_define-recursive-decomposition-and-aggregation-contracts|STEP-06-01 Define Recursive Decomposition and Aggregation Contracts]]
- [ ] [[02_Phases/Phase_06_recursive_corpus_analysis/Steps/Step_02_implement-bounded-corpus-partitioning-and-scheduling|STEP-06-02 Implement Bounded Corpus Partitioning and Scheduling]]
- [ ] [[02_Phases/Phase_06_recursive_corpus_analysis/Steps/Step_03_implement-deterministic-batch-extraction-and-evidence-artifacts|STEP-06-03 Implement Deterministic Batch Extraction and Evidence Artifacts]]
- [ ] [[02_Phases/Phase_06_recursive_corpus_analysis/Steps/Step_04_implement-recursive-fred-synthesis-and-contradiction-handling|STEP-06-04 Implement Recursive Fred Synthesis and Contradiction Handling]]
- [ ] [[02_Phases/Phase_06_recursive_corpus_analysis/Steps/Step_05_add-progress-drilldown-and-partial-result-ux|STEP-06-05 Add Progress Drilldown and Partial Result UX]]
- [ ] [[02_Phases/Phase_06_recursive_corpus_analysis/Steps/Step_06_evaluate-25000-file-recursive-analysis-and-recovery|STEP-06-06 Evaluate 25000-File Recursive Analysis and Recovery]]
<!-- AGENT-END:phase-steps -->

## Notes

- Product requirements: authoritative repository document `docs/product-brief.md`.
- Human-readable roadmap: `docs/roadmap.md`; concise index: `docs/implementation-plan.md`.
- Assumption policy: reversible uncertainties use the documented default until spike evidence requires a decision update; no hidden architectural assumption is carried only in chat.
