---
note_type: step
template_version: 2
contract_version: 1
title: Implement Citation Validation and Provenance Graph
step_id: STEP-08-02
phase: '[[02_Phases/Phase_08_citation_backed_reports_and_durable_findings/Phase|Phase 08 citation backed reports and durable findings]]'
status: completed
owner: root-orchestrator
created: '2026-07-17'
updated: '2026-07-20'
depends_on:
  - '[[02_Phases/Phase_08_citation_backed_reports_and_durable_findings/Steps/Step_01_define-findings-reports-citation-states-and-lifecycle|STEP-08-01 Define Findings Reports Citation States and Lifecycle]]'
related_sessions:
  - '[[05_Sessions/2026-07-20-170450-implement-citation-validation-and-provenance-graph-citation-provenance-validation|SESSION-2026-07-20-170450 citation-provenance-validation session for Implement Citation Validation and Provenance Graph]]'
related_bugs: []
tags:
  - agent-vault
  - step
context_id: SESSION-2026-07-20-170450
active_session_id: ''
context_status: complete
context_summary: 'Citation provenance validation, publication gating, scoped evidence reopening, canonical recursive excerpts, and relational graph persistence merged through PR #48 with all repository and PostgreSQL gates clean.'
---

# Step 02 - Implement Citation Validation and Provenance Graph

Use this note as a thin index for one executable step. Keep detail in companion notes so execution can load only the smallest note needed.

## Purpose

- Outcome: Implement the smallest coherent slice for Citation Validation and Provenance Graph that advances Citation-Backed Reports and Durable Findings while preserving editable outputs without breaking citation provenance.
- Parent phase: [[02_Phases/Phase_08_citation_backed_reports_and_durable_findings/Phase|Phase 08 citation backed reports and durable findings]].
- Sequencing: start after [[02_Phases/Phase_08_citation_backed_reports_and_durable_findings/Steps/Step_01_define-findings-reports-citation-states-and-lifecycle|STEP-08-01 Define Findings Reports Citation States and Lifecycle]] has a stable outcome or handoff.

## Required Reading

- [[02_Phases/Phase_08_citation_backed_reports_and_durable_findings/Phase|Phase 08 citation backed reports and durable findings]]
- [[02_Phases/Phase_08_citation_backed_reports_and_durable_findings/Steps/Step_02_implement-citation-validation-and-provenance-graph/Execution_Brief|Execution Brief]]
- [[02_Phases/Phase_08_citation_backed_reports_and_durable_findings/Steps/Step_02_implement-citation-validation-and-provenance-graph/Validation_Plan|Validation Plan]]
- [[01_Architecture/Domain_Model|Domain Model]]
- [[01_Architecture/Agent_Workflow|Agent Workflow]]

## Companion Notes

- [[02_Phases/Phase_08_citation_backed_reports_and_durable_findings/Steps/Step_02_implement-citation-validation-and-provenance-graph/Execution_Brief|Execution Brief]] - Why the step exists, prerequisites, likely code paths, and the smallest execution checklist.
- [[02_Phases/Phase_08_citation_backed_reports_and_durable_findings/Steps/Step_02_implement-citation-validation-and-provenance-graph/Validation_Plan|Validation Plan]] - Acceptance checks, commands, edge cases, and regression expectations.
- [[02_Phases/Phase_08_citation_backed_reports_and_durable_findings/Steps/Step_02_implement-citation-validation-and-provenance-graph/Implementation_Notes|Implementation Notes]] - Durable findings discovered while the step is being executed.
- [[02_Phases/Phase_08_citation_backed_reports_and_durable_findings/Steps/Step_02_implement-citation-validation-and-provenance-graph/Outcome|Outcome]] - Final result, validation evidence, and explicit follow-up.

## Agent-Managed Snapshot

<!-- AGENT-START:step-agent-managed-snapshot -->
- Status: planned
- Current owner:
- Last touched: 2026-07-17
- Next action: Read [[02_Phases/Phase_08_citation_backed_reports_and_durable_findings/Steps/Step_02_implement-citation-validation-and-provenance-graph/Execution_Brief|Execution Brief]] and [[02_Phases/Phase_08_citation_backed_reports_and_durable_findings/Steps/Step_02_implement-citation-validation-and-provenance-graph/Validation_Plan|Validation Plan]], then confirm the first bounded change against the dependency chain.
<!-- AGENT-END:step-agent-managed-snapshot -->

## Human Notes

- Keep this step narrow and explicit; planned paths may not exist yet and should be created only when execution begins.
- Refined 2026-07-20 in [[05_Sessions/2026-07-20-162818-define-findings-reports-citation-states-and-lifecycle-phase-08-refinement-worker|the Phase 08 refinement session]]. Reuse existing citation/projection/opening paths to validate typed provenance edges; no graph database, silent retargeting, report UI, export, or Fred scope.

## Session History

<!-- AGENT-START:step-session-history -->
- 2026-07-20 - [[05_Sessions/2026-07-20-170450-implement-citation-validation-and-provenance-graph-citation-provenance-validation|SESSION-2026-07-20-170450 citation-provenance-validation session for Implement Citation Validation and Provenance Graph]] - Session created.
<!-- AGENT-END:step-session-history -->

## Related Notes

- [[07_Templates/Note_Contracts|Note Contracts]]
- [[07_Templates/Phase_Template|Phase Template]]
