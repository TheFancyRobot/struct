# Execution Brief

- Record why the step exists, prerequisites, likely code paths, and the smallest execution checklist here.

- Prerequisite: STEP-10-01 canonical project scope and route.
- Required reading: approved design; DEC-0013 and DEC-0014; BUG-0012; current `App.tsx`, `index.tsx`, `index.css`, and Home/Research/Notebook pages.
- Starting files: `apps/web/src/App.tsx`, `apps/web/src/index.tsx`, `apps/web/src/index.css`, `apps/web/src/pages/`, and new bounded workspace components.
- Checklist: implement WorkspaceShell, left navigation, center conversation region, right evidence region, independent pane state, Manrope/IBM Plex Mono roles, DaisyUI primitives, semantic landmarks, focus restoration, and no outer max-width container.
- Edge cases: long project/source names, narrow desktop, collapsed panes, deep route load, theme restoration, zoom/text scaling, and keyboard-only pane changes.

## Related Notes

- Step: [[02_Phases/Phase_10_v1_usable_research_workspace/Steps/Step_02_build-unified-three-pane-workspace-shell|STEP-10-02 Build Unified Three Pane Workspace Shell]]
- Phase: [[02_Phases/Phase_10_v1_usable_research_workspace/Phase|Phase 10 v1 usable research workspace]]
