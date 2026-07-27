---
note_type: step
template_version: 2
contract_version: 1
title: Migrate Components to Semantic Brand Tokens
step_id: STEP-10B-03
phase: '[[02_Phases/Phase_10B_brand_implementation/Phase|PHASE-10B Brand Implementation]]'
status: completed
owner: ''
created: '2026-07-26'
updated: '2026-07-27'
depends_on:
  - '[[02_Phases/Phase_10B_brand_implementation/Steps/Step_01_integrate-brand-theme-tokens-and-typography|STEP-10B-01]]'
  - '[[02_Phases/Phase_10B_brand_implementation/Steps/Step_02_add-brand-svg-assets-and-logo-placement|STEP-10B-02]]'
related_sessions:
  - '[[05_Sessions/2026-07-27-002920-migrate-components-to-semantic-brand-tokens-step-10b-03|SESSION-2026-07-27-002920 step-10b-03 session for Migrate Components to Semantic Brand Tokens]]'
related_bugs: []
related_notes:
  - '[[01_Architecture/System_Overview|System Overview]]'
  - '[[01_Architecture/Code_Map|Code Map]]'
tags:
  - agent-vault
  - step
context_id: SESSION-2026-07-27-002920
active_session_id: 05_Sessions/2026-07-27-002920-migrate-components-to-semantic-brand-tokens-step-10b-03
context_status: active
context_summary: Advance [[02_Phases/Phase_10B_brand_implementation/Steps/Step_03_migrate-components-to-semantic-brand-tokens|STEP-10B-03 Migrate Components to Semantic Brand Tokens]].
---

# Step 03 - Migrate Components to Semantic Brand Tokens

Use this note as a thin index for one executable step. Keep detail in companion notes so execution can load only the smallest note needed.

## Purpose

- Outcome: Audit confirms all component surfaces use DaisyUI semantic classes (`bg-base-100`, `text-primary`, `text-base-content/60`, etc.). No hardcoded Tailwind colors (`bg-blue-600`, `text-gray-500`) remain. Any gaps found during the audit are migrated to DaisyUI semantic classes.
- This step is primarily an audit-and-fix pass. The codebase currently has zero raw hex colors and already uses DaisyUI semantic classes — the audit verifies this remains true after Steps 1-2 and fixes any exceptions.
- No custom brand utilities (`bg-surface`, `text-foreground`) are introduced. DaisyUI utilities are the only utility classes.
- Parent phase: [[02_Phases/Phase_10B_brand_implementation/Phase|PHASE-10B Brand Implementation]].
- Sequencing: start after [[02_Phases/Phase_10B_brand_implementation/Steps/Step_02_add-brand-svg-assets-and-logo-placement|STEP-10B-02]] is complete.

## Required Reading

- [[02_Phases/Phase_10B_brand_implementation/Phase|PHASE-10B Brand Implementation]] — Grilling Session Decisions section
- `.brand/STRUCT_BRAND_IMPLEMENTATION.md` section 10 (acceptance criteria checklist)
- All component files in `apps/web/src/components/` and `apps/web/src/pages/` (audit targets)

## Companion Notes

- Execution Brief — Starting files, detailed execution steps, edge cases.
- Validation Plan — Acceptance checks, commands, regression expectations.
- Implementation Notes — Durable findings discovered while the step is being executed.
- Outcome — Final result, validation evidence, and explicit follow-up.

## Agent-Managed Snapshot

<!-- AGENT-START:step-agent-managed-snapshot -->
- Status: done
- Current owner: step-10b-03
- Last touched: 2026-07-27
- Next action: None. Audit confirmed zero hardcoded Tailwind palette colors and zero unexplained hex in ordinary product components; no migration needed. Full build/test/visual-regression validation is STEP-10B-04.
<!-- AGENT-END:step-agent-managed-snapshot -->

## Human Notes

- **DaisyUI utilities only:** Do not introduce `bg-surface`, `text-foreground`, `bg-background`, `text-muted`, `text-subtle`, `rounded-card`, `shadow-card`, or any custom brand utilities. Use DaisyUI's existing utilities (`bg-base-100`, `text-base-content`, `bg-primary`, `rounded-box`, etc.) only.
- **Opacity modifiers stay:** `text-base-content/60` is the correct DaisyUI pattern for muted text. Do not replace it with custom `text-muted`.
- **Audit scope:** `grep -rn '#[0-9a-fA-F]\{3,8\}' apps/web/src --include="*.tsx"` for hex colors. `grep -rn 'bg-blue\|bg-red\|bg-green\|text-gray\|text-slate\|border-gray' apps/web/src --include="*.tsx"` for hardcoded Tailwind colors. The codebase currently passes both checks — the audit verifies this remains true.
- **Incremental migration:** If the audit finds exceptions, migrate them one file at a time. No batch rewrite.
- **Preserve DaisyUI component classes:** `btn`, `menu`, `input`, `card`, etc. stay as-is. Only color/typography utility classes are subject to migration.

## Session History

<!-- AGENT-START:step-session-history -->
- 2026-07-27 - [[05_Sessions/2026-07-27-002920-migrate-components-to-semantic-brand-tokens-step-10b-03|SESSION-2026-07-27-002920 step-10b-03 session for Migrate Components to Semantic Brand Tokens]] - Session created.
- 2026-07-27 — step-10b-03: Audit complete. Scanned all 40 .tsx files in components/ and pages/. Zero hardcoded Tailwind palette colors; zero unexplained hex in ordinary components. Hex in icons/index.tsx is intentional brand-mark artwork matching .brand/. bg-neutral/text-neutral-content are DaisyUI semantic classes. No code changes required.
<!-- AGENT-END:step-session-history -->
