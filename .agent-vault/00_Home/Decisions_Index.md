---
note_type: home_index
template_version: 1
contract_version: 1
title: Decisions Index
status: active
created: "YYYY-MM-DD"
updated: "YYYY-MM-DD"
tags:
  - agent-vault
  - home
  - index
  - decisions
---

# Decisions Index

Use this note as the directory for decision records in \`04_Decisions/\`.

## Logging Rules

- Create a decision note for durable architectural or workflow choices.
- Do not hide decisions inside session notes.
- Link superseded and replacement decisions.

## Starter Decision Candidates

- Record the first durable operating-model change as a decision.
- A likely early candidate is the repo rule that Agent Vault lives directly in \`.agent-vault/\` with no nested project folder.

## Decision Log

<!-- AGENT-START:decisions-index -->
_Last rebuilt: 2026-07-20._

- Notes indexed: 15
- Status summary: accepted (15)

| Id | Title | Status | Decided | Updated | Linear |
| --- | --- | --- | --- | --- | --- |
| DEC-0015 | [Use Per-Step Branch PR Review and Merge Gates](../04_Decisions/DEC-0015_use-per-step-branch-pr-review-and-merge-gates.md) | accepted | 2026-07-18 | 2026-07-18 | - |
| DEC-0003 | [Use TypeScript Bun and Effect with Explicit Runtime Boundaries](../04_Decisions/DEC-0003_use-typescript-bun-and-effect-with-explicit-runtime-boundaries.md) | accepted | 2026-07-17 | 2026-07-19 | - |
| DEC-0005 | [Use DuckDB and Parquet for the Deterministic Data Plane](../04_Decisions/DEC-0005_use-duckdb-and-parquet-for-the-deterministic-data-plane.md) | accepted | 2026-07-17 | 2026-07-19 | - |
| DEC-0001 | [Consume Stable Fred Packages from a Standalone Monorepo](../04_Decisions/DEC-0001_consume-stable-fred-packages-from-a-standalone-monorepo.md) | accepted | 2026-07-17 | 2026-07-17 | - |
| DEC-0002 | [Prefer Product-Local Adapters Before Fred Core Changes](../04_Decisions/DEC-0002_prefer-product-local-adapters-before-fred-core-changes.md) | accepted | 2026-07-17 | 2026-07-17 | - |
| DEC-0004 | [Use PostgreSQL Full-Text Search and pgvector for Initial Retrieval](../04_Decisions/DEC-0004_use-postgresql-full-text-search-and-pgvector-for-initial-retrieval.md) | accepted | 2026-07-17 | 2026-07-17 | - |
| DEC-0006 | [Make Source Versions Immutable and Provenance Typed](../04_Decisions/DEC-0006_make-source-versions-immutable-and-provenance-typed.md) | accepted | 2026-07-17 | 2026-07-17 | - |
| DEC-0007 | [Compose a Product Job Journal with Fred Checkpoints](../04_Decisions/DEC-0007_compose-a-product-job-journal-with-fred-checkpoints.md) | accepted | 2026-07-17 | 2026-07-17 | - |
| DEC-0008 | [Own the Typed API and Live Research Event Stream](../04_Decisions/DEC-0008_own-the-typed-api-and-live-research-event-stream.md) | accepted | 2026-07-17 | 2026-07-17 | - |
| DEC-0009 | [Sandbox Filesystem Roots and Allowlist Read-Only SQL](../04_Decisions/DEC-0009_sandbox-filesystem-roots-and-allowlist-read-only-sql.md) | accepted | 2026-07-17 | 2026-07-17 | - |
| DEC-0010 | [Use Focused Fred Agents with Deterministic Effect Tools](../04_Decisions/DEC-0010_use-focused-fred-agents-with-deterministic-effect-tools.md) | accepted | 2026-07-17 | 2026-07-17 | - |
| DEC-0011 | [Gate Releases on a Reproducible 25000-File Evaluation Corpus](../04_Decisions/DEC-0011_gate-releases-on-a-reproducible-25000-file-evaluation-corpus.md) | accepted | 2026-07-17 | 2026-07-17 | - |
| DEC-0012 | [Keep Fred at the Orchestration Boundary for Typed Research Runs](../04_Decisions/DEC-0012_keep-fred-at-the-orchestration-boundary-for-typed-research-runs.md) | accepted | 2026-07-17 | 2026-07-17 | - |
| DEC-0013 | [Use Tailwind CSS and DaisyUI with a Custom Theme for Frontend Styling](../04_Decisions/DEC-0013_use-tailwind-css-and-daisyui-with-a-custom-theme-for-frontend-styling.md) | accepted | 2026-07-17 | 2026-07-17 | - |
| DEC-0014 | [Use SolidJS, Vite 8, and Solid Router for Frontend Runtime](../04_Decisions/DEC-0014_use-solidjs-vite-8-and-solid-router-for-frontend-runtime.md) | accepted | 2026-07-17 | 2026-07-17 | - |
<!-- AGENT-END:decisions-index -->

## Useful Links

- Template: [[07_Templates/Decision_Template|Decision Template]]
- Architecture overview: [[01_Architecture/System_Overview|System Overview]]
- Definition of done: [[06_Shared_Knowledge/Definition_Of_Done|Definition Of Done]]
