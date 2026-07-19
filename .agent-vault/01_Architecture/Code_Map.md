---
note_type: architecture
template_version: 2
contract_version: 1
title: Code Map
architecture_id: ARCH-0002
status: active
owner: ''
reviewed_on: '2026-07-18'
created: '2026-07-17'
updated: '2026-07-18'
related_notes:
  - '[[01_Architecture/System_Overview|System Overview]]'
  - '[[01_Architecture/Code_Graph|Code Graph]]'
tags:
  - agent-vault
  - architecture
---

# Code Map

## Purpose

- Map the current repository and the intended monorepo package boundaries.
- Distinguish verified files from architecture that remains planned.

## Overview

- Current state: Phase 01 (walking skeleton) — STEP-01-01 through STEP-01-04 are implemented; STEP-01-05 progress streaming and citation navigation is next.
- `README.md` has the bootstrap quick-start, `AGENTS.md` contains vault instructions, and `docs/product-brief.md` is the product specification.
- Runtime apps (`apps/web`, `apps/api`, `apps/worker`), core packages (`domain`, `persistence`, `observability`), Bun workspace manifests and native `bun:test` coverage, ESLint 9.39.2 flat config, dependency-cruiser, and Docker Compose for PostgreSQL+pgvector are all implemented and passing all gates.
- STEP-01-03 implemented walking-slice `packages/source-storage` and `packages/ingestion`; STEP-01-04 implemented `packages/retrieval`, `packages/research-engine`, and `packages/fred-workflows`. Later-phase packages (`document-processing`, `data-engine`, `evaluation`, `shared-ui`) remain planned and are scaffolded when their owning step needs them.
- Persistence migrations and core postgres-backed repository services are implemented; STEP-01-03 adds typed `job_queue` aggregate transitions and an explicitly read-only `event_journal` reader for ingestion dispatch/events. Journal writes are available only through aggregate-specific source-registration, ingestion, and research transition services. API currently exposes healthz, SSE placeholder, and `POST /sources/text` for one text-source registration path.
- STEP-01-04 supersedes the earlier planned-package snapshot: `packages/retrieval`, `packages/research-engine`, and `packages/fred-workflows` now exist with typed public roots and tests. API adds `POST /research/runs`; worker adds durable bounded research execution and stale recovery; persistence adds migration 0003 and atomic research repositories.
- Migration `0004_event_journal_commit_order` enforces commit-visible event cursor ordering at the PostgreSQL table boundary with a transaction-held advisory-lock allocator trigger; rollback gaps remain valid and all insert paths are covered automatically.

## Key Components

<!-- AGENT-START:architecture-key-components -->
- Scaffolded applications (STEP-01-01): `apps/web` (SolidJS 1.9 + Vite 8 + Solid Router + Tailwind 4 + DaisyUI), `apps/api` (Bun HTTP + Effect Config), `apps/worker` (Effect Config skeleton plus STEP-01-03 ingestion polling/claim/retry job loop).
- Core packages: `domain` (branded IDs, Effect Schemas, Schema.TaggedError), `persistence` (pgvector migrations, typed row decoders, postgres-backed repository services plus typed JobQueue transitions and an EventJournal reader), `source-storage` (local content-addressed artifact and staged-upload adapter), `ingestion` (text classification/normalization/manifest creation), `observability` (placeholder).
- Implemented STEP-01-04 packages: `retrieval`, `research-engine`, and `fred-workflows`.
- Planned core packages (scaffolded by their owning step): `document-processing` and `data-engine`.
- Planned support packages: `evaluation`, `shared-ui`.
- Architecture deliverables: architecture, domain model, research execution, provenance, security, evaluation, roadmap, implementation plan, and ADR documents.
<!-- AGENT-END:architecture-key-components -->
- STEP-01-03 review hardening adds `SourceRegistrationRepo` as the transaction-scoped API command for Source + ingestion job + `ingestion-requested`, component-wise local artifact path validation, and worker database readiness/failure propagation.

## Important Paths

<!-- AGENT-START:architecture-important-paths -->
- `README.md` — bootstrap quick-start and common commands.
- `AGENTS.md` — vault usage contract.
- `docs/product-brief.md` — complete product requirements and delivery phases.
- `apps/web` — SolidJS 1.9 + Vite 8 + Solid Router + Tailwind 4 + DaisyUI SPA (DEC-0014, scaffolded).
- `apps/api` — Bun HTTP + Effect Config, healthz/SSE placeholder, and `POST /sources/text` registration/enqueue path.
- `apps/worker` — Effect Config plus ingestion job polling, atomic claim, stale recovery, retry/failure, SourceVersion finalization, and sanitized event emission.
- `packages/domain` — branded IDs, Effect Schemas, Schema.TaggedError (including storage/ingestion/job errors).
- `packages/persistence` — pgvector migrations, typed row decoders, typed persistence errors, postgres-backed repository services from STEP-01-02, plus STEP-01-03 aggregate-specific `job_queue`/`event_journal` transitions and an explicitly read-only journal accessor.
- `packages/source-storage` — local content-addressed artifact store with startup/root/symlink/traversal/NUL/atomic-write controls.
- `packages/ingestion` — narrow `.txt`/`.md` classifier, UTF-8 normalization, deterministic normalized content hash, and source-version manifest creation.
- `packages/observability` — placeholder (scaffolded).
- `packages/retrieval` — tenant-scoped PostgreSQL full-text indexing, ranked search, and match-anchored evidence excerpts.
- `packages/research-engine` — bounded plan, evidence sufficiency, and exact citation gates.
- `packages/fred-workflows` — Fred 2.0 walking-skeleton workflow, provider preflight, structured timeout cancellation, and typed synthesis boundary.
- `eslint.config.mjs` — ESLint 9.39.2 flat config with TS/Solid/Effect convention enforcement.
- `dependency-cruiser.config.mjs` — SWC-based dependency analysis.
- `scripts/boundary-check.ts` — Bun-aware import boundary checker.
<!-- AGENT-END:architecture-important-paths -->

## Constraints

- Preserve package boundaries and avoid product behavior in Fred core.
- Keep domain types independent of infrastructure implementations.
- Use typed schemas at API, tool, workflow, persistence, and domain boundaries.
- Build independently testable vertical slices rather than unexecutable interface scaffolding.
- Update this map once directories and packages are introduced; planned paths are not evidence of implementation.

## Failure Modes

- Treating planned paths as implemented can lead agents to invent nonexistent APIs.
- Circular dependencies between domain, orchestration, and infrastructure packages weaken testability.
- Putting all behavior in the API or worker application bypasses reusable service boundaries.
- Duplicating schemas across web, API, worker, and persistence creates contract drift.

## Related Notes

<!-- AGENT-START:architecture-related-notes -->
- [[01_Architecture/System_Overview|System Overview]]
- [[01_Architecture/Code_Graph|Code Graph]]
- [[04_Decisions/DEC-0014_use-solidjs-vite-8-and-solid-router-for-frontend-runtime|DEC-0014 Use SolidJS, Vite 8, and Solid Router for Frontend Runtime]]
<!-- AGENT-END:architecture-related-notes -->
- [[04_Decisions/DEC-0013_use-tailwind-css-and-daisyui-with-a-custom-theme-for-frontend-styling|DEC-0013 Use Tailwind CSS and DaisyUI with a Custom Theme for Frontend Styling]]
