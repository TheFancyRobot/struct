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

- Current state: Phase 01 (walking skeleton) — STEP-01-01 scaffold complete.
- `README.md` has the bootstrap quick-start, `AGENTS.md` contains vault instructions, and `docs/product-brief.md` is the product specification.
- Runtime apps (`apps/web`, `apps/api`, `apps/worker`), core packages (`domain`, `persistence`, `observability`), Bun workspace manifests, ESLint 10 flat config, dependency-cruiser, Vitest tests, and Docker Compose for PostgreSQL+pgvector are all implemented and passing all gates.
- Later-phase packages (`source-storage`, `ingestion`, `document-processing`, `retrieval`, `data-engine`, `research-engine`, `fred-workflows`, `evaluation`, `shared-ui`) remain planned and are scaffolded when their owning step needs them.
- Persistence migrations, API endpoints beyond healthz, and CI configuration are not yet implemented.

## Key Components

<!-- AGENT-START:architecture-key-components -->
- Scaffolded applications (STEP-01-01): `apps/web` (SolidJS 1.9 + Vite 8 + Solid Router + Tailwind 4 + DaisyUI), `apps/api` (Bun HTTP + Effect Config), `apps/worker` (Effect Config skeleton).
- Scaffolded core packages: `domain` (branded IDs, Effect Schemas, Schema.TaggedError), `persistence` (placeholder), `observability` (placeholder).
- Planned core packages (scaffolded by their owning step): `source-storage`, `ingestion`, `document-processing`, `retrieval`, `data-engine`, `research-engine`, `fred-workflows`.
- Planned support packages: `evaluation`, `shared-ui`.
- Architecture deliverables: architecture, domain model, research execution, provenance, security, evaluation, roadmap, implementation plan, and ADR documents.
<!-- AGENT-END:architecture-key-components -->

## Important Paths

<!-- AGENT-START:architecture-important-paths -->
- `README.md` — bootstrap quick-start and common commands.
- `AGENTS.md` — vault usage contract.
- `docs/product-brief.md` — complete product requirements and delivery phases.
- `apps/web` — SolidJS 1.9 + Vite 8 + Solid Router + Tailwind 4 + DaisyUI SPA (DEC-0014, scaffolded).
- `apps/api` — Bun HTTP + Effect Config, healthz/SSE placeholder (scaffolded).
- `apps/worker` — Effect Config skeleton (scaffolded).
- `packages/domain` — branded IDs, Effect Schemas, Schema.TaggedError (scaffolded).
- `packages/persistence` — placeholder (scaffolded; migrations in STEP-01-02).
- `packages/observability` — placeholder (scaffolded).
- `packages/fred-workflows` — planned product-specific Fred agents, tools, graphs, and prompts (STEP-01-04+).
- `eslint.config.mjs` — ESLint 10 flat config with TS/Solid/Effect convention enforcement.
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
