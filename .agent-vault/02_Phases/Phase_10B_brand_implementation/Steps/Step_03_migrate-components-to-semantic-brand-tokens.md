---
note_type: step
template_version: 2
contract_version: 1
title: Migrate Components to Semantic Brand Tokens
step_id: STEP-10B-03
phase: '[[02_Phases/Phase_10B_brand_implementation/Phase|PHASE-10B Brand Implementation]]'
status: planned
owner: ''
created: '2026-07-26'
updated: '2026-07-26'
depends_on:
  - '[[02_Phases/Phase_10B_brand_implementation/Steps/Step_01_integrate-brand-theme-tokens-and-typography|STEP-10B-01]]'
  - '[[02_Phases/Phase_10B_brand_implementation/Steps/Step_02_add-brand-svg-assets-and-logo-placement|STEP-10B-02]]'
related_sessions: []
related_bugs: []
related_notes:
  - '[[01_Architecture/System_Overview|System Overview]]'
  - '[[01_Architecture/Code_Map|Code Map]]'
tags:
  - agent-vault
  - step
---

# Step 03 - Migrate Components to Semantic Brand Tokens

Use this note as a thin index for one executable step. Keep detail in companion notes so execution can load only the smallest note needed.

## Purpose

- Outcome: All component surfaces use brand semantic tokens where DaisyUI tokens are insufficient. The workspace shell, navigation, conversation panel, evidence inspector, source catalog, report editor, notebook, and notes components render with brand-correct colors, typography, radii, and shadows in both light and dark modes.
- Parent phase: [[02_Phases/Phase_10B_brand_implementation/Phase|PHASE-10B Brand Implementation]].
- Sequencing: start after [[02_Phases/Phase_10B_brand_implementation/Steps/Step_02_add-brand-svg-assets-and-logo-placement|STEP-10B-02]] is complete.

## Required Reading

- [[02_Phases/Phase_10B_brand_implementation/Phase|PHASE-10B Brand Implementation]]
- [[01_Architecture/System_Overview|System Overview]]
- [[01_Architecture/Code_Map|Code Map]]
- `.brand/STRUCT_BRAND_IMPLEMENTATION.md` sections 6 (shape, spacing, depth), 7 (component language)
- `.brand/struct-brand-tokens.json` — complete token reference
- All component files in `apps/web/src/components/` and `apps/web/src/pages/`

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
- Next action: Migrate component surfaces from DaisyUI base colors to brand semantic tokens, update typography hierarchy, and apply brand radii and shadows.
<!-- AGENT-END:step-agent-managed-snapshot -->

## Human Notes

- Preserve DaisyUI component classes (`btn`, `menu`, `input`, `card`, etc.) — only change the color/typography/radius values that feed into them.
- Components using opacity modifiers (e.g., `text-base-content/60`) should become `text-muted` or `text-subtle`.
- The codebase currently has zero raw hex values in components — this must remain true.

## Session History

<!-- AGENT-START:step-session-history -->
- No sessions yet.
<!-- AGENT-END:step-session-history -->
