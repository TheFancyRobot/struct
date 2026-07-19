---
note_type: home_context
template_version: 1
contract_version: 1
title: Active Context
status: active
created: '2026-07-17'
updated: '2026-07-19'
tags:
  - agent-vault
  - home
  - context
---

# Active Context

Keep this note short and current.

## Current Objective

<!-- AGENT-START:current-focus -->
_Last refreshed: 2026-07-19._
- Session in progress: none.
- Current step: [[02_Phases/Phase_03_durable_directory_ingestion_and_source_refresh/Steps/Step_01_define-directory-manifests-snapshots-and-refresh-semantics|STEP-03-01 Define Directory Manifests Snapshots and Refresh Semantics]] - status: planned - phase: [[02_Phases/Phase_03_durable_directory_ingestion_and_source_refresh/Phase|Phase 03 durable directory ingestion and source refresh]] - owner: Codex
- Active phase: [[02_Phases/Phase_03_durable_directory_ingestion_and_source_refresh/Phase|PHASE-03 Durable Directory Ingestion and Source Refresh]] - status: in_progress - owner: Codex - updated: 2026-07-19
- Also active: 59 more additional steps.
<!-- AGENT-END:current-focus -->

## Repo Snapshot

- Repository: \`struct\`
- Shape: Bun workspace monorepo (apps + packages)
- Core stack: Bun 1.3.13, TypeScript 7.0.2, Effect 3.22.0, SolidJS 1.9.14, Vite 8.1.5, Tailwind 4, DaisyUI 5
- Primary references: [[01_Architecture/System_Overview|System Overview]] and [[01_Architecture/Code_Map|Code Map]]

## In Scope Right Now

- Phase 02 is completed and merged through STEP-02-06 with deterministic retrieval, exact provenance, bounded core-Fred document research, SolidJS citation navigation, and injection-resistance evaluation.
- Phase 03 is refined and awaits publication of the refinement branch before STEP-03-01 starts in a fresh worker.
- STEP-03-01 is contract-only: directory/snapshot/manifest schemas, deterministic refresh classifications and digests, and durable documentation.
- Keep Bun as the sole host runtime and reuse the existing Effect, PostgreSQL, job-journal, SSE, artifact-storage, and SolidJS boundaries.

## Out Of Scope Right Now

- STEP-03-02 implementation and later Phase 03 work until STEP-03-01 is reviewed and merged.
- A second runtime, queue, database, filesystem service, client state framework, or Fred executor.
- The 25,000-file corpus, structured dataset computation, and later-phase release work.

## Working Assumptions

- This repo uses one vault at \`.agent-vault/\`.
- The vault does not contain a nested project folder.
- Notes stay readable in raw Markdown.

## Blockers

<!-- AGENT-START:blockers -->
- No phase, step, or session notes are currently marked blocked.
<!-- AGENT-END:blockers -->

## Open Questions

- None blocking STEP-03-01.

## Critical Bugs

<!-- AGENT-START:critical-bugs -->
- No open sev-1 or sev-2 bugs are currently recorded.
<!-- AGENT-END:critical-bugs -->

## Next Actions

- Publish and merge the Phase 02 close-out and Phase 03 refinement after final local and bot review.
- Start [[02_Phases/Phase_03_durable_directory_ingestion_and_source_refresh/Steps/Step_01_define-directory-manifests-snapshots-and-refresh-semantics|STEP-03-01 Define Directory Manifests Snapshots and Refresh Semantics]] in one fresh non-git worker on its own branch.
- Keep every later step sequential: self-review, PR, bot remediation, merge to `main`, then advance.
