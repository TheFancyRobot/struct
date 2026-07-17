---
note_type: phase
template_version: 2
contract_version: 1
title: Document Research and Hybrid Retrieval
phase_id: PHASE-02
status: planned
owner: ''
created: '2026-07-17'
updated: '2026-07-17'
depends_on: 
  - '[[02_Phases/Phase_01_walking_skeleton/Phase|PHASE-01 Walking Skeleton]]'
related_architecture:
  - '[[01_Architecture/System_Overview|System Overview]]'
  - '[[01_Architecture/Domain_Model|Domain Model]]'
  - '[[01_Architecture/Integration_Map|Integration Map]]'
  - '[[01_Architecture/Agent_Workflow|Agent Workflow]]'
related_decisions: 
  - '[[04_Decisions/DEC-0004_use-postgresql-full-text-search-and-pgvector-for-initial-retrieval|DEC-0004 Use PostgreSQL Full-Text Search and pgvector for Initial Retrieval]]'
  - '[[04_Decisions/DEC-0006_make-source-versions-immutable-and-provenance-typed|DEC-0006 Make Source Versions Immutable and Provenance Typed]]'
related_bugs: []
tags:
  - agent-vault
  - phase
  - v1
---

# Phase 02 Document Research and Hybrid Retrieval

Use this note as the canonical bounded milestone. Detailed execution belongs in linked step companion notes; architecture and durable choices belong in their linked notes.

## Objective

- Turn the skeleton into a trustworthy document-research slice with versioned parsing, hybrid retrieval, evidence sufficiency, navigable citations, and adversarial evaluation.

## Why This Phase Exists

- Useful qualitative research requires more than one text fixture: document structure, retrieval quality, provenance, and untrusted-content handling must work together as one testable capability.

## Scope

- Parse and normalize the v1 document formats selected by the product brief while retaining page, section, paragraph, and byte/character locators.
- Persist versioned chunks and derived indexes that can be rebuilt without changing original source lineage.
- Combine PostgreSQL full-text and pgvector candidates with deterministic fusion, filters, and workspace scoping.
- Use a focused Fred workflow for query decomposition, evidence sufficiency, contradiction surfacing, and synthesis.
- Provide document search/research UX with source previews, citation navigation, and explicit unsupported or insufficient-evidence states.
- Add semantic-retrieval, provenance, prompt-injection, migration, and regression evaluations.

## Non-Goals

- Recursive directory scheduling, structured dataset computation, or cross-source quantitative synthesis.
- Allowing embeddings or models to become the source of citation truth.
- Introducing a dedicated vector database before measured PostgreSQL limits justify it.

## Dependencies

- Depends on [[02_Phases/Phase_01_walking_skeleton/Phase|PHASE-01 Walking Skeleton]].

## Acceptance Criteria

- [ ] Supported document fixtures ingest into immutable versions with stable structural locators and deterministic chunk identities.
- [ ] Keyword, vector, and fused retrieval are workspace-scoped, filterable, reproducible, and covered by ranking tests.
- [ ] Research answers distinguish supported claims, contradictions, and insufficient evidence.
- [ ] Every citation resolves to the exact original version and visible source location after index rebuilds.
- [ ] Injected instructions inside documents cannot change tool policy, system behavior, workspace scope, or citation validation.
- [ ] Retrieval quality, latency, cost, and citation-validity thresholds pass the documented evaluation set.
- [ ] Migrations, reindexing, traces, dashboards, user docs, and failure recovery are exercised end to end.

## Delivery Strategy

- **Safe parallel work:** Document parser adapters and retrieval-index implementation can proceed in parallel behind frozen source-version and locator contracts; UX may start against contract fixtures.
- **Gate:** The phase closes only when all acceptance criteria have reproducible evidence and the relevant docs, migrations, security checks, telemetry, and evaluations are updated.
- **Boundary:** Post-v1 work must not be pulled forward in a way that weakens v1 completeness or its release gates.

## Linear Context

<!-- AGENT-START:phase-linear-context -->
- Previous phase: [[02_Phases/Phase_01_walking_skeleton/Phase|PHASE-01 Walking Skeleton]]
- Current phase status: planned
- Next phase: [[02_Phases/Phase_03_durable_directory_ingestion_and_source_refresh/Phase|PHASE-03 Durable Directory Ingestion and Source Refresh]]
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
- [[04_Decisions/DEC-0004_use-postgresql-full-text-search-and-pgvector-for-initial-retrieval|DEC-0004 Use PostgreSQL Full-Text Search and pgvector for Initial Retrieval]]
- [[04_Decisions/DEC-0006_make-source-versions-immutable-and-provenance-typed|DEC-0006 Make Source Versions Immutable and Provenance Typed]]
<!-- AGENT-END:phase-related-decisions -->

## Related Bugs

<!-- AGENT-START:phase-related-bugs -->
- None yet.
<!-- AGENT-END:phase-related-bugs -->

## Steps

<!-- AGENT-START:phase-steps -->
- [ ] [[02_Phases/Phase_02_document_research_and_hybrid_retrieval/Steps/Step_01_parse-and-normalize-supported-documents|STEP-02-01 Parse and Normalize Supported Documents]]
- [ ] [[02_Phases/Phase_02_document_research_and_hybrid_retrieval/Steps/Step_02_implement-versioned-document-chunks-and-index-migrations|STEP-02-02 Implement Versioned Document Chunks and Index Migrations]]
- [ ] [[02_Phases/Phase_02_document_research_and_hybrid_retrieval/Steps/Step_03_implement-keyword-vector-and-hybrid-retrieval|STEP-02-03 Implement Keyword Vector and Hybrid Retrieval]]
- [ ] [[02_Phases/Phase_02_document_research_and_hybrid_retrieval/Steps/Step_04_build-document-research-and-evidence-sufficiency-workflow|STEP-02-04 Build Document Research and Evidence Sufficiency Workflow]]
- [ ] [[02_Phases/Phase_02_document_research_and_hybrid_retrieval/Steps/Step_05_add-document-research-ux-and-citation-navigation|STEP-02-05 Add Document Research UX and Citation Navigation]]
- [ ] [[02_Phases/Phase_02_document_research_and_hybrid_retrieval/Steps/Step_06_evaluate-retrieval-provenance-and-injection-resistance|STEP-02-06 Evaluate Retrieval Provenance and Injection Resistance]]
<!-- AGENT-END:phase-steps -->

## Notes

- Product requirements: authoritative repository document `docs/product-brief.md`.
- Human-readable roadmap: `docs/roadmap.md`; concise index: `docs/implementation-plan.md`.
- Assumption policy: reversible uncertainties use the documented default until spike evidence requires a decision update; no hidden architectural assumption is carried only in chat.
