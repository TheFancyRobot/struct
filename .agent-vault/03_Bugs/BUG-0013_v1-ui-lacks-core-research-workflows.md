---
note_type: bug
template_version: 2
contract_version: 1
title: v1 UI lacks core research workflows
bug_id: BUG-0013
status: confirmed
severity: sev-1
category: logic
reported_on: '2026-07-21'
fixed_on: ''
owner: Codex
created: '2026-07-21'
updated: '2026-07-21'
related_notes:
  - '[[02_Phases/Phase_10_v1_usable_research_workspace/Phase|PHASE-10 v1 Usable Research Workspace]]'
  - '[[02_Phases/Phase_10_v1_usable_research_workspace/Steps/Step_01_establish-workspace-and-project-lifecycle|STEP-10-01 Establish Workspace and Project Lifecycle]]'
  - '[[02_Phases/Phase_10_v1_usable_research_workspace/Steps/Step_08_gate-v1-on-the-complete-browser-journey|STEP-10-08 Gate v1 on the Complete Browser Journey]]'
  - '[[02_Phases/Phase_09_v1_production_hardening_and_release/Phase|PHASE-09 v1 Production Hardening and Release]]'
  - '[[02_Phases/Phase_02_document_research_and_hybrid_retrieval/Phase|PHASE-02 Document Research and Hybrid Retrieval]]'
  - '[[02_Phases/Phase_03_durable_directory_ingestion_and_source_refresh/Phase|PHASE-03 Durable Directory Ingestion and Source Refresh]]'
  - '[[02_Phases/Phase_04_structured_datasets_and_deterministic_sql/Phase|PHASE-04 Structured Datasets and Deterministic SQL]]'
  - '[[02_Phases/Phase_05_typed_research_planning_and_bounded_execution/Phase|PHASE-05 Typed Research Planning and Bounded Execution]]'
  - '[[02_Phases/Phase_08_citation_backed_reports_and_durable_findings/Phase|PHASE-08 Citation-Backed Reports and Durable Findings]]'
  - '[[02_Phases/Phase_11_v1_1_research_usability/Phase|PHASE-11 v1.1 Research Usability]]'
  - '[[01_Architecture/System_Overview|System Overview]]'
  - '[[01_Architecture/Integration_Map|Integration Map]]'
  - '[[02_Phases/Phase_09_v1_production_hardening_and_release/Steps/Step_06_publish-v1-documentation-accessibility-and-release-checklist|STEP-09-06 Publish v1 Documentation Accessibility and Release Checklist]]'
tags:
  - agent-vault
  - bug
---

# BUG-0013 - v1 UI lacks core research workflows

Use one note per bug. Capture reproduction, impact, root cause, workaround, and verification, then link back to the relevant phase, step, decision, or session. See [[07_Templates/Note_Contracts|Note Contracts]].

## Summary

- v1 UI lacks core research workflows.
- Related notes: [[02_Phases/Phase_09_v1_production_hardening_and_release/Steps/Step_06_publish-v1-documentation-accessibility-and-release-checklist|STEP-09-06 Publish v1 Documentation Accessibility and Release Checklist]].

## Observed Behavior

- The root route renders a hard-coded `mixedSourceDemoFixture('complete')` research result.
- Playwright finds no chat composer, upload/import action, or note-creation control.
- The only notebook navigation control is disabled and requires project identifiers that the UI cannot create or select.
- API routes exist for text-source registration, directory registration, and research execution, but the root user journey does not expose them.

## Expected Behavior

- A new user can create or select a project, add supported sources, inspect ingestion, ask a source-grounded question, follow progress, inspect citations, and save a finding or note entirely through the UI.

## Reproduction Steps

1. Start `apps/web` and open the root route.
2. Attempt to add a document, create a note, or ask a question about the displayed sources.
3. Observe that none of those actions are available; only a static example report and theme toggle are interactive.

## Scope / Blast Radius

- Blocks every first-run and returning-user research workflow in `apps/web`.
- Invalidates the v1 product objectives for project creation, source ingestion, research conversation, and saved work.

## Suspected Root Cause

- Phase acceptance focused on backend contracts, deterministic evaluators, accessibility, and rendering an existing report state without validating a complete browser-driven user journey from an empty workspace.

## Confirmed Root Cause

- `HomePage.tsx` directly renders the static mixed-source demo fixture.
- `App.tsx` disables notebook navigation and provides no project/source/research creation affordances.
- Playwright inspection of the running root route reports zero textareas and no relevant buttons or links.
- The product brief explicitly assigns source management and research conversation to `apps/web`, so this is a missing v1 workflow rather than optional v1.1 polish.

## Workaround

- Backend API calls can exercise portions of the system manually, but this is not a user-facing workaround and does not make the application releasable.

## Permanent Fix Plan

- Reopen the v1 release gate and implement one coherent workspace shell covering project selection/creation, source import and ingestion status, document-grounded chat, citation navigation, and saved notes/findings.
- Replace the root demo fixture with persisted API-backed state and make all primary workflows discoverable without hand-constructed URLs or IDs.
- Use the approved Phase 10 packets in explicit STEP-10-01 through STEP-10-08 technical order as independently tracked BUG-0013 remediation units; do not activate PHASE-10 or any `STEP-10-*` roadmap step while this confirmed defect is open. The approved design and implementation plan under `docs/superpowers/` remain the product and delivery source of truth.

## Regression Coverage Needed

- Playwright first-run test: create project, add document, wait for ingestion, ask a question, open a citation, and save a note/finding.
- Playwright returning-user test: reopen a project and continue the conversation.
- Empty, loading, failure, retry, and offline states for every primary workflow.
- Release checklist must require the complete browser journey, not component rendering alone.

## Related Notes

<!-- AGENT-START:bug-related-notes -->
- Architecture: [[01_Architecture/System_Overview|System Overview]], [[01_Architecture/Integration_Map|Integration Map]]
- Functional phases: [[02_Phases/Phase_02_document_research_and_hybrid_retrieval/Phase|PHASE-02 Document Research and Hybrid Retrieval]], [[02_Phases/Phase_03_durable_directory_ingestion_and_source_refresh/Phase|PHASE-03 Durable Directory Ingestion and Source Refresh]], [[02_Phases/Phase_04_structured_datasets_and_deterministic_sql/Phase|PHASE-04 Structured Datasets and Deterministic SQL]], [[02_Phases/Phase_05_typed_research_planning_and_bounded_execution/Phase|PHASE-05 Typed Research Planning and Bounded Execution]], [[02_Phases/Phase_08_citation_backed_reports_and_durable_findings/Phase|PHASE-08 Citation-Backed Reports and Durable Findings]]
- Release phase: [[02_Phases/Phase_09_v1_production_hardening_and_release/Phase|PHASE-09 v1 Production Hardening and Release]]
- Deferred usability phase: [[02_Phases/Phase_11_v1_1_research_usability/Phase|PHASE-11 v1.1 Research Usability]]
- Step: [[02_Phases/Phase_09_v1_production_hardening_and_release/Steps/Step_06_publish-v1-documentation-accessibility-and-release-checklist|STEP-09-06 Publish v1 Documentation Accessibility and Release Checklist]]
<!-- AGENT-END:bug-related-notes -->
- Remediation phase: [[02_Phases/Phase_10_v1_usable_research_workspace/Phase|PHASE-10 v1 Usable Research Workspace]]
- First executable step: [[02_Phases/Phase_10_v1_usable_research_workspace/Steps/Step_01_establish-workspace-and-project-lifecycle|STEP-10-01 Establish Workspace and Project Lifecycle]]
- Release gate: [[02_Phases/Phase_10_v1_usable_research_workspace/Steps/Step_08_gate-v1-on-the-complete-browser-journey|STEP-10-08 Gate v1 on the Complete Browser Journey]]

## Timeline

<!-- AGENT-START:bug-timeline -->
- 2026-07-21 - Reported.
- 2026-07-21 - Confirmed with Playwright and code inspection; v1 release is blocked.
<!-- AGENT-END:bug-timeline -->
- 2026-07-21 - Approved design converted into PHASE-10 with eight sequenced executable steps; implementation intentionally not started during vault-plan.
