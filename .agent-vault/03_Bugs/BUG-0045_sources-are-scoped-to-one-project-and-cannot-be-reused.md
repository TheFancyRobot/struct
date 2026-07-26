---
note_type: bug
template_version: 2
contract_version: 1
title: Sources are scoped to one project and cannot be reused
bug_id: BUG-0045
status: fixed
severity: sev-3
category: logic
reported_on: '2026-07-26'
fixed_on: '2026-07-26'
owner: bug0045_fix
created: '2026-07-26'
updated: '2026-07-26'
related_notes: |-
  - '[[02_Phases/Phase_10_v1_usable_research_workspace/Phase|PHASE-10 v1 Usable Research Workspace]]'
  - '[[02_Phases/Phase_10_v1_usable_research_workspace/Steps/Step_01_establish-workspace-and-project-lifecycle|STEP-10-01 Establish Workspace and Project Lifecycle]]'
  - '[[02_Phases/Phase_10_v1_usable_research_workspace/Steps/Step_02_build-unified-three-pane-workspace-shell|STEP-10-02 Build Unified Three Pane Workspace Shell]]'
  - '[[02_Phases/Phase_10_v1_usable_research_workspace/Steps/Step_03_deliver-source-catalog-and-non-blocking-import|STEP-10-03 Deliver Source Catalog and Non-Blocking Import]]'
  - '[[02_Phases/Phase_10_v1_usable_research_workspace/Steps/Step_04_deliver-source-grounded-conversation|STEP-10-04 Deliver Source Grounded Conversation]]'
  - '[[02_Phases/Phase_10_v1_usable_research_workspace/Steps/Step_07_complete-responsive-accessibility-and-theme-behavior|STEP-10-07 Complete Responsive Accessibility and Theme Behavior]]'
  - '[[01_Architecture/System_Overview|System Overview]]'
  - '[[01_Architecture/Domain_Model|Domain Model]]'
  - '[[01_Architecture/Integration_Map|Integration Map]]'
  - '[[04_Decisions/DEC-0006_make-source-versions-immutable-and-provenance-typed|DEC-0006 Make Source Versions Immutable and Provenance Typed]]'
  - '[[04_Decisions/DEC-0008_own-the-typed-api-and-live-research-event-stream|DEC-0008 Own the Typed API and Live Research Event Stream]]'
  - '[[04_Decisions/DEC-0009_sandbox-filesystem-roots-and-allowlist-read-only-sql|DEC-0009 Sandbox Filesystem Roots and Allowlist Read-Only SQL]]'
  - '[[04_Decisions/DEC-0013_use-tailwind-css-and-daisyui-with-a-custom-theme-for-frontend-styling|DEC-0013 Use Tailwind CSS and DaisyUI with a Custom Theme for Frontend Styling]]'
  - '[[02_Phases/Phase_11_v1_1_research_usability/Phase|PHASE-11 v1.1 Research Usability]]'
tags:
  - agent-vault
  - bug
---

# BUG-0045 - Sources are scoped to one project and cannot be reused

Use one note per bug. Capture reproduction, impact, root cause, workaround, and verification, then link back to the relevant phase, step, decision, or session. See [[07_Templates/Note_Contracts|Note Contracts]].

## Summary

- Sources are scoped to one project and cannot be reused.
- Related notes: [[02_Phases/Phase_10_v1_usable_research_workspace/Steps/Step_03_deliver-source-catalog-and-non-blocking-import|STEP-10-03 Deliver Source Catalog and Non Blocking Import]].

## Observed Behavior

- Importing a source made it visible only through its origin `sources.project_id`. A second project in the same workspace could neither select it nor use its immutable version without loading a duplicate.

## Expected Behavior

- A source is owned by its workspace and has one ingestion/version lineage. Any project in that workspace can explicitly attach it, then use it for catalog, research, retrieval, datasets, exports, and provenance without re-ingestion.

## Reproduction Steps

1. Create two projects in one workspace and import a ready document into the first.
2. Open the source library and attach that source to the second project.
3. Verify the second project can list, research, retrieve, export, and detach the shared source while the source/version remains a single record.

## Scope / Blast Radius

- Affected source catalog and imports, research execution, text retrieval, dataset materializations, reports, provenance, findings, document chunks, the API, and the web workspace source library.

## Suspected Root Cause

- The one-project model was likely an initial ingestion simplification. Immutable versions and artifacts were already reusable, but every consumer treated the origin project as the authorization boundary.

## Confirmed Root Cause

- Record the proven cause and decisive evidence.
- `sources.project_id` served simultaneously as ownership, authorization, and catalog visibility. Every derived-source query inherited that one-project assumption, even though immutable source versions and ingestion artifacts were already reusable.

## Workaround

- No safe workaround existed: duplicating imports wasted work and split provenance. The fix replaces that behavior with explicit workspace-owned sources and project attachments.

## Permanent Fix Plan

- Describe the intended durable fix.
- Implemented `sources.workspace_id` as tenant ownership plus `project_sources` as the only project membership relation. Imports create one logical source/version/job and an initial attachment; workspace APIs and UI manage additional attachments without reingestion.
- Project catalog, activity, research, citation, finding, dataset, and provenance queries now require workspace ownership and project attachment.

## Regression Coverage Needed

- Added persistence integration coverage proving one workspace source is listed once, attaches to a second project, becomes visible there, and disappears after detach without another source/version.
- Added attached-source authorization coverage for source registration, catalog, research, retrieval, dataset scope, report export, and chunk ownership boundaries.
- Passed focused API/web/registration and affected persistence integration tests, migration down/up and upgrade coverage, typecheck, lint, and vault doctor.

## Related Notes

<!-- AGENT-START:bug-related-notes -->
- Phase: [[02_Phases/Phase_10_v1_usable_research_workspace/Phase|Phase 10 v1 usable research workspace]]
- Lifecycle: [[02_Phases/Phase_10_v1_usable_research_workspace/Steps/Step_01_establish-workspace-and-project-lifecycle|STEP-10-01 Establish Workspace and Project Lifecycle]]
- Source catalog: [[02_Phases/Phase_10_v1_usable_research_workspace/Steps/Step_03_deliver-source-catalog-and-non-blocking-import|STEP-10-03 Deliver Source Catalog and Non-Blocking Import]]
- Source-grounded conversation: [[02_Phases/Phase_10_v1_usable_research_workspace/Steps/Step_04_deliver-source-grounded-conversation|STEP-10-04 Deliver Source Grounded Conversation]]
- Architecture: [[01_Architecture/System_Overview|System Overview]], [[01_Architecture/Domain_Model|Domain Model]], and [[01_Architecture/Integration_Map|Integration Map]]
- Ownership/provenance: [[04_Decisions/DEC-0006_make-source-versions-immutable-and-provenance-typed|DEC-0006 Make Source Versions Immutable and Provenance Typed]]
- API/event boundary: [[04_Decisions/DEC-0008_own-the-typed-api-and-live-research-event-stream|DEC-0008 Own the Typed API and Live Research Event Stream]]
- Follow-on phase: [[02_Phases/Phase_11_v1_1_research_usability/Phase|PHASE-11 v1.1 Research Usability]]
<!-- AGENT-END:bug-related-notes -->

## Timeline

<!-- AGENT-START:bug-timeline -->
- 2026-07-26 - Reported.
- 2026-07-26 - Fixed with workspace source ownership and explicit project attachments.
- 2026-07-26 - Verified with reuse, authorization, migration, type, lint, and vault integrity checks.
<!-- AGENT-END:bug-timeline -->
