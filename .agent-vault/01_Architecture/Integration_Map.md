---
note_type: architecture
template_version: 2
contract_version: 1
title: Integration Map
architecture_id: "ARCH-0005"
status: active
owner: ""
reviewed_on: "2026-07-17"
created: "2026-07-17"
updated: "2026-07-17"
related_notes:
  - "[[01_Architecture/System_Overview|System Overview]]"
  - "[[01_Architecture/Agent_Workflow|Agent Workflow]]"
tags:
  - agent-vault
  - architecture
---

# Integration Map

## Purpose

- Describe the planned runtime, persistence, search, query, storage, and agent-orchestration boundaries.

## Overview

- The web application calls a typed API and receives long-running ingestion/research progress over Server-Sent Events.
- The API enforces authentication and authorization, persists commands, and dispatches durable work.
- Workers compose product-local Fred workflows with deterministic Effect services for ingestion, retrieval, data querying, evidence, and persistence.
- PostgreSQL is the initial state/full-text/vector store; DuckDB is a constrained analytical engine; artifact storage is accessed through local or S3-compatible adapters.

## Key Components

<!-- AGENT-START:architecture-key-components -->
- Web ↔ API: typed HTTP contracts for projects, sources, runs, findings, reports, citations, and queries; SSE for progress events.
- API ↔ worker: durable, idempotent ingestion and research job dispatch with cancellation and checkpoint identity.
- Worker ↔ PostgreSQL/pgvector: application records, source metadata, checkpoints, full-text index, and embeddings.
- Worker ↔ DuckDB/Parquet: schema inspection, read-only SQL, bounded result snapshots, and deterministic provenance.
- Worker ↔ artifact storage: originals, extracted content, directory manifests, and generated artifacts by reference.
- All runtimes ↔ OpenTelemetry: correlated traces, metrics, and structured logs across API, job, Fred, model, tool, query, and citation activity.
<!-- AGENT-END:architecture-key-components -->

## Important Paths

<!-- AGENT-START:architecture-important-paths -->
- `apps/web` — planned browser client and evidence inspector.
- `apps/api` — planned authentication, typed HTTP, SSE, and application command boundary.
- `apps/worker` — planned ingestion and research execution process.
- `packages/persistence` — planned PostgreSQL repositories and migrations.
- `packages/data-engine` — planned DuckDB/Parquet adapter and SQL safety layer.
- `packages/source-storage` — planned filesystem and S3-compatible adapters.
- `packages/observability` — planned OpenTelemetry wiring.
<!-- AGENT-END:architecture-important-paths -->

## Constraints

- Default to SSE unless a measured need requires bidirectional WebSockets.
- Do not add Kafka, Kubernetes, a dedicated vector database, or distributed workflow infrastructure before measured requirements justify them.
- DuckDB access must be read-only, allowlisted, resource-limited, cancellable, and unable to access arbitrary files, networks, processes, extensions, or databases.
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
