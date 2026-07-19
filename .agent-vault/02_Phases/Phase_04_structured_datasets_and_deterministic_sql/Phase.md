---
note_type: phase
template_version: 2
contract_version: 1
title: Structured Datasets and Deterministic SQL
phase_id: PHASE-04
status: in_progress
owner: Codex
created: '2026-07-17'
updated: '2026-07-19'
depends_on:
  - '[[02_Phases/Phase_03_durable_directory_ingestion_and_source_refresh/Phase|PHASE-03 Durable Directory Ingestion and Source Refresh]]'
related_architecture:
  - '[[01_Architecture/System_Overview|System Overview]]'
  - '[[01_Architecture/Domain_Model|Domain Model]]'
  - '[[01_Architecture/Integration_Map|Integration Map]]'
  - '[[01_Architecture/Agent_Workflow|Agent Workflow]]'
related_decisions:
  - '[[04_Decisions/DEC-0005_use-duckdb-and-parquet-for-the-deterministic-data-plane|DEC-0005 Use DuckDB and Parquet for the Deterministic Data Plane]]'
  - '[[04_Decisions/DEC-0006_make-source-versions-immutable-and-provenance-typed|DEC-0006 Make Source Versions Immutable and Provenance Typed]]'
  - '[[04_Decisions/DEC-0009_sandbox-filesystem-roots-and-allowlist-read-only-sql|DEC-0009 Sandbox Filesystem Roots and Allowlist Read-Only SQL]]'
  - '[[04_Decisions/DEC-0011_gate-releases-on-a-reproducible-25000-file-evaluation-corpus|DEC-0011 Gate Releases on a Reproducible 25000-File Evaluation Corpus]]'
related_bugs:
  - '[[03_Bugs/BUG-0007_solid-theme-toggle-does-not-apply-the-selected-theme|BUG-0007 Solid theme toggle does not apply the selected theme]]'
tags:
  - agent-vault
  - phase
  - v1
---

# Phase 04 Structured Datasets and Deterministic SQL

Use this note as the canonical bounded milestone. Detailed execution belongs in linked step companion notes; architecture and durable choices belong in their linked notes.

## Objective

- Add a distinct structured-data plane that preserves schemas and versions, materializes Parquet, executes safe read-only DuckDB queries, and produces exact computation citations.

## Why This Phase Exists

- Structured data answers must remain deterministic and auditable. Flattening rows into text chunks would destroy types, aggregation semantics, performance, and exact provenance.

## Scope

- Classify structured assets separately from documents and catalog dataset versions, files, tables, columns, inferred/logical schemas, and profiling artifacts.
- Normalize supported JSON/JSONL/CSV inputs into reproducible Parquet artifacts without losing original-source lineage.
- Refine and implement DuckDB as an isolated container/sidecar with scoped
  mounts, no network egress, a pinned internal adapter runtime, authenticated
  typed client access from Bun, timeouts, memory/CPU/process/row/byte limits,
  cancellation, restart recovery, and typed failures. The current Compose
  stack provisions PostgreSQL only.
- Expose only validated, allowlisted, read-only SQL/query-plan tools and deterministic result artifacts to Fred.
- Generate the seeded approximately 25,000-file JSON corpus, manifests, expected aggregates, adversarial cases, and ground truth.
- Evaluate exact computation, schema drift, provenance, SQL security, performance, cancellation, and crash recovery.

## Non-Goals

- Embedding every row or flattening datasets into ordinary chunks.
- Allowing an agent to execute arbitrary SQL, attach databases, read arbitrary paths, install extensions, or mutate data.
- Building hybrid document-and-dataset synthesis before deterministic dataset evidence is stable.

## Dependencies

- Depends on [[02_Phases/Phase_03_durable_directory_ingestion_and_source_refresh/Phase|PHASE-03 Durable Directory Ingestion and Source Refresh]].

## Acceptance Criteria

- [ ] Datasets remain first-class structured assets with immutable versions, schema lineage, profiles, and original-file provenance.
- [ ] Equivalent source versions produce deterministic Parquet and catalog metadata; incompatible schema drift is explicit.
- [ ] Exact fixture questions return validated deterministic results equal to ground truth.
- [ ] Only catalog-issued table/view identifiers and a read-only SQL subset are executable; forbidden syntax and paths are rejected before DuckDB execution.
- [ ] Query budgets, cancellation, worker crashes, malformed inputs, and restart recovery produce typed, observable, non-corrupting outcomes.
- [ ] The DuckDB sidecar is present in Compose, runs without a host Node
  requirement, exposes only its private authenticated bounded protocol, mounts
  only approved roots, has no network egress or Docker socket, and passes
  container crash/restart recovery tests.
- [ ] Dataset result citations resolve to query text/hash, engine/config version, input versions, result artifact, and relevant cells/rows.
- [ ] The reproducible approximately 25,000-file corpus is generated from a committed seed/spec and passes exact-computation and recovery gates.
- [ ] Fred receives bounded summaries or artifact references, never uncontrolled raw tables or per-file model calls.

## Delivery Strategy

- **Sequence:** Execute STEP-04-01 through STEP-04-06 linearly; each step consumes the merged typed contracts and evidence from its predecessor.
- **Gate:** The phase closes only when all acceptance criteria have reproducible evidence and the relevant docs, migrations, security checks, telemetry, and evaluations are updated.
- **Boundary:** Post-v1 work must not be pulled forward in a way that weakens v1 completeness or its release gates.

## Refined Implementation Contract

- Bun 1.3.x is the sole host runtime. DuckDB runs only in an isolated Docker Compose sidecar with a pinned image and pinned internal adapter runtime.
- The Bun-to-sidecar boundary is private, authenticated, versioned, and decoded with Effect `Schema`; both caller and sidecar enforce limits and SQL policy.
- The sidecar has no network egress, no Docker socket, no arbitrary host paths, least privilege, bounded resources, and only explicit artifact mounts.
- Business capabilities use `Effect.Service`, explicit dependencies/layers, `Effect.fn`, `Config`, and specific serializable `Schema.TaggedError` failures; deterministic work never moves into Fred.
- This greenfield phase has no legacy database or compatibility requirement. Use the next sequential reversible migration and the smallest current-state implementation.
- Every step has a concrete Execution Brief and Validation Plan covering deliverables, negative/security cases, deterministic evidence, and commands grounded in repository scripts.
- Refinement session: [[05_Sessions/2026-07-19-160148-define-dataset-assets-schemas-and-versioned-catalog-codex-phase-04-refinement|SESSION-2026-07-19-160148 Phase 04 refinement]].

## Linear Context

<!-- AGENT-START:phase-linear-context -->
- Previous phase: [[02_Phases/Phase_03_durable_directory_ingestion_and_source_refresh/Phase|PHASE-03 Durable Directory Ingestion and Source Refresh]]
- Current phase status: in_progress
- Next phase: [[02_Phases/Phase_05_typed_research_planning_and_bounded_execution/Phase|PHASE-05 Typed Research Planning and Bounded Execution]]
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
- [[04_Decisions/DEC-0005_use-duckdb-and-parquet-for-the-deterministic-data-plane|DEC-0005 Use DuckDB and Parquet for the Deterministic Data Plane]]
- [[04_Decisions/DEC-0006_make-source-versions-immutable-and-provenance-typed|DEC-0006 Make Source Versions Immutable and Provenance Typed]]
- [[04_Decisions/DEC-0009_sandbox-filesystem-roots-and-allowlist-read-only-sql|DEC-0009 Sandbox Filesystem Roots and Allowlist Read-Only SQL]]
- [[04_Decisions/DEC-0011_gate-releases-on-a-reproducible-25000-file-evaluation-corpus|DEC-0011 Gate Releases on a Reproducible 25000-File Evaluation Corpus]]
<!-- AGENT-END:phase-related-decisions -->

## Related Bugs

<!-- AGENT-START:phase-related-bugs -->
- [[03_Bugs/BUG-0007_solid-theme-toggle-does-not-apply-the-selected-theme|BUG-0007 Solid theme toggle does not apply the selected theme]]
<!-- AGENT-END:phase-related-bugs -->

## Steps

<!-- AGENT-START:phase-steps -->
- [ ] [[02_Phases/Phase_04_structured_datasets_and_deterministic_sql/Steps/Step_01_define-dataset-assets-schemas-and-versioned-catalog|STEP-04-01 Define Dataset Assets Schemas and Versioned Catalog]]
- [ ] [[02_Phases/Phase_04_structured_datasets_and_deterministic_sql/Steps/Step_02_implement-parquet-materialization-and-data-profiling|STEP-04-02 Implement Parquet Materialization and Data Profiling]]
- [ ] [[02_Phases/Phase_04_structured_datasets_and_deterministic_sql/Steps/Step_03_implement-allowlisted-read-only-sql-service|STEP-04-03 Implement Allowlisted Read-Only SQL Service]]
- [ ] [[02_Phases/Phase_04_structured_datasets_and_deterministic_sql/Steps/Step_04_build-deterministic-dataset-query-tools-and-citations|STEP-04-04 Build Deterministic Dataset Query Tools and Citations]]
- [ ] [[02_Phases/Phase_04_structured_datasets_and_deterministic_sql/Steps/Step_05_generate-reproducible-25000-json-corpus-and-ground-truth|STEP-04-05 Generate Reproducible 25000 JSON Corpus and Ground Truth]]
- [ ] [[02_Phases/Phase_04_structured_datasets_and_deterministic_sql/Steps/Step_06_evaluate-exact-computation-schema-security-and-recovery|STEP-04-06 Evaluate Exact Computation Schema Security and Recovery]]
<!-- AGENT-END:phase-steps -->

## Notes

- Product requirements: authoritative repository document `docs/product-brief.md`.
- Human-readable roadmap: `docs/roadmap.md`; concise index: `docs/implementation-plan.md`.
- Assumption policy: reversible uncertainties use the documented default until spike evidence requires a decision update; no hidden architectural assumption is carried only in chat.
