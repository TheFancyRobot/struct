---
note_type: home_context
template_version: 1
contract_version: 1
title: Active Context
status: active
created: '2026-07-17'
updated: '2026-07-26'
tags:
  - agent-vault
  - home
  - context
---

# Active Context

Keep this note short and current.

## Current Objective

<!-- AGENT-START:current-focus -->
_Last refreshed: 2026-07-26._
- Session in progress: none.
- Current step: [[02_Phases/Phase_10_v1_usable_research_workspace/Steps/Step_08_gate-v1-on-the-complete-browser-journey|STEP-10-08 Gate v1 on the Complete Browser Journey]] - status: planned - phase: [[02_Phases/Phase_10_v1_usable_research_workspace/Phase|Phase 10 v1 usable research workspace]]
- Active phase: [[02_Phases/Phase_10_v1_usable_research_workspace/Phase|PHASE-10 v1 Usable Research Workspace]] - status: planned - updated: 2026-07-21
- Also active: 18 more additional steps, 3 open critical bugs.
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
- Phases 07–09 are complete and merged. BUG-0035's real-stack browser journey remediation passed final validation; the tag and GitHub release action remain intentionally unperformed.
- Keep Bun as the sole host runtime. DuckDB belongs only in its pinned, authenticated, no-egress Docker Compose sidecar.
- Current correction: BUG-0035 replaced fixture-backed browser evidence with a validated real-stack journey. PHASE-10 remains technical reference only; the v1.0 release action is still intentionally unperformed.

## Out Of Scope Right Now

- A second runtime, queue, database, filesystem service, client state framework, or Fred executor.
- Later-phase release work.

## Working Assumptions

- This repo uses one vault at \`.agent-vault/\`.
- The vault does not contain a nested project folder.
- Notes stay readable in raw Markdown.

## Blockers

<!-- AGENT-START:blockers -->
- No phase, step, or session notes are currently marked blocked.
<!-- AGENT-END:blockers -->

## Open Questions

- No unresolved design question remains in the completed Phase 09 work.
- PHASE-10 refinement has no unresolved design question. BUG-0035 is fixed; do not perform the v1.0 release action without explicit authorization.

## Critical Bugs

<!-- AGENT-START:critical-bugs -->
- [[03_Bugs/BUG-0013_v1-ui-lacks-core-research-workflows|BUG-0013 v1 UI lacks core research workflows]] - status: fixed - severity: sev-1 - reported: 2026-07-21
- [[03_Bugs/BUG-0038_research-replay-loses-durable-job-ownership-before-cancellation-verification|BUG-0038 Research replay loses durable job ownership before cancellation verification]] - status: fixed - severity: sev-2 - reported: 2026-07-25
- [[03_Bugs/BUG-0040_api-workspace-bootstrap-prevents-health-checks-during-database-outages|BUG-0040 API workspace bootstrap prevents health checks during database outages]] - status: fixed - severity: sev-2 - reported: 2026-07-24
<!-- AGENT-END:critical-bugs -->

## Next Actions

- Commit and review the validated BUG-0035 remediation branch.
- Do not perform the v1.0 release action without explicit authorization.
