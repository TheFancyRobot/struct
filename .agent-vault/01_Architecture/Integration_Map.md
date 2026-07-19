---
note_type: architecture
template_version: 2
contract_version: 1
title: Integration Map
architecture_id: ARCH-0005
status: active
owner: ''
reviewed_on: '2026-07-19'
created: '2026-07-17'
updated: '2026-07-19'
related_notes:
  - '[[01_Architecture/System_Overview|System Overview]]'
  - '[[01_Architecture/Agent_Workflow|Agent Workflow]]'
tags:
  - agent-vault
  - architecture
---

# Integration Map

## Purpose

- Describe the planned runtime, persistence, search, query, storage, and agent-orchestration boundaries.

## Overview

- The web application calls a typed API and receives long-running ingestion/research progress over Server-Sent Events.
- The API enforces authentication and authorization, persists commands, and dispatches durable work; STEP-01-03 implements the first `POST /sources/text` command path with explicit workspace/project scope and `job_queue` handoff.
- Workers compose product-local Fred workflows with deterministic Effect services for ingestion, retrieval, data querying, evidence, and persistence; STEP-01-03 implements the first non-Fred deterministic ingestion worker poll/claim/retry/failure/finalize path.
- PostgreSQL is the implemented state/full-text/vector store and the only
  current Compose service. DuckDB is a planned constrained analytical sidecar
  owned by Phase 04; artifact storage is accessed through local or
  S3-compatible adapters. STEP-01-03 uses local content-addressed storage
  under `ARTIFACT_STORAGE_ROOT` for raw, normalized, and manifest artifacts.

## Key Components

<!-- AGENT-START:architecture-key-components -->
- Web ↔ API: typed HTTP contracts for projects, sources, runs, findings, reports, citations, and queries; SSE for progress events.
- API ↔ worker: durable, idempotent ingestion and research job dispatch with cancellation and checkpoint identity; current implemented handoff is `job_queue` `entity_type='ingestion'` for one staged `.txt`/`.md` upload.
- Worker ↔ PostgreSQL/pgvector: application records, source metadata, `job_queue`, `event_journal`, immutable `source_versions`, checkpoints, full-text index, and embeddings.
- Worker ↔ DuckDB/Parquet: planned typed authenticated client to an isolated
  container/sidecar for schema inspection, read-only SQL, bounded result
  snapshots, and deterministic provenance. The sidecar may carry its adapter
  runtime; the maintained host remains Bun-only.
- Worker ↔ artifact storage: originals, normalized text, source-version manifests, extracted content, directory manifests, and generated artifacts by reference.
- All runtimes ↔ OpenTelemetry: correlated traces, metrics, and structured logs across API, job, Fred, model, tool, query, and citation activity.
<!-- AGENT-END:architecture-key-components -->
- API → PostgreSQL command atomicity: `SourceRegistrationRepo` executes Source creation, `job_queue` enqueue, and `ingestion-requested` append in one transaction; any query or decode failure rolls back all three writes.
- Worker readiness executes a live database query before reporting ready, and polling repository failures propagate to the process boundary rather than masquerading as an idle queue.

## Important Paths

<!-- AGENT-START:architecture-important-paths -->
- `apps/web` — scaffolded browser client (SolidJS 1.9 + Vite 8); evidence inspector and SSE planned in later steps.
- `apps/api` — typed HTTP boundary (Bun HTTP + Effect Config), healthz/SSE placeholder, and STEP-01-03 `POST /sources/text`; auth hardening and broader command handling planned in later steps.
- `apps/worker` — execution process with Effect Config and STEP-01-03 ingestion job loop; research execution planned in later steps.
- `packages/persistence` — STEP-01-02 implemented pgvector/schema migrations, typed row decoders, typed persistence errors, and postgres-backed repository services; STEP-01-03 adds aggregate-specific JobQueue/EventJournal transitions plus an explicitly read-only journal accessor. No generic journal writer is exported.
- `packages/data-engine` — planned DuckDB/Parquet adapter and SQL safety layer.
- `packages/source-storage` — implemented local content-addressed/staged filesystem adapter; S3-compatible adapter planned later.
- `packages/observability` — scaffolded placeholder; OpenTelemetry wiring planned in later steps.
<!-- AGENT-END:architecture-important-paths -->

## Constraints

- Default to SSE unless a measured need requires bidirectional WebSockets.
- Do not add Kafka, Kubernetes, a dedicated vector database, or distributed workflow infrastructure before measured requirements justify them.
- DuckDB access must be read-only, allowlisted, resource-limited, cancellable, and unable to access arbitrary files, networks, processes, extensions, or databases.
- Phase 04 must add the DuckDB service to Compose; until then architecture and
  local-development references are plans, not implemented service claims.
- Original host paths remain behind registered-root and workspace authorization checks; model-supplied arbitrary paths are forbidden.
- Large tool outputs and artifacts are persisted by reference rather than embedded into workflow checkpoints.
- Provider/model integration remains Fred-mediated and provider-agnostic.

## Failure Modes

- API-side long-running work can be lost during restarts or block request capacity.
- Unversioned events or API contracts can cause web/API drift.
- DuckDB configuration mistakes can expose filesystem, extension, or network capabilities.
- Direct infrastructure imports across packages can bypass authorization and observability.
- Missing idempotency can duplicate ingestion, embeddings, partition analysis, or report generation after resume.
- Broken trace correlation makes multi-process failures difficult to diagnose.

## Related Notes

<!-- AGENT-START:architecture-related-notes -->
- [[01_Architecture/System_Overview|System Overview]]
- [[01_Architecture/Agent_Workflow|Agent Workflow]]
<!-- AGENT-END:architecture-related-notes -->
