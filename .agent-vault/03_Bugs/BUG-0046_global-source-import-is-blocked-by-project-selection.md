---
note_type: bug
template_version: 2
contract_version: 1
title: Global source import is blocked by project selection
bug_id: BUG-0046
status: fixed
severity: sev-3
category: logic
reported_on: '2026-07-26'
fixed_on: '2026-07-26'
owner: openai-codex/gpt-5.6-sol
created: '2026-07-26'
updated: '2026-07-26'
related_notes: |-
  - '[[02_Phases/Phase_10_v1_usable_research_workspace/Phase|PHASE-10 v1 Usable Research Workspace]]'
  - '[[02_Phases/Phase_10_v1_usable_research_workspace/Steps/Step_01_establish-workspace-and-project-lifecycle|STEP-10-01 Establish Workspace and Project Lifecycle]]'
  - '[[02_Phases/Phase_10_v1_usable_research_workspace/Steps/Step_02_build-unified-three-pane-workspace-shell|STEP-10-02 Build Unified Three Pane Workspace Shell]]'
  - '[[02_Phases/Phase_10_v1_usable_research_workspace/Steps/Step_03_deliver-source-catalog-and-non-blocking-import|STEP-10-03 Deliver Source Catalog and Non-Blocking Import]]'
  - '[[02_Phases/Phase_10_v1_usable_research_workspace/Steps/Step_04_deliver-source-grounded-conversation|STEP-10-04 Deliver Source Grounded Conversation]]'
  - '[[02_Phases/Phase_10_v1_usable_research_workspace/Steps/Step_09_make-source-registration-workspace-scoped|STEP-10-09 Make Source Registration Workspace Scoped]]'
  - '[[01_Architecture/System_Overview|System Overview]]'
  - '[[01_Architecture/Domain_Model|Domain Model]]'
  - '[[01_Architecture/Integration_Map|Integration Map]]'
  - '[[04_Decisions/DEC-0006_make-source-versions-immutable-and-provenance-typed|DEC-0006 Make Source Versions Immutable and Provenance Typed]]'
  - '[[04_Decisions/DEC-0013_use-tailwind-css-and-daisyui-with-a-custom-theme-for-frontend-styling|DEC-0013 Use Tailwind CSS and DaisyUI with a Custom Theme for Frontend Styling]]'
  - '[[04_Decisions/DEC-0014_use-solidjs-vite-8-and-solid-router-for-frontend-runtime|DEC-0014 Use SolidJS, Vite 8, and Solid Router for Frontend Runtime]]'
  - '[[02_Phases/Phase_11_v1_1_research_usability/Phase|PHASE-11 v1.1 Research Usability]]'
tags:
  - agent-vault
  - bug
---

# BUG-0046 - Global source import is blocked by project selection

Use one note per bug. Capture reproduction, impact, root cause, workaround, and verification, then link back to the relevant phase, step, decision, or session. See [[07_Templates/Note_Contracts|Note Contracts]].

## Summary

- Global source import is blocked by project selection.
- Related notes: Phase 10 source catalog/import, workspace shell, source lineage, and frontend navigation decisions.

## Observed Behavior

- In the source library with no project selected, the UI displays “Create a project before importing sources” and hides the import controls. A user cannot add a workspace-global source until creating a project.

## Expected Behavior

- The global source library always exposes source import. When a project is selected, the import flow offers “add to this project” enabled by default; without a project, it creates an unattached global source.

## Reproduction Steps

1. Open `/sources` before selecting or creating a project.
2. Choose “Add source” from the sidebar.
3. Observe the project prerequisite notice instead of global import controls.

## Scope / Blast Radius

- Affects the global source library, sidebar “Add source” action, import API contract, project source view, source search/selection, and source attachment behavior.

## Suspected Root Cause

- The source-library page reuses a project-scoped import panel and treats its selected project as a required prerequisite, despite sources now being workspace-owned.

## Confirmed Root Cause

- The screenshot confirmed the UI gate remained after workspace-owned source support was introduced.
- The web import client and API route encoded project selection in the URL, and batch registration always inserted `project_sources`, conflating ingestion context with catalog attachment.

## Workaround

- Create a throwaway project before importing, then attach the source where needed. This leaves unnecessary projects and obscures the global-source model.

## Permanent Fix Plan

- Completed: global import is separate from project attachment. The library imports without a project; project-route imports always attach, while library attachment is opt-in.

## Regression Coverage Needed

- Completed: zero-project API registration, PostgreSQL persistence/replay, worker ingestion, library UI rendering, project-route attachment, and full-suite coverage. No follow-up coverage is outstanding for BUG-0046.

## Related Notes

<!-- AGENT-START:bug-related-notes -->
- Phase: [[02_Phases/Phase_10_v1_usable_research_workspace/Phase|Phase 10 v1 usable research workspace]]
- Lifecycle: [[02_Phases/Phase_10_v1_usable_research_workspace/Steps/Step_01_establish-workspace-and-project-lifecycle|STEP-10-01 Establish Workspace and Project Lifecycle]]
- Workspace shell: [[02_Phases/Phase_10_v1_usable_research_workspace/Steps/Step_02_build-unified-three-pane-workspace-shell|STEP-10-02 Build Unified Three Pane Workspace Shell]]
- Source catalog/import: [[02_Phases/Phase_10_v1_usable_research_workspace/Steps/Step_03_deliver-source-catalog-and-non-blocking-import|STEP-10-03 Deliver Source Catalog and Non-Blocking Import]]
- Source-grounded research: [[02_Phases/Phase_10_v1_usable_research_workspace/Steps/Step_04_deliver-source-grounded-conversation|STEP-10-04 Deliver Source Grounded Conversation]]
- Architecture: [[01_Architecture/System_Overview|System Overview]], [[01_Architecture/Domain_Model|Domain Model]], and [[01_Architecture/Integration_Map|Integration Map]]
- Source lineage: [[04_Decisions/DEC-0006_make-source-versions-immutable-and-provenance-typed|DEC-0006 Make Source Versions Immutable and Provenance Typed]]
- Frontend design/runtime: [[04_Decisions/DEC-0013_use-tailwind-css-and-daisyui-with-a-custom-theme-for-frontend-styling|DEC-0013 Use Tailwind CSS and DaisyUI with a Custom Theme for Frontend Styling]] and [[04_Decisions/DEC-0014_use-solidjs-vite-8-and-solid-router-for-frontend-runtime|DEC-0014 Use SolidJS, Vite 8, and Solid Router for Frontend Runtime]]
- Follow-on usability: [[02_Phases/Phase_11_v1_1_research_usability/Phase|PHASE-11 v1.1 Research Usability]]
<!-- AGENT-END:bug-related-notes -->

## Timeline

<!-- AGENT-START:bug-timeline -->
- 2026-07-26 - Reported.
- 2026-07-26 - Reproduction and intended global/project tab behavior documented.
<!-- AGENT-END:bug-timeline -->
- 2026-07-26 — Fixed by adding workspace-library imports with optional attachment, preserving a bounded ingestion context, and adding focused regression coverage.
- 2026-07-26 — Root verification correction: removed the first-project ingestion fallback and made source registration genuinely workspace-scoped. Zero-project API, PostgreSQL persistence/replay, and worker ingestion regressions pass; no hidden project is required.
- 2026-07-26 — Attempt 3 regression audit found migration 0022 had removed the legacy source-to-project attachment trigger, breaking project-scoped source fixtures and 37 downstream PostgreSQL tests. The migration now keeps the trigger and conditionally attaches only when `project_id` is non-null; its down migration cleanly restores unconditional attachment. After recreating the inconsistent greenfield database and correcting the stale data-engine artifact mount, the complete suite passed: 989 passed, 3 skipped, 0 failed.
