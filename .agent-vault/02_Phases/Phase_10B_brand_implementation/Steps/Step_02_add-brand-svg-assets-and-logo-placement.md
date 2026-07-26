---
note_type: step
template_version: 2
contract_version: 1
title: Add Brand SVG Assets and Logo Placement
step_id: STEP-10B-02
phase: '[[02_Phases/Phase_10B_brand_implementation/Phase|PHASE-10B Brand Implementation]]'
status: planned
owner: ''
created: '2026-07-26'
updated: '2026-07-26'
depends_on:
  - '[[02_Phases/Phase_10B_brand_implementation/Steps/Step_01_integrate-brand-theme-tokens-and-typography|STEP-10B-01]]'
related_sessions: []
related_bugs: []
related_notes:
  - '[[01_Architecture/System_Overview|System Overview]]'
  - '[[01_Architecture/Code_Map|Code Map]]'
tags:
  - agent-vault
  - step
---

# Step 02 - Add Brand SVG Assets and Logo Placement

Use this note as a thin index for one executable step. Keep detail in companion notes so execution can load only the smallest note needed.

## Purpose

- Outcome: All 18 brand SVG assets are available to the application. The compact lockup appears in the top-left corner of the workspace navigation, switching between on-light and on-dark variants based on the active theme. The favicon is updated to `struct-favicon.svg`.
- Parent phase: [[02_Phases/Phase_10B_brand_implementation/Phase|PHASE-10B Brand Implementation]].
- Sequencing: start after [[02_Phases/Phase_10B_brand_implementation/Steps/Step_01_integrate-brand-theme-tokens-and-typography|STEP-10B-01]] is complete.

## Required Reading

- [[02_Phases/Phase_10B_brand_implementation/Phase|PHASE-10B Brand Implementation]]
- [[01_Architecture/System_Overview|System Overview]]
- [[01_Architecture/Code_Map|Code Map]]
- `.brand/STRUCT_BRAND_IMPLEMENTATION.md` sections 3 (asset inventory and usage), 7 (component language — application shell)
- `apps/web/src/components/workspace/WorkspaceShell.tsx` — `WorkspaceNavigation` component
- `apps/web/src/App.tsx` — theme signal

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
- Next action: Copy SVG assets to the app, create the logo component, and integrate it into the workspace navigation header.
<!-- AGENT-END:step-agent-managed-snapshot -->

## Human Notes

- The compact lockup must fit within the 256px (w-64) sidebar width.
- When navigation is collapsed, the logo may need to be hidden or reduced to the standalone icon.
- SVG assets served as static files should use direct `<img>` tags; inline SVG components should expose one accessible name.

## Session History

<!-- AGENT-START:step-session-history -->
- No sessions yet.
<!-- AGENT-END:step-session-history -->
