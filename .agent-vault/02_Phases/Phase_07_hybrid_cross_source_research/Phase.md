---
note_type: phase
template_version: 2
contract_version: 1
title: Hybrid Cross-Source Research
phase_id: PHASE-07
status: completed
owner: Codex
created: '2026-07-17'
updated: '2026-07-20'
depends_on:
  - '[[02_Phases/Phase_05_typed_research_planning_and_bounded_execution/Phase|PHASE-05 Typed Research Planning and Bounded Execution]]'
  - '[[02_Phases/Phase_06_recursive_corpus_analysis/Phase|PHASE-06 Recursive Corpus Analysis]]'
related_architecture:
  - '[[01_Architecture/System_Overview|System Overview]]'
  - '[[01_Architecture/Domain_Model|Domain Model]]'
  - '[[01_Architecture/Integration_Map|Integration Map]]'
  - '[[01_Architecture/Agent_Workflow|Agent Workflow]]'
related_decisions:
  - '[[04_Decisions/DEC-0006_make-source-versions-immutable-and-provenance-typed|DEC-0006 Make Source Versions Immutable and Provenance Typed]]'
  - '[[04_Decisions/DEC-0007_compose-a-product-job-journal-with-fred-checkpoints|DEC-0007 Compose a Product Job Journal with Fred Checkpoints]]'
  - '[[04_Decisions/DEC-0010_use-focused-fred-agents-with-deterministic-effect-tools|DEC-0010 Use Focused Fred Agents with Deterministic Effect Tools]]'
  - '[[04_Decisions/DEC-0011_gate-releases-on-a-reproducible-25000-file-evaluation-corpus|DEC-0011 Gate Releases on a Reproducible 25000-File Evaluation Corpus]]'
related_bugs: []
tags:
  - agent-vault
  - phase
  - v1
---

# Phase 07 Hybrid Cross-Source Research

Use this note as the canonical bounded milestone. Detailed execution belongs in linked step companion notes; architecture and durable choices belong in their linked notes.

## Objective

- Answer mixed questions by routing document interpretation and dataset computation through separate evidence paths, reconciling them, and producing citation-backed hybrid conclusions.

## Why This Phase Exists

- The defining product experience combines qualitative documents, exact structured computation, and directory-scale context without weakening the guarantees of any source type.

## Scope

- Decompose mixed questions into typed qualitative, quantitative, recursive, and synthesis subproblems.
- Execute document and dataset branches in parallel when dependencies and budgets allow.
- Normalize evidence envelopes while preserving source-specific provenance and confidence semantics.
- Reconcile contradictions, time/version mismatches, units, filters, cohorts, and unsupported joins before synthesis.
- Produce an explorable mixed-source result demonstrating directory, document, dataset, progress, and citation behavior.
- Evaluate hybrid correctness, exact computation, semantic retrieval, provenance, injection resistance, model routing, and recovery.

## Non-Goals

- Turning datasets into text chunks to simplify orchestration.
- Letting narrative synthesis override deterministic quantitative results.
- Silently joining sources without explicit keys, versions, assumptions, and validation.

## Dependencies

- Depends on [[02_Phases/Phase_05_typed_research_planning_and_bounded_execution/Phase|PHASE-05 Typed Research Planning and Bounded Execution]].
- Depends on [[02_Phases/Phase_06_recursive_corpus_analysis/Phase|PHASE-06 Recursive Corpus Analysis]].

## Acceptance Criteria

- [x] Mixed questions compile to a typed plan whose branches and evidence requirements are visible before or during execution.
- [x] Document and dataset branches preserve their separate execution and provenance guarantees while sharing bounded orchestration.
- [x] Quantitative claims exactly match validated query results; narrative claims link to source spans; combined claims link to both.
- [x] Unit, date, cohort, filter, and version mismatches are normalized, disclosed, or rejected rather than guessed.
- [x] Contradictory and insufficient evidence remains visible in the final result.
- [x] The primary mixed-source demo runs end to end with replayable progress, cancellation, restart recovery, and navigable citations.
- [x] Hybrid-research, provenance, prompt-injection, exactness, semantic-retrieval, cost, and recovery gates pass.

## Delivery Strategy

- **Safe parallel work:** Document and dataset execution branches are intentionally parallel. Evidence reconciliation and synthesis are downstream gates and must not start until required deterministic results are validated.
- **Gate:** The phase closes only when all acceptance criteria have reproducible evidence and the relevant docs, migrations, security checks, telemetry, and evaluations are updated.
- **Boundary:** Post-v1 work must not be pulled forward in a way that weakens v1 completeness or its release gates.

## Linear Context

<!-- AGENT-START:phase-linear-context -->
- Previous phase: [[02_Phases/Phase_06_recursive_corpus_analysis/Phase|PHASE-06 Recursive Corpus Analysis]]
- Current phase status: planned
- Next phase: [[02_Phases/Phase_08_citation_backed_reports_and_durable_findings/Phase|PHASE-08 Citation-Backed Reports and Durable Findings]]
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
- [[04_Decisions/DEC-0006_make-source-versions-immutable-and-provenance-typed|DEC-0006 Make Source Versions Immutable and Provenance Typed]]
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
- [x] [[02_Phases/Phase_07_hybrid_cross_source_research/Steps/Step_01_define-hybrid-question-decomposition-and-source-routing|STEP-07-01 Define Hybrid Question Decomposition and Source Routing]]
- [x] [[02_Phases/Phase_07_hybrid_cross_source_research/Steps/Step_02_implement-parallel-document-and-dataset-research-branches|STEP-07-02 Implement Parallel Document and Dataset Research Branches]]
- [x] [[02_Phases/Phase_07_hybrid_cross_source_research/Steps/Step_03_normalize-and-reconcile-cross-source-evidence|STEP-07-03 Normalize and Reconcile Cross-Source Evidence]]
- [x] [[02_Phases/Phase_07_hybrid_cross_source_research/Steps/Step_04_build-hybrid-synthesis-with-quantitative-guardrails|STEP-07-04 Build Hybrid Synthesis with Quantitative Guardrails]]
- [x] [[02_Phases/Phase_07_hybrid_cross_source_research/Steps/Step_05_deliver-mixed-source-demo-and-explorable-report|STEP-07-05 Deliver Mixed-Source Demo and Explorable Report]]
- [x] [[02_Phases/Phase_07_hybrid_cross_source_research/Steps/Step_06_evaluate-hybrid-correctness-provenance-and-security|STEP-07-06 Evaluate Hybrid Correctness Provenance and Security]]
<!-- AGENT-END:phase-steps -->

## Notes

- Product requirements: authoritative repository document `docs/product-brief.md`.
- Human-readable roadmap: `docs/roadmap.md`; concise index: `docs/implementation-plan.md`.
- Assumption policy: reversible uncertainties use the documented default until spike evidence requires a decision update; no hidden architectural assumption is carried only in chat.
### Refinement record — 2026-07-20

- Reconciled against completed Phase 06 and current production surfaces: typed `ResearchPlan`/execution/event contracts, immutable source versions, document retrieval, dataset catalog/query-result snapshots and citations, Fred research/document/recursive graphs, bounded budgets/recovery, recursive evidence/contradictions/progress, API routes, and the SolidJS workbench.
- The six-step sequence remains valid but is integration-first: (1) extend the existing plan/routing contract, (2) coordinate existing branch executors concurrently, (3) normalize/reconcile without provenance loss, (4) guard synthesis so exact computations cannot drift, (5) deliver one polished explorable Solid UI flow, and (6) run a derived, tamper-resistant evaluation.
- Greenfield policy applies: prefer direct contract changes and drop/recreate for any database schema change; do not add legacy compatibility, migration-preservation scripts, duplicate abstractions, object-storage systems, DuckLake, or unrelated infrastructure.
- Effect work must follow current repository patterns plus `effect-ts`/`effect-best-practices` with typed errors, named effects, bounded concurrency, cancellation, and trusted-boundary normalization. STEP-07-05 must follow `solidjs`/`frontend-design` and the existing NotebookLM-inspired slate/blue light/dark system, with thorough Playwright responsive/accessibility verification and six inspected screenshots.
- Every step has an explicit pre-PR self-review, focused tests, typecheck, lint, full suite, security/provenance scan, and clean vault doctor gate. No known confirmed defect may advance.

### Completion Summary — 2026-07-20

- All six steps are complete and the final deterministic hybrid evaluation reports zero known defects.
- The shipped boundary separates document and dataset execution, normalizes and reconciles typed evidence, guards quantitative synthesis, exposes an explorable SolidJS report, and verifies routing, exactness, provenance, contradiction visibility, resource budgets, recovery, cancellation, and prompt-injection containment.
- Durable evaluation artifact: `packages/evaluation/results/phase-07-hybrid-research-v1.json`; reproduction: `bun run --filter @struct/evaluation phase-07:eval`.
- Handoff: Phase 08 is refined against these shipped contracts before durable findings and reports are implemented.
