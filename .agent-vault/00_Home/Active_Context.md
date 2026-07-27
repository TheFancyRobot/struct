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
_Last refreshed: 2026-07-27._
- Session in progress: [[05_Sessions/2026-07-27-002920-migrate-components-to-semantic-brand-tokens-step-10b-03|SESSION-2026-07-27-002920 step-10b-03 session for Migrate Components to Semantic Brand Tokens]] - owner: step-10b-03 - phase: [[02_Phases/Phase_10B_brand_implementation/Phase|PHASE-10B Brand Implementation]] - updated: 2026-07-27
- Current step: [[02_Phases/Phase_11_v1_1_research_usability/Steps/Step_02_add-saved-queries-views-and-research-templates|STEP-11-02 Add Saved Queries Views and Research Templates]] - status: planned - phase: [[02_Phases/Phase_11_v1_1_research_usability/Phase|Phase 11 v1 1 research usability]]
- Active phase: [[02_Phases/Phase_12_v1_2_additional_sources/Phase|PHASE-12 v1.2 Additional Sources]] - status: planned - updated: 2026-07-17
- Also active: 2 more additional sessions, 17 more additional steps, 5 open critical bugs.
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
- Phases 07–09 are complete and merged. BUG-0046 is fixed; Phase 10 delivery remains blocked by BUG-0047. Do not activate Phase 11 until BUG-0047 is validated and merged.
- Keep Bun as the sole host runtime. DuckDB belongs only in its pinned, authenticated, no-egress Docker Compose sidecar.
- Current correction: BUG-0013 is fixed by the validated real-stack root and BASE_PATH browser journey. The v1.0 release action remains intentionally unperformed.

## Out Of Scope Right Now

- A second runtime, queue, database, filesystem service, client state framework, or Fred executor.
- Later-phase release work.

## Working Assumptions

- This repo uses one vault at \`.agent-vault/\`.
- The vault does not contain a nested project folder.
- Notes stay readable in raw Markdown.

## Blockers

<!-- AGENT-START:blockers -->
- Phase: [[02_Phases/Phase_10_v1_usable_research_workspace/Phase|PHASE-10 v1 Usable Research Workspace]] - status: blocked - owner: Codex - updated: 2026-07-26
- Phase: [[02_Phases/Phase_11_v1_1_research_usability/Phase|PHASE-11 v1.1 Research Usability]] - status: blocked - updated: 2026-07-26
<!-- AGENT-END:blockers -->

## Open Questions

- No unresolved design question remains in the completed Phase 09 work.
- PHASE-10 is blocked on BUG-0047. Phase 11 must not advance until BUG-0047 is fixed and validated; do not perform the v1.0 release action without explicit authorization.

## Critical Bugs

<!-- AGENT-START:critical-bugs -->
- [[03_Bugs/BUG-0049_global-dataset-attachments-did-not-materialize-project-datasets|BUG-0049 Global dataset attachments did not materialize project datasets]] - status: fixed - severity: sev-1 - reported: 2026-07-26
- [[03_Bugs/BUG-0013_v1-ui-lacks-core-research-workflows|BUG-0013 v1 UI lacks core research workflows]] - status: fixed - severity: sev-1 - reported: 2026-07-21
- [[03_Bugs/BUG-0048_workspace-source-attachments-do-not-enqueue-text-indexing|BUG-0048 Workspace source attachments do not enqueue text indexing]] - status: fixed - severity: sev-2 - reported: 2026-07-26
- [[03_Bugs/BUG-0038_research-replay-loses-durable-job-ownership-before-cancellation-verification|BUG-0038 Research replay loses durable job ownership before cancellation verification]] - status: fixed - severity: sev-2 - reported: 2026-07-25
- [[03_Bugs/BUG-0040_api-workspace-bootstrap-prevents-health-checks-during-database-outages|BUG-0040 API workspace bootstrap prevents health checks during database outages]] - status: fixed - severity: sev-2 - reported: 2026-07-24
<!-- AGENT-END:critical-bugs -->

## Next Actions

- Implement and validate BUG-0047 in its own bug branch and PR; then refine Phase 11 before activating STEP-11-01.
- Do not perform the v1.0 release action without explicit authorization.
