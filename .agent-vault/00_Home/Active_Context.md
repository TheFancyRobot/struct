---
note_type: home_context
template_version: 1
contract_version: 1
title: Active Context
status: active
created: '2026-07-17'
updated: '2026-07-20'
tags:
  - agent-vault
  - home
  - context
---

# Active Context

Keep this note short and current.

## Current Objective

<!-- AGENT-START:current-focus -->
_Last refreshed: 2026-07-23._
- Session in progress: [[05_Sessions/2026-07-23-044455-establish-workspace-and-project-lifecycle-codex|SESSION-2026-07-23-044455 Codex session for Establish Workspace and Project Lifecycle]] - owner: Codex - phase: [[02_Phases/Phase_10_v1_usable_research_workspace/Phase|Phase 10 v1 usable research workspace]] - updated: 2026-07-23
- Current step: [[02_Phases/Phase_10_v1_usable_research_workspace/Steps/Step_01_establish-workspace-and-project-lifecycle|STEP-10-01 Establish Workspace and Project Lifecycle]] - status: planned - phase: [[02_Phases/Phase_10_v1_usable_research_workspace/Phase|Phase 10 v1 usable research workspace]]
- Active phase: [[02_Phases/Phase_10_v1_usable_research_workspace/Phase|PHASE-10 v1 Usable Research Workspace]] - status: planned - updated: 2026-07-21
- Also in scope: 25 more additional steps, 1 open critical bug.
<!-- AGENT-END:current-focus -->

## Repo Snapshot

- Repository: \`struct\`
- Shape: Bun workspace monorepo (apps + packages)
- Core stack: Bun 1.3.13, TypeScript 7.0.2, Effect 3.22.0, SolidJS 1.9.14, Vite 8.1.5, Tailwind 4, DaisyUI 5
- Primary references: [[01_Architecture/System_Overview|System Overview]] and [[01_Architecture/Code_Map|Code Map]]

## In Scope Right Now

- Phase 02 is completed and merged through STEP-02-06 with deterministic retrieval, exact provenance, bounded core-Fred document research, SolidJS citation navigation, and injection-resistance evaluation.
- Phase 03 and STEP-03-01 through STEP-03-06 are completed and merged.
- Phase 04 and STEP-04-01 through STEP-04-06 are completed and merged.
- Phase 05 and STEP-05-01 through STEP-05-06 are completed and merged.
- Phase 06 is completed, reviewed, and merged through STEP-06-06.
- Phases 07–09 are complete and merged. The v1 release checklist remains reopened by BUG-0013; the tag and GitHub release action are intentionally unperformed.
- Keep Bun as the sole host runtime. DuckDB belongs only in its pinned, authenticated, no-egress Docker Compose sidecar.
- Current correction: the v1 release gate is reopened by BUG-0013. PHASE-10 is refined only as technical reference and cannot begin until the confirmed bug is fixed; historical 23-gate/backend/fixture evidence is not sufficient for v1 release.

## Out Of Scope Right Now

- A second runtime, queue, database, filesystem service, client state framework, or Fred executor.
- Later-phase release work.

## Working Assumptions

- This repo uses one vault at \`.agent-vault/\`.
- The vault does not contain a nested project folder.
- Notes stay readable in raw Markdown.

## Blockers

<!-- AGENT-START:blockers -->
- No phase, step, or session notes are currently marked blocked; BUG-0013 is the active release/product blocker.
<!-- AGENT-END:blockers -->

## Open Questions

- No unresolved design question or confirmed defect remains in the completed Phase 09 work.
- PHASE-10 refinement has no unresolved design question. BUG-0013 is the confirmed blocker and intentional remediation target.

## Critical Bugs

<!-- AGENT-START:critical-bugs -->
- [[03_Bugs/BUG-0013_v1-ui-lacks-core-research-workflows|BUG-0013 v1 UI lacks core research workflows]] - status: confirmed - severity: sev-1 - reported: 2026-07-21
<!-- AGENT-END:critical-bugs -->

## Next Actions

- Publish and merge the corrected Phase 10 refinement packet, then run independently tracked BUG-0013 remediation units in the approved technical order.
- Keep every remediation unit sequential: self-review, PR, bot remediation, merge to `main`, then advance.
- Keep BUG-0013 and the release checklist open until the complete real browser journey passes; only then activate Phase 10 or perform the v1.0 release action.
