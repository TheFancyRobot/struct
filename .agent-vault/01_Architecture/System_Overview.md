---
note_type: architecture
template_version: 2
contract_version: 1
title: System Overview
architecture_id: ARCH-0001
status: active
owner: ''
reviewed_on: '2026-07-19'
created: '2026-07-17'
updated: '2026-07-19'
related_notes:
  - '[[01_Architecture/Domain_Model|Domain Model]]'
  - '[[01_Architecture/Code_Map|Code Map]]'
  - '[[01_Architecture/Integration_Map|Integration Map]]'
  - '[[01_Architecture/Agent_Workflow|Agent Workflow]]'
tags:
  - agent-vault
  - architecture
---

# System Overview

## Purpose

- Describe the intended system boundaries for a Fred-native research workspace.
- Preserve the core rule: documents are retrieved, datasets are queried, directories are navigated, and large corpora are recursively analyzed.

## Overview

- Current state: Phase 01 (walking skeleton) — STEP-01-01 through STEP-01-04 are implemented. The monorepo now includes deterministic retrieval, bounded Fred research execution, citation validation, and durable research state in addition to the scaffold, domain, persistence, storage, and ingestion slices.
- The planned product is a source-grounded workspace for projects, source ingestion, multi-step research, exact computation, navigable citations, saved findings, and Markdown reports.
- Bun is the sole maintained host runtime, with TypeScript 7.0.2, Effect for
  services, typed failures, structured concurrency, timeout interruption, and
  Fred 2.0.0 for agent/workflow orchestration. A separately isolated
  native-dependency container may carry its adapter runtime only when an ADR
  defines that boundary; Phase 04's planned DuckDB sidecar is the accepted
  instance.
- PostgreSQL with pgvector provides application persistence, full-text search,
  and initial vector search; STEP-01-02 implemented the migration runner,
  initial pgvector/schema migrations, typed row decoders, and postgres-backed
  repository services. STEP-01-03 consumes existing
  `job_queue`/`event_journal` tables for API→worker ingestion dispatch and
  creates immutable `SourceVersion` rows only after content-addressed
  raw/normalized/manifest artifacts exist. DuckDB and Parquet are not yet
  implemented: the current Compose file contains PostgreSQL only, and Phase 04
  plans an isolated DuckDB sidecar.
- STEP-01-03 review remediation hardened artifact parent-component containment, made the API registration command transactional, and made worker database readiness/poll failures fail visibly.
- STEP-01-04 implements `retrieval`, `research-engine`, and `fred-workflows`; Fred core is pinned at `2.0.0`; PostgreSQL FTS indexes normalized text by immutable source version and derives tenant ownership through source relationships; and the API/worker research path atomically persists grounded answers, citations, terminal state, and journal events.
- STEP-01-05 projects the append-only PostgreSQL event journal into typed, cursor-replayable SSE and resolves validated citations against immutable `SourceVersion` text. SolidJS consumes these boundaries with schema validation, bounded reconnect, replay deduplication, cleanup, and exact highlighted citation navigation.

## Key Components

<!-- AGENT-START:architecture-key-components -->
- `apps/web`: SolidJS + Vite 8 + Solid Router research interface, source browser, progress streaming (SSE), evidence inspector, and report editor (DEC-0014).
- `apps/api`: typed Effect HTTP boundary for projects, sources, research runs, citations, and SSE events; STEP-01-03 adds `POST /sources/text` for one `.txt`/`.md` upload registration/enqueue path.
- `apps/worker`: durable ingestion, refresh, embedding, recursive analysis, retry, cancellation, and resume execution; STEP-01-03 adds one durable text-ingestion polling/claim/retry/failure/finalization path.
- Domain packages: schemas, identifiers, invariants, source versions, evidence, citations, research records, and specific typed errors for storage/ingestion/job failures.
- Artifact/ingestion packages: `packages/source-storage` local content-addressed object store plus staged-upload refs; `packages/ingestion` narrow text classifier, normalizer, and source-version manifest creator.
- Retrieval and data services: PostgreSQL hybrid retrieval plus safe, read-only DuckDB queries.
- Research services: typed Fred plans, bounded tool execution, evidence sufficiency, citation validation, and synthesis.
<!-- AGENT-END:architecture-key-components -->

## Important Paths

<!-- AGENT-START:architecture-important-paths -->
- `docs/product-brief.md` — authoritative requirements and preferred technical direction.
- `AGENTS.md` — repository and Agent Vault operating instructions.
- `apps/web` — SolidJS 1.9 + Vite 8 + Solid Router + Tailwind 4 + DaisyUI SPA (scaffolded, DEC-0014).
- `apps/api` — Bun HTTP + Effect Config, healthz/SSE placeholder, `POST /sources/text` registration/enqueue path.
- `apps/worker` — Effect Config plus STEP-01-03 ingestion job polling/claim/retry/failure/finalization.
- `packages/domain` — branded IDs, Effect Schemas, Schema.TaggedError (including storage/ingestion/job errors).
- `packages/persistence` — pgvector/schema migrations, typed row decoders, typed persistence errors, postgres-backed repository services (STEP-01-02), aggregate-specific JobQueue/EventJournal transitions, and an explicitly read-only EventJournal reader (STEP-01-03).
- `packages/source-storage` — local content-addressed artifact store with staged refs and filesystem safety controls.
- `packages/ingestion` — `.txt`/`.md` classification, UTF-8 normalization, normalized hash, and source-version manifest creation.
- `packages/observability` — placeholder (scaffolded).
- `docs/adr/` — architecture decision records (DEC-0001 … DEC-0014).
- STEP-03-04: `packages/ingestion/src/diff-manifest.ts` and `apply-refresh.ts`, `packages/source-storage/src/versioned-artifacts.ts`, `packages/persistence/src/repositories/source-versions.ts` plus migration 0008, and `apps/worker/src/jobs/refresh-directory.ts` form the deterministic directory-refresh path.
<!-- AGENT-END:architecture-important-paths -->

## Constraints

- Keep application-specific research behavior outside Fred core; prefer product-local adapters.
- Use Effect services, Layers, Schemas, Streams, scopes, schedules, and typed errors; keep runtime execution at application boundaries.
- Make source versions immutable and attach research results and citations to exact versions.
- Treat imported content as untrusted evidence, never as executable instructions.
- Use deterministic SQL for exact structured-data answers; never derive exact counts from model summaries.
- Bound model calls, tool calls, tokens, elapsed time, cost, query resources, and workflow loops.
- Preserve restart safety, idempotency, cancellation, provenance, and workspace isolation.

## Failure Modes

- Flattening all source types into vector-search text loses dataset correctness and directory structure.
- Mutable or incomplete provenance makes citations unreproducible after source refresh.
- Unrestricted SQL or filesystem access creates data-exfiltration and host-safety risks.
- One model call per file makes large-directory ingestion economically and operationally infeasible.
- Prose-only recursive summaries can discard minority findings, contradictions, scope, and source evidence.
- Broad scaffolding without a tested walking slice can leave boundaries unvalidated.

## Related Notes

<!-- AGENT-START:architecture-related-notes -->
- [[01_Architecture/Domain_Model|Domain Model]]
- [[01_Architecture/Code_Map|Code Map]]
- [[01_Architecture/Integration_Map|Integration Map]]
- [[01_Architecture/Agent_Workflow|Agent Workflow]]
- [[04_Decisions/DEC-0014_use-solidjs-vite-8-and-solid-router-for-frontend-runtime|DEC-0014 Use SolidJS, Vite 8, and Solid Router for Frontend Runtime]]
<!-- AGENT-END:architecture-related-notes -->
- [[04_Decisions/DEC-0013_use-tailwind-css-and-daisyui-with-a-custom-theme-for-frontend-styling|DEC-0013 Use Tailwind CSS and DaisyUI with a Custom Theme for Frontend Styling]]
