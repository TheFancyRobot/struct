---
note_type: architecture
template_version: 2
contract_version: 1
title: Code Map
architecture_id: "ARCH-0002"
status: active
owner: ""
reviewed_on: "2026-07-17"
created: "2026-07-17"
updated: "2026-07-17"
related_notes:
  - "[[01_Architecture/System_Overview|System Overview]]"
  - "[[01_Architecture/Code_Graph|Code Graph]]"
tags:
  - agent-vault
  - architecture
---

# Code Map

## Purpose

- Map the current repository and the intended monorepo package boundaries.
- Distinguish verified files from architecture that remains planned.

## Overview

- Current state: documentation-only Phase 0 repository.
- `README.md` is empty, `AGENTS.md` contains vault instructions, and `docs/product-brief.md` is the product specification.
- No runtime, package manifest, application entry point, source package, tests, or CI configuration currently exists.

## Key Components

<!-- AGENT-START:architecture-key-components -->
- Planned applications: `apps/web`, `apps/api`, and `apps/worker`.
- Planned core packages: `domain`, `persistence`, `source-storage`, `ingestion`, `document-processing`, `retrieval`, `data-engine`, `research-engine`, and `fred-workflows`.
- Planned support packages: `evaluation`, `observability`, and `shared-ui`.
- Planned architecture deliverables: architecture, domain model, research execution, provenance, security, evaluation, roadmap, implementation plan, and ADR documents.
<!-- AGENT-END:architecture-key-components -->

## Important Paths

<!-- AGENT-START:architecture-important-paths -->
- `README.md` — current empty project entry document.
- `AGENTS.md` — vault usage contract.
- `docs/product-brief.md` — complete product requirements and delivery phases.
- `apps/web` — planned Next.js UI.
- `apps/api` — planned Effect HTTP API.
- `apps/worker` — planned asynchronous worker.
- `packages/domain` — planned infrastructure-independent schemas and invariants.
- `packages/fred-workflows` — planned product-specific Fred agents, tools, graphs, and prompts.
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
<!-- AGENT-END:architecture-related-notes -->
- [[04_Decisions/DEC-0013_use-tailwind-css-and-daisyui-with-a-custom-theme-for-frontend-styling|DEC-0013 Use Tailwind CSS and DaisyUI with a Custom Theme for Frontend Styling]]
