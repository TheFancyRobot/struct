# Implementation Plan

This file is the concise delivery index for the product. Detailed execution steps live in the canonical phase notes under `.agent-vault/02_Phases/`; this plan focuses on sequencing, dependencies, acceptance direction, and major risks without duplicating step-level detail.

## Delivery rules

- Build in small vertical slices and keep the product runnable at the end of each phase.
- Ship tests, migrations, documentation, and observability work inside every phase.
- Keep exact computation deterministic and bounded.
- Treat imported content as untrusted evidence, never as instruction.
- Prefer product-local adapters before proposing Fred-core changes.

## Repository and local-stack contracts

Phase 0 fixed the repository-level delivery contract and local stack that the rest of this plan depends on:

- [`docs/architecture.md`](./architecture.md) — repository layout, package dependency directions, public/internal contract ownership, Fred pinning/lockfile policy, and migration ownership.
- [`docs/repository-contract.md`](./repository-contract.md) — root command inventory, CI gate matrix (PR / nightly / pre-release), and the Phase 1 handoff (exact initial files and deferrals).
- [`docs/local-development.md`](./local-development.md) — current local stack
  (PostgreSQL/pgvector plus Bun host apps), the planned Phase-04 isolated
  DuckDB sidecar boundary, environment/secrets policy, and platform fallbacks.

These contracts are decision-oriented Phase 0 outputs; STEP-01-01 owns canonical scaffolding.

## Phase sequence

| Phase | Goal | Depends on | Canonical phase note |
| --- | --- | --- | --- |
| PHASE-00 | De-risk repository placement, runtime boundaries, DuckDB topology, security model, and evaluation strategy. | none | [`../.agent-vault/02_Phases/Phase_00_architecture_spikes_and_delivery_foundations/Phase.md`](../.agent-vault/02_Phases/Phase_00_architecture_spikes_and_delivery_foundations/Phase.md) |
| PHASE-01 | Prove the end-to-end boundary with one text source, one research workflow, streaming progress, and one navigable citation. | PHASE-00 | [`../.agent-vault/02_Phases/Phase_01_walking_skeleton/Phase.md`](../.agent-vault/02_Phases/Phase_01_walking_skeleton/Phase.md) |
| PHASE-02 | Add production-grade document ingestion, versioned chunks, hybrid retrieval, and citation-backed synthesis. | PHASE-01 | [`../.agent-vault/02_Phases/Phase_02_document_research_and_hybrid_retrieval/Phase.md`](../.agent-vault/02_Phases/Phase_02_document_research_and_hybrid_retrieval/Phase.md) |
| PHASE-03 | Add sandboxed directory registration, recursive manifests, resumable ingestion, and incremental refresh. | PHASE-01 (can overlap PHASE-02) | [`../.agent-vault/02_Phases/Phase_03_durable_directory_ingestion_and_source_refresh/Phase.md`](../.agent-vault/02_Phases/Phase_03_durable_directory_ingestion_and_source_refresh/Phase.md) |
| PHASE-04 | Promote structured data to a first-class research source with safe DuckDB queries, provenance, and corpus-based evaluation. | PHASE-03 | [`../.agent-vault/02_Phases/Phase_04_structured_datasets_and_deterministic_sql/Phase.md`](../.agent-vault/02_Phases/Phase_04_structured_datasets_and_deterministic_sql/Phase.md) |
| PHASE-05 | Introduce typed research planning, bounded execution, cancellation, replay, and durable job state. | PHASE-02, PHASE-04 | [`../.agent-vault/02_Phases/Phase_05_typed_research_planning_and_bounded_execution/Phase.md`](../.agent-vault/02_Phases/Phase_05_typed_research_planning_and_bounded_execution/Phase.md) |
| PHASE-06 | Add recursive decomposition for large-corpus semantic analysis with coverage and contradiction tracking. | PHASE-04, PHASE-05 | [`../.agent-vault/02_Phases/Phase_06_recursive_corpus_analysis/Phase.md`](../.agent-vault/02_Phases/Phase_06_recursive_corpus_analysis/Phase.md) |
| PHASE-07 | Combine document, dataset, directory, and code evidence into one mixed-source research workflow. | PHASE-05, PHASE-06 | [`../.agent-vault/02_Phases/Phase_07_hybrid_cross_source_research/Phase.md`](../.agent-vault/02_Phases/Phase_07_hybrid_cross_source_research/Phase.md) |
| PHASE-08 | Add durable findings, citation validation, report authoring, and export. | PHASE-07 | [`../.agent-vault/02_Phases/Phase_08_citation_backed_reports_and_durable_findings/Phase.md`](../.agent-vault/02_Phases/Phase_08_citation_backed_reports_and_durable_findings/Phase.md) |
| PHASE-09 | Harden security, migrations, operations, benchmarks, accessibility, and release gates for v1. | PHASE-02 through PHASE-08 | [`../.agent-vault/02_Phases/Phase_09_v1_production_hardening_and_release/Phase.md`](../.agent-vault/02_Phases/Phase_09_v1_production_hardening_and_release/Phase.md) |
| PHASE-10 | Improve research usability with saved views, templates, and stronger navigation. | PHASE-09 | [`../.agent-vault/02_Phases/Phase_10_v1_1_research_usability/Phase.md`](../.agent-vault/02_Phases/Phase_10_v1_1_research_usability/Phase.md) |
| PHASE-11 | Add secure external source connectors and bounded import/export flows. | PHASE-10 | [`../.agent-vault/02_Phases/Phase_11_v1_2_additional_sources/Phase.md`](../.agent-vault/02_Phases/Phase_11_v1_2_additional_sources/Phase.md) |
| PHASE-12 | Add scheduled refresh, change-triggered reruns, and alerting. | PHASE-11 | [`../.agent-vault/02_Phases/Phase_12_v1_3_continuous_research/Phase.md`](../.agent-vault/02_Phases/Phase_12_v1_3_continuous_research/Phase.md) |
| PHASE-13 | Add collaboration, review, policy, and audit workflows. | PHASE-12 | [`../.agent-vault/02_Phases/Phase_13_v1_4_collaboration_and_governance/Phase.md`](../.agent-vault/02_Phases/Phase_13_v1_4_collaboration_and_governance/Phase.md) |
| PHASE-14 | Extend into advanced comparative and policy-driven research modes. | PHASE-13 | [`../.agent-vault/02_Phases/Phase_14_v1_5_advanced_research/Phase.md`](../.agent-vault/02_Phases/Phase_14_v1_5_advanced_research/Phase.md) |
| PHASE-15 | Scale the platform with distribution, tenancy controls, and upstreamed generic improvements where justified. | PHASE-14 | [`../.agent-vault/02_Phases/Phase_15_v2_scaled_research_platform/Phase.md`](../.agent-vault/02_Phases/Phase_15_v2_scaled_research_platform/Phase.md) |

## v1 versus post-v1

### Required for v1

- **PHASE-00 to PHASE-09** together deliver the architecture baseline, walking skeleton, document research, directory durability, deterministic dataset analysis, bounded research orchestration, recursive corpus analysis, mixed-source synthesis, report generation, and release hardening needed for v1.

### Post-v1

- **PHASE-10 to PHASE-15** improve usability, connectors, continuous refresh, collaboration, advanced research modes, and multi-tenant scale after the evidence-first core is stable.

## Cross-phase acceptance expectations

Each phase is only complete when it leaves behind:

1. A working vertical slice or measurable hardening gain.
2. Targeted automated tests plus relevant integration coverage.
3. Any required schema or data migrations.
4. Updated operator and architecture documentation.
5. Observable traces, metrics, or logs for the new behavior.
6. Recorded limitations, follow-on risks, and explicit handoff notes.

## Primary risks and planned containment

| Risk | Why it matters | Containment phase |
| --- | --- | --- |
| DuckDB + Bun integration instability | The structured-data path and exact-answer promise depend on a stable data plane. | PHASE-00, PHASE-04 |
| Citation drift across source refresh | Weak versioning would make saved findings and historical runs untrustworthy. | PHASE-01, PHASE-03, PHASE-08 |
| Run durability and replay gaps | Long ingestion and research jobs must survive restart, cancellation, and partial failure. | PHASE-03, PHASE-05 |
| Prompt injection via imported sources | The product ingests untrusted documents, JSON, logs, and code. | PHASE-00, PHASE-02, PHASE-09 |
| Recursive-analysis cost or coverage regressions | Large semantic investigations can become expensive or lose minority findings. | PHASE-06, PHASE-07, PHASE-09 |
| Evaluation blind spots | v1 cannot ship on anecdotal demos alone. | PHASE-04, PHASE-09 |

## Decision anchors

- Repository placement and core framework boundaries: DEC-0001, DEC-0002, DEC-0003
- Retrieval and structured-data foundations: DEC-0004, DEC-0005, DEC-0006
- Durability, API, and orchestration: DEC-0007, DEC-0008, DEC-0010
- Security and release quality gates: DEC-0009, DEC-0011
