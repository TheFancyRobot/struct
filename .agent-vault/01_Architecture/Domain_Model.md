---
note_type: architecture
template_version: 2
contract_version: 1
title: Domain Model
architecture_id: "ARCH-0004"
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

# Domain Model

## Purpose

- Record the proposed domain entities, their invariants, and the provenance relationships that must survive implementation changes.

## Overview

- `Workspace` is the ownership and isolation boundary; `ResearchProject` groups sources, threads, findings, and reports.
- A logical `Source` may represent a document, structured dataset, directory, or individual file. Each refresh creates an immutable `SourceVersion`.
- Research runs operate against explicit source versions and produce persisted plans, steps, evidence, citations, findings, and reports.
- Dataset computation is preserved through validated query records and reproducible result snapshots rather than prose alone.

## Key Components

<!-- AGENT-START:architecture-key-components -->
- Source graph: `Source`, `SourceVersion`, `FileEntry`, and `DirectoryManifest`.
- Document graph: `Document`, `DocumentSection`, and `DocumentChunk`, retaining page/section/location provenance.
- Dataset graph: `Dataset`, `DatasetSnapshot`, `DatasetTable`, `DatasetField`, and `SchemaFamily`.
- Execution graph: `IngestionJob`, `ResearchThread`, `ResearchRun`, `ResearchPlan`, and `ResearchStep`.
- Evidence graph: `Evidence`, `Citation`, `ResearchFinding`, `SavedFinding`, and `ResearchReport`.
- Deterministic query graph: `DatasetQuery` and `QueryResultSnapshot` with SQL, parameters, engine/version, result hash, row count, and truncation state.
<!-- AGENT-END:architecture-key-components -->

## Important Paths

<!-- AGENT-START:architecture-important-paths -->
- `docs/product-brief.md` sections 8–9 — required entities and citation/provenance variants.
- `packages/domain` — implemented Effect Schemas, branded identifiers, and typed failures for the core walking-skeleton entities.
- `packages/persistence` — implemented pgvector/schema migrations, transaction-safe migration tracking, typed row decoders, typed persistence errors, and postgres-backed repository services for the core walking-skeleton entities.
- `packages/source-storage` — planned original artifacts, manifests, extracted artifacts, and content-addressed objects.
<!-- AGENT-END:architecture-important-paths -->

## Constraints

- Use strongly typed identifiers and Effect Schema for domain objects and persisted records where practical.
- A citation references immutable source/snapshot versions and a stable location; mutable source identity alone is insufficient.
- Normalization must retain lineage to the original file, JSON Pointer, stable dataset record, or document location.
- Physical dataset row numbers cannot be the only record identity.
- Persist inspectable execution facts, not hidden chain-of-thought.
- Workspace and project authorization applies to every source, query, evidence, and report access.

## Failure Modes

- Missing version identity makes old research silently change after refresh.
- Unstable row or chunk identity breaks citation navigation and validation.
- Normalization without original-source lineage makes structured findings unverifiable.
- Storing only synthesized answers discards query, evidence, coverage, and limitation provenance.
- Shared identifiers or repositories without workspace scoping can leak tenant data.

## Related Notes

<!-- AGENT-START:architecture-related-notes -->
- [[01_Architecture/System_Overview|System Overview]]
- [[01_Architecture/Agent_Workflow|Agent Workflow]]
<!-- AGENT-END:architecture-related-notes -->
