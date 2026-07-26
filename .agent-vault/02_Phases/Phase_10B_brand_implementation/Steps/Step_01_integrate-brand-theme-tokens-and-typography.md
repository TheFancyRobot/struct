---
note_type: step
template_version: 2
contract_version: 1
title: Integrate Brand Theme Tokens and Typography
step_id: STEP-10B-01
phase: '[[02_Phases/Phase_10B_brand_implementation/Phase|PHASE-10B Brand Implementation]]'
status: planned
owner: ''
created: '2026-07-26'
updated: '2026-07-26'
depends_on: []
related_sessions: []
related_bugs: []
related_notes:
  - '[[01_Architecture/System_Overview|System Overview]]'
  - '[[01_Architecture/Code_Map|Code Map]]'
tags:
  - agent-vault
  - step
---

# Step 01 - Integrate Brand Theme Tokens and Typography

Use this note as a thin index for one executable step. Keep detail in companion notes so execution can load only the smallest note needed.

## Purpose

- Outcome: The global stylesheet contains the brand's CSS custom properties, Tailwind v4 `@theme inline` mappings, and brand font declarations. The existing DaisyUI theme values are updated to match the brand palette. Both light and dark modes render brand-correct colors through the existing `data-theme` mechanism.
- Parent phase: [[02_Phases/Phase_10B_brand_implementation/Phase|PHASE-10B Brand Implementation]].
- Sequencing: first step in phase; no prior dependencies.

## Required Reading

- [[02_Phases/Phase_10B_brand_implementation/Phase|PHASE-10B Brand Implementation]]
- [[01_Architecture/System_Overview|System Overview]]
- [[01_Architecture/Code_Map|Code Map]]
- `.brand/STRUCT_BRAND_IMPLEMENTATION.md` sections 4 (color system), 5 (typography), 8 (Tailwind CSS v4 integration)
- `.brand/struct-theme.css` — full file
- `apps/web/src/index.css` — current global stylesheet
- `apps/web/src/App.tsx` — theme toggle mechanism

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
- Next action: Read the execution brief and validation plan, then integrate brand CSS variables, Tailwind v4 theme mappings, and brand fonts into `apps/web/src/index.css`.
<!-- AGENT-END:step-agent-managed-snapshot -->

## Human Notes

- The brand's `.dark` selector must be adapted to `[data-theme="struct-dark"]` to match the existing DaisyUI theme toggle.
- Font packages: replace `@fontsource-variable/manrope` and `@fontsource/ibm-plex-mono` with `@fontsource-variable/inter`, `@fontsource-variable/space-grotesk`, `@fontsource-variable/jetbrains-mono`.
- DaisyUI theme values must be updated to match the brand palette while preserving the `@plugin "daisyui/theme"` structure.

## Session History

<!-- AGENT-START:step-session-history -->
- No sessions yet.
<!-- AGENT-END:step-session-history -->
