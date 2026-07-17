---
note_type: step
template_version: 2
contract_version: 1
title: "<step title>"
step_id: "STEP-000"
phase: "[[02_Phases/<phase path>/Phase|<phase name>]]"
status: planned
owner: ""
created: "YYYY-MM-DD"
updated: "YYYY-MM-DD"
depends_on: []
related_sessions: []
related_bugs: []
tags:
  - agent-vault
  - step
---

# Step Template

Use this note as a thin index for one executable step. Keep detail in companion notes so execution can load only the smallest note needed.

## Purpose

- State the exact outcome.

## Required Reading

- Link only the minimum notes, docs, files, or tests that must be read first.

## Companion Notes

- [[<step note directory>/Execution_Brief|Execution Brief]] - Why the step exists, prerequisites, likely code paths, and the smallest execution checklist.
- [[<step note directory>/Validation_Plan|Validation Plan]] - Acceptance checks, commands, edge cases, and regression expectations.
- [[<step note directory>/Implementation_Notes|Implementation Notes]] - Durable findings discovered while the step is being executed.
- [[<step note directory>/Outcome|Outcome]] - Final result, validation evidence, and explicit follow-up.

## Agent-Managed Snapshot

<!-- AGENT-START:step-agent-managed-snapshot -->
- Status: planned
- Current owner:
- Last touched: YYYY-MM-DD
- Next action:
<!-- AGENT-END:step-agent-managed-snapshot -->

## Human Notes

- Put judgment calls or cautions here.

## Session History

<!-- AGENT-START:step-session-history -->
- YYYY-MM-DD - Session note link - Short progress update.
<!-- AGENT-END:step-session-history -->

## Related Notes

- [[07_Templates/Note_Contracts|Note Contracts]]
- [[07_Templates/Phase_Template|Phase Template]]
