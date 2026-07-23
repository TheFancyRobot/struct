---
note_type: step
template_version: 2
contract_version: 1
title: Define Findings Reports Citation States and Lifecycle
step_id: STEP-08-01
phase: '[[02_Phases/Phase_08_citation_backed_reports_and_durable_findings/Phase|Phase 08 citation backed reports and durable findings]]'
status: completed
owner: ''
created: '2026-07-17'
updated: '2026-07-20'
depends_on:
  - '[[02_Phases/Phase_07_hybrid_cross_source_research/Steps/Step_06_evaluate-hybrid-correctness-provenance-and-security|STEP-07-06 Evaluate Hybrid Correctness Provenance and Security]]'
related_sessions:
  - '[[05_Sessions/2026-07-20-162818-define-findings-reports-citation-states-and-lifecycle-phase-08-refinement-worker|SESSION-2026-07-20-162818 phase-08-refinement-worker session for Define Findings Reports Citation States and Lifecycle]]'
  - '[[05_Sessions/2026-07-20-163917-define-findings-reports-citation-states-and-lifecycle-report-lifecycle-contracts|SESSION-2026-07-20-163917 report-lifecycle-contracts session for Define Findings Reports Citation States and Lifecycle]]'
related_bugs: []
tags:
  - agent-vault
  - step
context_id: SESSION-2026-07-20-163917
active_session_id: ''
context_status: complete
context_summary: Canonical durable finding/report/claim/citation lifecycle and direct greenfield persistence contracts pass all focused and repository gates with zero known defects.
---

# Step 01 - Define Findings Reports Citation States and Lifecycle

Use this note as a thin index for one executable step. Keep detail in companion notes so execution can load only the smallest note needed.

## Purpose

- Outcome: Define the smallest stable contract for Findings Reports Citation States and Lifecycle so later implementation can proceed without reopening boundaries around editable outputs without breaking citation provenance.
- Parent phase: [[02_Phases/Phase_08_citation_backed_reports_and_durable_findings/Phase|Phase 08 citation backed reports and durable findings]].
- Sequencing: start after [[02_Phases/Phase_07_hybrid_cross_source_research/Steps/Step_06_evaluate-hybrid-correctness-provenance-and-security|STEP-07-06 Evaluate Hybrid Correctness Provenance and Security]] has a stable outcome or handoff.

## Required Reading

- [[02_Phases/Phase_08_citation_backed_reports_and_durable_findings/Phase|Phase 08 citation backed reports and durable findings]]
- [[02_Phases/Phase_08_citation_backed_reports_and_durable_findings/Steps/Step_01_define-findings-reports-citation-states-and-lifecycle/Execution_Brief|Execution Brief]]
- [[02_Phases/Phase_08_citation_backed_reports_and_durable_findings/Steps/Step_01_define-findings-reports-citation-states-and-lifecycle/Validation_Plan|Validation Plan]]
- [[01_Architecture/Domain_Model|Domain Model]]
- [[01_Architecture/Agent_Workflow|Agent Workflow]]

## Companion Notes

- [[02_Phases/Phase_08_citation_backed_reports_and_durable_findings/Steps/Step_01_define-findings-reports-citation-states-and-lifecycle/Execution_Brief|Execution Brief]] - Why the step exists, prerequisites, likely code paths, and the smallest execution checklist.
- [[02_Phases/Phase_08_citation_backed_reports_and_durable_findings/Steps/Step_01_define-findings-reports-citation-states-and-lifecycle/Validation_Plan|Validation Plan]] - Acceptance checks, commands, edge cases, and regression expectations.
- [[02_Phases/Phase_08_citation_backed_reports_and_durable_findings/Steps/Step_01_define-findings-reports-citation-states-and-lifecycle/Implementation_Notes|Implementation Notes]] - Durable findings discovered while the step is being executed.
- [[02_Phases/Phase_08_citation_backed_reports_and_durable_findings/Steps/Step_01_define-findings-reports-citation-states-and-lifecycle/Outcome|Outcome]] - Final result, validation evidence, and explicit follow-up.

## Agent-Managed Snapshot

<!-- AGENT-START:step-agent-managed-snapshot -->
- Status: completed
- Current owner:
- Last touched: 2026-07-17
- Next action: None; step completed.
<!-- AGENT-END:step-agent-managed-snapshot -->

## Human Notes

- Keep this step narrow and explicit; planned paths may not exist yet and should be created only when execution begins.
- Refined 2026-07-20 in [[05_Sessions/2026-07-20-162818-define-findings-reports-citation-states-and-lifecycle-phase-08-refinement-worker|the Phase 08 refinement session]]. Extend and converge the existing domain/citation contracts; define the direct greenfield persistence lifecycle; do not duplicate models or add runtime/API/UI/export/Fred scope.

## Session History

<!-- AGENT-START:step-session-history -->
- 2026-07-20 - [[05_Sessions/2026-07-20-162818-define-findings-reports-citation-states-and-lifecycle-phase-08-refinement-worker|SESSION-2026-07-20-162818 phase-08-refinement-worker session for Define Findings Reports Citation States and Lifecycle]] - Session created.
- 2026-07-20 - [[05_Sessions/2026-07-20-163917-define-findings-reports-citation-states-and-lifecycle-report-lifecycle-contracts|SESSION-2026-07-20-163917 report-lifecycle-contracts session for Define Findings Reports Citation States and Lifecycle]] - Session created.
<!-- AGENT-END:step-session-history -->

## Related Notes

- [[07_Templates/Note_Contracts|Note Contracts]]
- [[07_Templates/Phase_Template|Phase Template]]
