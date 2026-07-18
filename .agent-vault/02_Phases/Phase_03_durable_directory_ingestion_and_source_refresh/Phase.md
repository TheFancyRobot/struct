---
note_type: phase
template_version: 2
contract_version: 1
title: Durable Directory Ingestion and Source Refresh
phase_id: PHASE-03
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
  - '[[04_Decisions/DEC-0006_make-source-versions-immutable-and-provenance-typed|DEC-0006 Make Source Versions Immutable and Provenance Typed]]'
  - '[[04_Decisions/DEC-0007_compose-a-product-job-journal-with-fred-checkpoints|DEC-0007 Compose a Product Job Journal with Fred Checkpoints]]'
  - '[[04_Decisions/DEC-0009_sandbox-filesystem-roots-and-allowlist-read-only-sql|DEC-0009 Sandbox Filesystem Roots and Allowlist Read-Only SQL]]'
related_bugs: []
tags:
  - agent-vault
  - phase
  - v1
---

# Phase 03 Durable Directory Ingestion and Source Refresh

Use this note as the canonical bounded milestone. Detailed execution belongs in linked step companion notes; architecture and durable choices belong in their linked notes.

## Objective

- Ingest and refresh entire registered directories through immutable manifests, bounded resumable jobs, deterministic change detection, and version-preserving recovery.

## Why This Phase Exists

- Directory research is foundational to the product, but naïve recursive scans are unsafe, unbounded, and impossible to resume or audit. The directory itself must be a first-class versioned source.

## Scope

- Model directory roots, snapshots, manifests, entries, exclusions, symlink policy, and refresh lineage.
- Discover files only beneath registered roots with canonical-path, traversal, cycle, size, type, and count controls.
- Build idempotent, lease-aware ingestion jobs with checkpoints, retries, dead-letter states, backpressure, and per-entry progress.
- Reuse unchanged artifacts, version changed sources, retain removed-entry history, and invalidate only derived data tied to superseded versions.
- Expose pause, resume, retry, cancel, reconnect, and partial-failure status to users and operators.
- Test large-tree behavior, crashes, restarts, duplicate delivery, permission changes, and malicious paths.

## Non-Goals

- Semantic corpus decomposition or report synthesis.
- Following arbitrary symlinks, ingesting outside registered roots, or interpreting files as commands.
- Flattening JSON/CSV/Parquet datasets into document chunks.

## Dependencies

- Depends on [[02_Phases/Phase_01_walking_skeleton/Phase|PHASE-01 Walking Skeleton]].

## Acceptance Criteria

- [ ] A directory snapshot has a deterministic manifest and immutable relationship to every discovered source version.
- [ ] Refresh detects additions, modifications, removals, renames where supportable, unchanged files, and unsupported entries without corrupting lineage.
- [ ] Interrupted jobs resume after worker or process restart and do not duplicate committed artifacts or versions.
- [ ] Filesystem traversal, symlink, permission, count, depth, byte, and archive-bomb limits fail safely with typed errors.
- [ ] UI and APIs show honest aggregate and per-entry progress, partial failures, recovery actions, and reconnect replay.
- [ ] Large-tree, fault-injection, migration, security, observability, and recovery tests meet documented bounds.
- [ ] The manifest and version contracts required by Phase 04 are frozen and documented.

## Delivery Strategy

- **Safe parallel work:** After Phase 01 contracts, this phase can run in parallel with Phase 02. Discovery/security and durable-job implementation are separate lanes until integrated by refresh tests.
- **Gate:** The phase closes only when all acceptance criteria have reproducible evidence and the relevant docs, migrations, security checks, telemetry, and evaluations are updated.
- **Boundary:** Post-v1 work must not be pulled forward in a way that weakens v1 completeness or its release gates.

## Linear Context

<!-- AGENT-START:phase-linear-context -->
- Previous phase: [[02_Phases/Phase_02_document_research_and_hybrid_retrieval/Phase|PHASE-02 Document Research and Hybrid Retrieval]]
- Current phase status: planned
- Next phase: [[02_Phases/Phase_04_structured_datasets_and_deterministic_sql/Phase|PHASE-04 Structured Datasets and Deterministic SQL]]
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
- [[04_Decisions/DEC-0009_sandbox-filesystem-roots-and-allowlist-read-only-sql|DEC-0009 Sandbox Filesystem Roots and Allowlist Read-Only SQL]]
<!-- AGENT-END:phase-related-decisions -->

## Related Bugs

<!-- AGENT-START:phase-related-bugs -->
- None yet.
<!-- AGENT-END:phase-related-bugs -->

## Steps

<!-- AGENT-START:phase-steps -->
- [ ] [[02_Phases/Phase_03_durable_directory_ingestion_and_source_refresh/Steps/Step_01_define-directory-manifests-snapshots-and-refresh-semantics|STEP-03-01 Define Directory Manifests Snapshots and Refresh Semantics]]
- [ ] [[02_Phases/Phase_03_durable_directory_ingestion_and_source_refresh/Steps/Step_02_implement-sandboxed-recursive-discovery-and-hashing|STEP-03-02 Implement Sandboxed Recursive Discovery and Hashing]]
- [ ] [[02_Phases/Phase_03_durable_directory_ingestion_and_source_refresh/Steps/Step_03_build-resumable-idempotent-ingestion-jobs|STEP-03-03 Build Resumable Idempotent Ingestion Jobs]]
- [ ] [[02_Phases/Phase_03_durable_directory_ingestion_and_source_refresh/Steps/Step_04_process-changed-sources-and-preserve-version-lineage|STEP-03-04 Process Changed Sources and Preserve Version Lineage]]
- [ ] [[02_Phases/Phase_03_durable_directory_ingestion_and_source_refresh/Steps/Step_05_expose-directory-status-recovery-and-controls|STEP-03-05 Expose Directory Status Recovery and Controls]]
- [ ] [[02_Phases/Phase_03_durable_directory_ingestion_and_source_refresh/Steps/Step_06_test-large-tree-refresh-failures-and-recovery|STEP-03-06 Test Large-Tree Refresh Failures and Recovery]]
<!-- AGENT-END:phase-steps -->

## Notes

- Product requirements: authoritative repository document `docs/product-brief.md`.
- Human-readable roadmap: `docs/roadmap.md`; concise index: `docs/implementation-plan.md`.
- Assumption policy: reversible uncertainties use the documented default until spike evidence requires a decision update; no hidden architectural assumption is carried only in chat.
