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
_Last refreshed: 2026-08-04._
- Session in progress: none.
- Current step: [[02_Phases/Phase_11_v1_1_research_usability/Steps/Step_01_improve-research-search-navigation-and-command-ux|STEP-11-01 Improve Research Search Navigation and Command UX]] - status: planned - phase: [[02_Phases/Phase_11_v1_1_research_usability/Phase|Phase 11 v1 1 research usability]]
- Active phase: [[02_Phases/Phase_12_v1_2_additional_sources/Phase|PHASE-12 v1.2 Additional Sources]] - status: planned - updated: 2026-07-17
- Also active: 16 more additional steps.
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
- Phases 07–10 are complete, with implementation bugs through BUG-0058 fixed. Phase 11 remains blocked by DEC-0024's mandatory full browser-coverage and cross-view design audit; do not activate it until that audit and every resulting bug fix are validated and merged.
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
- Phase: [[02_Phases/Phase_11_v1_1_research_usability/Phase|PHASE-11 v1.1 Research Usability]] - status: blocked - updated: 2026-07-26
- Step: [[02_Phases/Phase_11_v1_1_research_usability/Steps/Step_02_add-saved-queries-views-and-research-templates|STEP-11-02 Add Saved Queries Views and Research Templates]] - status: blocked - phase: [[02_Phases/Phase_11_v1_1_research_usability/Phase|Phase 11 v1 1 research usability]] - updated: 2026-07-17
<!-- AGENT-END:blockers -->

## Open Questions

- No unresolved design question remains in the completed Phase 09 work.
- PHASE-10 is complete. Phase 11 remains blocked by the accepted DEC-0024 browser-coverage and design-consistency audit and must not advance until the audit and every resulting bug fix are validated and merged; do not perform the v1.0 release action without explicit authorization.

## Critical Bugs

<!-- AGENT-START:critical-bugs -->
- No open sev-1 or sev-2 bugs are currently recorded.
<!-- AGENT-END:critical-bugs -->

## Next Actions

- Complete DEC-0024's full browser E2E coverage and cross-view design audit; record and fix every confirmed gap before Phase 11.
- Do not perform the v1.0 release action without explicit authorization.
