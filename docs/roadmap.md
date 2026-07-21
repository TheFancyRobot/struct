# Roadmap

This roadmap mirrors the current 16-phase vault plan and keeps delivery aligned with the product brief: build a trustworthy Fred-powered research workspace for documents, datasets, and directories with deterministic computation, recursive analysis, and verifiable citations.

## Roadmap guardrails

- **v1 scope ends at PHASE-09.** Phases 10-15 are post-v1 expansion.
- **Phase notes are the execution source of truth.** Detailed step breakdowns live in the linked `Phase.md` files under `.agent-vault/02_Phases/`.
- **Every phase must ship tests, documentation, migrations, and observability updates** alongside feature work.
- **Exact answers stay deterministic.** Dataset questions are answered through bounded read-only SQL, not prose summarization.
- **Evidence quality is a release gate.** Citation validity, source-version lineage, and evaluation performance are core roadmap requirements.
- **Repository and local-stack contracts are fixed in Phase 0.** See [`docs/repository-contract.md`](./repository-contract.md) (command inventory, CI gate matrix, Phase 1 handoff) and [`docs/local-development.md`](./local-development.md) (local service table, environment/secrets, platform fallbacks). Package dependency directions, Fred pinning, and migration ownership live in [`docs/architecture.md`](./architecture.md).

## Horizon 1: Foundations through v1

| Phase | Focus | Target outcome | Decision anchors |
| --- | --- | --- | --- |
| [PHASE-00](../.agent-vault/02_Phases/Phase_00_architecture_spikes_and_delivery_foundations/Phase.md) | Architecture spikes and delivery foundations | Resolve repository placement, runtime, data-plane, security, and evaluation unknowns before building the product surface. | DEC-0001, DEC-0002, DEC-0003, DEC-0009 |
| [PHASE-01](../.agent-vault/02_Phases/Phase_01_walking_skeleton/Phase.md) | Walking skeleton | Deliver a thin end-to-end slice: project creation, one text source, basic ingestion, one research workflow, streaming progress, and one valid citation. | DEC-0006, DEC-0008 |
| [PHASE-02](../.agent-vault/02_Phases/Phase_02_document_research_and_hybrid_retrieval/Phase.md) | Document research and hybrid retrieval | Add real document ingestion, chunking, full-text plus vector retrieval, reranking hooks, and multi-document citation-backed synthesis. | DEC-0004 |
| [PHASE-03](../.agent-vault/02_Phases/Phase_03_durable_directory_ingestion_and_source_refresh/Phase.md) | Durable directory ingestion and source refresh | Register directory roots, build sandboxed recursive discovery, and support resumable, versioned refresh across large trees. | DEC-0006, DEC-0009 |
| [PHASE-04](../.agent-vault/02_Phases/Phase_04_structured_datasets_and_deterministic_sql/Phase.md) | Structured datasets and deterministic SQL | Treat datasets as first-class sources with schema grouping, DuckDB-backed exact queries, stable dataset citations, and a reproducible 25,000-file corpus. | DEC-0005, DEC-0009, DEC-0011 |
| [PHASE-05](../.agent-vault/02_Phases/Phase_05_typed_research_planning_and_bounded_execution/Phase.md) | Typed research planning and bounded execution | Introduce typed research plans, budget-aware orchestration, checkpointed execution, cancellation, replay, and tool failure recovery. | DEC-0007, DEC-0010 |
| [PHASE-06](../.agent-vault/02_Phases/Phase_06_recursive_corpus_analysis/Phase.md) | Recursive corpus analysis | Support large-corpus semantic analysis through bounded partitioning, structured findings, coverage tracking, and contradiction retention. | DEC-0010, DEC-0011 |
| [PHASE-07](../.agent-vault/02_Phases/Phase_07_hybrid_cross_source_research/Phase.md) | Hybrid cross-source research | Combine SQL, document retrieval, directory inspection, and code evidence into one synthesis pipeline with quantitative guardrails. | DEC-0004, DEC-0005, DEC-0010 |
| [PHASE-08](../.agent-vault/02_Phases/Phase_08_citation_backed_reports_and_durable_findings/Phase.md) | Citation-backed reports and durable findings | Persist findings, validate citations, compose editable reports, and export source-version-aware research artifacts. | DEC-0006 |
| [PHASE-09](../.agent-vault/02_Phases/Phase_09_v1_production_hardening_and_release/Phase.md) | v1 production hardening and release | Finish security, resilience, observability, accessibility, benchmarks, evaluation gates, and release documentation for v1. | DEC-0009, DEC-0011 |

## Horizon 2: Post-v1 expansion

| Phase | Focus | Target outcome |
| --- | --- | --- |
| [PHASE-10](../.agent-vault/02_Phases/Phase_10_v1_usable_research_workspace/Phase.md) | v1 usable research workspace | Improve the shipped v1 workspace with stronger navigation, saved views, templates, and analyst ergonomics. |
| [PHASE-11](../.agent-vault/02_Phases/Phase_11_v1_1_research_usability/Phase.md) | v1.1 research usability | Validate and extend day-to-day research UX with search, command, saved-query, and accessibility improvements. |
| [PHASE-12](../.agent-vault/02_Phases/Phase_12_v1_2_additional_sources/Phase.md) | v1.2 additional sources | Add secure connector flows for web snapshots, object storage, exports, and other bounded external sources. |
| [PHASE-13](../.agent-vault/02_Phases/Phase_13_v1_3_continuous_research/Phase.md) | v1.3 continuous research | Schedule source change detection, rerun incremental research, and surface alerts and staleness policies. |
| [PHASE-14](../.agent-vault/02_Phases/Phase_14_v1_4_collaboration_and_governance/Phase.md) | v1.4 collaboration and governance | Add shared workspaces, annotations, approvals, policy enforcement, and audit controls. |
| [PHASE-15](../.agent-vault/02_Phases/Phase_15_v1_5_advanced_research/Phase.md) | v1.5 advanced research | Expand into reusable research templates, richer comparative workflows, and more advanced model/tool policies. |

## Release checkpoints

1. **Architecture baseline complete:** PHASE-00 closes the major placement, runtime, security, and evaluation unknowns.
2. **Executable proof:** PHASE-01 proves the end-to-end product boundary with one real cited answer.
3. **Core research foundation:** PHASE-02 through PHASE-05 establish document retrieval, directory durability, dataset computation, and bounded planning.
4. **Full research capability:** PHASE-06 through PHASE-08 add large-corpus reasoning, cross-source synthesis, and report generation.
5. **v1 release readiness:** PHASE-09 validates that the system is secure, reproducible, observable, and supportable.

## What defines roadmap success

- The system can ingest large local corpora without one model call per file.
- Exact dataset questions remain reproducible and citation-backed.
- Source refresh creates immutable new versions without invalidating historical runs.
- Large semantic investigations retain minority findings and contradictions instead of collapsing into summary-of-summary drift.
- Users can open every important claim back to files, rows, JSON pointers, SQL, pages, or code lines.
