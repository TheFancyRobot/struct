---
note_type: step
template_version: 2
contract_version: 1
title: Add Durable User Notes with Provenance
step_id: STEP-10-06
phase: '[[02_Phases/Phase_10_v1_usable_research_workspace/Phase|Phase 10 v1 usable research workspace]]'
status: completed
owner: OpenAI Codex GPT-5.6-sol
created: '2026-07-21'
updated: '2026-07-26'
depends_on:
  - '[[02_Phases/Phase_10_v1_usable_research_workspace/Steps/Step_05_integrate-exact-evidence-inspector|STEP-10-05 Integrate Exact Evidence Inspector]]'
related_sessions:
  - '[[05_Sessions/2026-07-23-145006-add-durable-user-notes-with-provenance-openai-codex-gpt-5-6-sol-required-gpt-5-4-unavailable|SESSION-2026-07-23-145006 openai-codex/gpt-5.6-sol (required gpt-5.4 unavailable) session for Add Durable User Notes with Provenance]]'
related_bugs:
  - '[[03_Bugs/BUG-0013_v1-ui-lacks-core-research-workflows|BUG-0013 v1 UI lacks core research workflows]]'
tags:
  - agent-vault
  - step
context_id: SESSION-2026-07-23-145006
active_session_id: 05_Sessions/2026-07-23-145006-add-durable-user-notes-with-provenance-openai-codex-gpt-5-6-sol-required-gpt-5-4-unavailable
context_status: completed
context_summary: Implemented durable notes with exact answer and recursive-result provenance, revision-safe archive/update behavior, and recovery controls.
---

# Step 06 - Add Durable User Notes with Provenance

Use this note as a thin index for one executable step. Keep detail in companion notes so execution can load only the smallest note needed.

## Purpose

- Outcome: Add Durable User Notes with Provenance.
- Parent phase: [[02_Phases/Phase_10_v1_usable_research_workspace/Phase|Phase 10 v1 usable research workspace]].
- Exact outcome: users can save an answer as a first-class editable note, preserve originating evidence, reload it, and reopen its citations.

## Required Reading

- [[02_Phases/Phase_10_v1_usable_research_workspace/Phase|Phase 10 v1 usable research workspace]]
- [[02_Phases/Phase_10_v1_usable_research_workspace/Steps/Step_06_add-durable-user-notes-with-provenance/Execution_Brief|Execution Brief]]
- [[02_Phases/Phase_10_v1_usable_research_workspace/Steps/Step_06_add-durable-user-notes-with-provenance/Validation_Plan|Validation Plan]]
- `docs/superpowers/specs/2026-07-21-unified-research-workspace-design.md`
- `docs/superpowers/plans/2026-07-21-unified-research-workspace-implementation.md`
- [[03_Bugs/BUG-0013_v1-ui-lacks-core-research-workflows|BUG-0013 v1 UI lacks core research workflows]]
- [[01_Architecture/Domain_Model|Domain Model]]
- [[01_Architecture/System_Overview|System Overview]]

## Companion Notes

- [[02_Phases/Phase_10_v1_usable_research_workspace/Steps/Step_06_add-durable-user-notes-with-provenance/Execution_Brief|Execution Brief]] - Why the step exists, prerequisites, likely code paths, and the smallest execution checklist.
- [[02_Phases/Phase_10_v1_usable_research_workspace/Steps/Step_06_add-durable-user-notes-with-provenance/Validation_Plan|Validation Plan]] - Acceptance checks, commands, edge cases, and regression expectations.
- [[02_Phases/Phase_10_v1_usable_research_workspace/Steps/Step_06_add-durable-user-notes-with-provenance/Implementation_Notes|Implementation Notes]] - Durable findings discovered while the step is being executed.
- [[02_Phases/Phase_10_v1_usable_research_workspace/Steps/Step_06_add-durable-user-notes-with-provenance/Outcome|Outcome]] - Final result, validation evidence, and explicit follow-up.

## Agent-Managed Snapshot

<!-- AGENT-START:step-agent-managed-snapshot -->
- Status: completed
- Current owner: OpenAI Codex GPT-5.6-sol
- Last touched: 2026-07-26
- Next action: Root orchestration may advance after review and merge.
<!-- AGENT-END:step-agent-managed-snapshot -->

## Human Notes

- Refinement passed on 2026-07-21. Notes coexist with Findings/Reports and retain immutable origin provenance across editable revisions.
- 2026-07-26 execution: completed-answer durable notes now retain exact answer-event identity and immutable citations, paginate notes/revisions deterministically, serialize archive/update state changes, and preserve dirty editor drafts with explicit retry/conflict-copy recovery. Focused tests, typecheck, lint, and web build pass. Recursive durable-partial Save-as-note remains blocked on a canonical answer/body projection because the current durable result contract exposes a finding collection, not an answer.

## Session History

<!-- AGENT-START:step-session-history -->
- 2026-07-23 - [[05_Sessions/2026-07-23-145006-add-durable-user-notes-with-provenance-openai-codex-gpt-5-6-sol-required-gpt-5-4-unavailable|SESSION-2026-07-23-145006 openai-codex/gpt-5.6-sol (required gpt-5.4 unavailable) session for Add Durable User Notes with Provenance]] - Session created.
<!-- AGENT-END:step-session-history -->

## Related Notes

- [[07_Templates/Note_Contracts|Note Contracts]]
- [[07_Templates/Phase_Template|Phase Template]]
