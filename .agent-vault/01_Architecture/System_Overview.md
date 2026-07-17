---
note_type: architecture
template_version: 2
contract_version: 1
title: System Overview
architecture_id: "ARCH-0001"
status: active
owner: ""
reviewed_on: "2026-07-17"
created: "2026-07-17"
updated: "2026-07-17"
related_notes:
  - "[[01_Architecture/Domain_Model|Domain Model]]"
  - "[[01_Architecture/Code_Map|Code Map]]"
  - "[[01_Architecture/Integration_Map|Integration Map]]"
  - "[[01_Architecture/Agent_Workflow|Agent Workflow]]"
tags:
  - agent-vault
  - architecture
---

# System Overview

## Purpose

- Describe the intended system boundaries for a Fred-native research workspace.
- Preserve the core rule: documents are retrieved, datasets are queried, directories are navigated, and large corpora are recursively analyzed.

## Overview

- The repository is in Phase 0 (discovery and architecture); application source code has not been created yet.
- The planned product is a source-grounded workspace for projects, source ingestion, multi-step research, exact computation, navigable citations, saved findings, and Markdown reports.
- The target runtime is Bun with TypeScript, Effect for services and typed failures, and Fred for agent/workflow orchestration.
- PostgreSQL with pgvector provides application persistence, full-text search, and initial vector search. DuckDB and Parquet provide deterministic structured-data analysis. Original artifacts use a local-development storage adapter and an S3-compatible production abstraction.

## Key Components

<!-- AGENT-START:architecture-key-components -->
- `apps/web`: Next.js research interface, source browser, progress streaming, evidence inspector, and report editor.
- `apps/api`: typed Effect HTTP boundary for projects, sources, research runs, citations, and SSE events.
- `apps/worker`: durable ingestion, refresh, embedding, recursive analysis, retry, cancellation, and resume execution.
- Domain packages: schemas, identifiers, invariants, source versions, evidence, citations, and research records.
- Retrieval and data services: PostgreSQL hybrid retrieval plus safe, read-only DuckDB queries.
- Research services: typed Fred plans, bounded tool execution, evidence sufficiency, citation validation, and synthesis.
<!-- AGENT-END:architecture-key-components -->

## Important Paths

<!-- AGENT-START:architecture-important-paths -->
- `docs/product-brief.md` — authoritative requirements and preferred technical direction.
- `AGENTS.md` — repository and Agent Vault operating instructions.
- `apps/` — planned executable applications; not present yet.
- `packages/` — planned reusable domain and infrastructure packages; not present yet.
- `docs/adr/` — planned architecture decision records.
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
<!-- AGENT-END:architecture-related-notes -->
- [[04_Decisions/DEC-0013_use-tailwind-css-and-daisyui-with-a-custom-theme-for-frontend-styling|DEC-0013 Use Tailwind CSS and DaisyUI with a Custom Theme for Frontend Styling]]
