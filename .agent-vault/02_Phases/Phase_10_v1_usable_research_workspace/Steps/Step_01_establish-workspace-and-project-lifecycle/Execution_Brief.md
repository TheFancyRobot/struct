# Execution Brief

- Record why the step exists, prerequisites, likely code paths, and the smallest execution checklist here.

- Prerequisites: Phase 09 authorization and workspace isolation remain intact; no post-v1 navigation work begins.
- Required reading: approved design and implementation plan in `docs/superpowers/`; `docs/product-brief.md`; DEC-0003, DEC-0008, DEC-0014; System Overview and Integration Map.
- Starting files: `packages/domain/src/schemas.ts`, `packages/domain/src/branded-ids.ts`, `packages/persistence/src/repositories/interfaces.ts`, `packages/persistence/src/migrations/`, `apps/api/src/main.ts`, `apps/web/src/index.tsx`, and `apps/web/src/App.tsx`.
- Checklist: add typed list/create contracts; add workspace-isolated repository operations and greenfield schema changes; expose authenticated API routes; add a typed web client; establish the canonical project route and selector/creator; preserve deep links and reload state.
- Edge cases: empty workspace, duplicate or invalid names, cross-workspace enumeration, stale/deleted selection, refresh during creation, API timeout, and browser back/forward.

## Related Notes

- Step: [[02_Phases/Phase_10_v1_usable_research_workspace/Steps/Step_01_establish-workspace-and-project-lifecycle|STEP-10-01 Establish Workspace and Project Lifecycle]]
- Phase: [[02_Phases/Phase_10_v1_usable_research_workspace/Phase|Phase 10 v1 usable research workspace]]
