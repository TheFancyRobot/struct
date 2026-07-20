---
note_type: step
template_version: 2
contract_version: 1
title: Normalize and Reconcile Cross-Source Evidence
step_id: STEP-07-03
phase: '[[02_Phases/Phase_07_hybrid_cross_source_research/Phase|Phase 07 hybrid cross source research]]'
status: completed
owner: ''
created: '2026-07-17'
updated: '2026-07-20'
depends_on:
  - '[[02_Phases/Phase_07_hybrid_cross_source_research/Steps/Step_02_implement-parallel-document-and-dataset-research-branches|STEP-07-02 Implement Parallel Document and Dataset Research Branches]]'
related_sessions:
  - '[[05_Sessions/2026-07-20-144908-normalize-and-reconcile-cross-source-evidence-step-07-03-worker|SESSION-2026-07-20-144908 step-07-03-worker session for Normalize and Reconcile Cross-Source Evidence]]'
related_bugs: []
tags:
  - agent-vault
  - step
context_id: SESSION-2026-07-20-144908
active_session_id: 05_Sessions/2026-07-20-144908-normalize-and-reconcile-cross-source-evidence-step-07-03-worker
context_status: completed
context_summary: Advance [[02_Phases/Phase_07_hybrid_cross_source_research/Steps/Step_03_normalize-and-reconcile-cross-source-evidence|STEP-07-03 Normalize and Reconcile Cross-Source Evidence]].
---

# Step 03 - Normalize and Reconcile Cross-Source Evidence

Use this note as a thin index for one executable step. Keep detail in companion notes so execution can load only the smallest note needed.

## Purpose

- Outcome: Implement the smallest coherent cross-source evidence normalization and reconciliation slice while preserving quantitative exactness, qualitative provenance, contradictions, and limitations.
- Parent phase: [[02_Phases/Phase_07_hybrid_cross_source_research/Phase|Phase 07 hybrid cross source research]].
- Sequencing: start after [[02_Phases/Phase_07_hybrid_cross_source_research/Steps/Step_02_implement-parallel-document-and-dataset-research-branches|STEP-07-02 Implement Parallel Document and Dataset Research Branches]] has a stable outcome or handoff.

## Required Reading

- [[02_Phases/Phase_07_hybrid_cross_source_research/Phase|Phase 07 hybrid cross source research]]
- [[02_Phases/Phase_07_hybrid_cross_source_research/Steps/Step_03_normalize-and-reconcile-cross-source-evidence/Execution_Brief|Execution Brief]]
- [[02_Phases/Phase_07_hybrid_cross_source_research/Steps/Step_03_normalize-and-reconcile-cross-source-evidence/Validation_Plan|Validation Plan]]
- [[01_Architecture/Agent_Workflow|Agent Workflow]]
- [[01_Architecture/Domain_Model|Domain Model]]
- [[01_Architecture/System_Overview|System Overview]]

## Companion Notes

- [[02_Phases/Phase_07_hybrid_cross_source_research/Steps/Step_03_normalize-and-reconcile-cross-source-evidence/Execution_Brief|Execution Brief]] - Why the step exists, prerequisites, likely code paths, and the smallest execution checklist.
- [[02_Phases/Phase_07_hybrid_cross_source_research/Steps/Step_03_normalize-and-reconcile-cross-source-evidence/Validation_Plan|Validation Plan]] - Acceptance checks, commands, edge cases, and regression expectations.
- [[02_Phases/Phase_07_hybrid_cross_source_research/Steps/Step_03_normalize-and-reconcile-cross-source-evidence/Implementation_Notes|Implementation Notes]] - Durable findings discovered while the step is being executed.
- [[02_Phases/Phase_07_hybrid_cross_source_research/Steps/Step_03_normalize-and-reconcile-cross-source-evidence/Outcome|Outcome]] - Final result, validation evidence, and explicit follow-up.

## Agent-Managed Snapshot

<!-- AGENT-START:step-agent-managed-snapshot -->
- Status: completed
- Current owner: step-07-03-worker
- Last touched: 2026-07-20
- Next action: Root orchestrator independently reviews, publishes, and merges STEP-07-03 before advancing to STEP-07-04.
<!-- AGENT-END:step-agent-managed-snapshot -->

## Human Notes

- Keep this step narrow and explicit; planned paths may not exist yet and should be created only when execution begins.
- Completed 2026-07-20: one typed lossless cross-source envelope and deterministic reconciliation boundary now preserve document, dataset-query, and recursive provenance; disclose semantic mismatches and contradictions; and fail closed for insufficient evidence, foreign lineage, or unauthorized joins.
- Validation: final step suite 9/9, full repository suite 656 pass / 164 skip / 0 fail, typecheck, lint, and import boundaries clean.

## Session History

<!-- AGENT-START:step-session-history -->
- 2026-07-20 - [[05_Sessions/2026-07-20-144908-normalize-and-reconcile-cross-source-evidence-step-07-03-worker|SESSION-2026-07-20-144908 step-07-03-worker session for Normalize and Reconcile Cross-Source Evidence]] - Session created.
<!-- AGENT-END:step-session-history -->

## Related Notes

- [[07_Templates/Note_Contracts|Note Contracts]]
- [[07_Templates/Phase_Template|Phase Template]]
