---
note_type: step
template_version: 2
contract_version: 1
title: Validate Build Tests and Visual Regression
step_id: STEP-10B-04
phase: '[[02_Phases/Phase_10B_brand_implementation/Phase|PHASE-10B Brand Implementation]]'
status: planned
owner: ''
created: '2026-07-26'
updated: '2026-07-26'
depends_on:
  - '[[02_Phases/Phase_10B_brand_implementation/Steps/Step_03_migrate-components-to-semantic-brand-tokens|STEP-10B-03]]'
related_sessions: []
related_bugs: []
related_notes:
  - '[[01_Architecture/System_Overview|System Overview]]'
  - '[[01_Architecture/Code_Map|Code Map]]'
tags:
  - agent-vault
  - step
---

# Step 04 - Validate Build Tests and Visual Regression

Use this note as a thin index for one executable step. Keep detail in companion notes so execution can load only the smallest note needed.

## Purpose

- Outcome: The full repository passes all gates (lint, typecheck, unit tests, e2e tests, production build). Both light and dark modes render correctly across representative pages. The brand implementation meets all acceptance criteria from the phase note.
- Parent phase: [[02_Phases/Phase_10B_brand_implementation/Phase|PHASE-10B Brand Implementation]].
- Sequencing: start after [[02_Phases/Phase_10B_brand_implementation/Steps/Step_03_migrate-components-to-semantic-brand-tokens|STEP-10B-03]] is complete.

## Required Reading

- [[02_Phases/Phase_10B_brand_implementation/Phase|PHASE-10B Brand Implementation]]
- [[01_Architecture/System_Overview|System Overview]]
- [[01_Architecture/Code_Map|Code Map]]
- `.brand/STRUCT_BRAND_IMPLEMENTATION.md` section 10 (acceptance criteria checklist)

## Companion Notes

- Execution Brief — Starting files, detailed execution steps, edge cases.
- Validation Plan — Acceptance checks, commands, regression expectations.
- Implementation Notes — Durable findings discovered while the step is being executed.
- Outcome — Final result, validation evidence, and explicit follow-up.

## Agent-Managed Snapshot

<!-- AGENT-START:step-agent-managed-snapshot -->
- Status: planned
- Current owner:
- Last touched: 2026-07-26
- Next action: Run the full gate ladder and verify brand acceptance criteria across both light and dark modes.
<!-- AGENT-END:step-agent-managed-snapshot -->

## Human Notes

- E2e tests may assert on specific CSS class names or colors — update assertions if they reference old DaisyUI color names.
- Playwright visual regression baselines will need updating after the brand change.
- Font loading may affect layout metrics — verify no text overflow or truncation regressions.

## Session History

<!-- AGENT-START:step-session-history -->
- No sessions yet.
<!-- AGENT-END:step-session-history -->
