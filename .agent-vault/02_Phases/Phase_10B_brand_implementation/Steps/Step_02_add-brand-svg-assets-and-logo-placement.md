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

- Outcome: Inline SVG React components for all 18 brand assets exist in `apps/web/src/components/icons/`. The compact lockup appears in the top-left corner of the workspace navigation, switching between on-light and on-dark variants using `currentColor`. The favicon is updated to `struct-favicon.svg`.
- SVGs are inline components (not static files in `public/`). All other assets (fonts) remain bundled via `@fontsource`.
- `.brand/` is reference-only (gitignored); SVG content is copied into component files manually.
- Parent phase: [[02_Phases/Phase_10B_brand_implementation/Phase|PHASE-10B Brand Implementation]].
- Sequencing: start after [[02_Phases/Phase_10B_brand_implementation/Steps/Step_01_integrate-brand-theme-tokens-and-typography|STEP-10B-01]] is complete.

## Required Reading

- [[02_Phases/Phase_10B_brand_implementation/Phase|PHASE-10B Brand Implementation]] — Grilling Session Decisions section
- `.brand/STRUCT_BRAND_IMPLEMENTATION.md` sections 3 (asset inventory and usage), 7 (component language — application shell)
- `.brand/assets/svg/` — all 18 SVG files (reference source for inline components)
- `apps/web/src/components/workspace/WorkspaceShell.tsx` — `WorkspaceNavigation` component (where logo is placed)
- `apps/web/src/App.tsx` — theme signal (`theme()` returns `'struct-light'` or `'struct-dark'`)
- `apps/web/index.html` — favicon link must be added here

## Companion Notes

- Execution Brief — Starting files, detailed execution steps, edge cases.
- Validation Plan — Acceptance checks, commands, regression expectations.
- Implementation Notes — Durable findings discovered while the step is being executed.
- Outcome — Final result, validation evidence, and explicit follow-up.

## Agent-Managed Snapshot

<!-- AGENT-START:step-agent-managed-snapshot -->
- Status: planned
- Current owner:
- Last touched: 2026-01-23
- Next action: Create inline SVG SolidJS components for all 18 brand assets in `apps/web/src/components/icons/`, add the compact lockup to `WorkspaceShell.tsx` navigation, add favicon link to `index.html`.
<!-- AGENT-END:step-agent-managed-snapshot -->

## Human Notes

- **Inline SVG components:** All 18 SVGs become SolidJS components in `apps/web/src/components/icons/`. Not static files. Not `<img>` tags.
- **Theme-aware coloring:** Use `currentColor` (e.g., `fill="currentColor"` or `stroke="currentColor"`) so the SVG adapts to the parent's `color` CSS property. One component per asset, no conditional rendering for light/dark.
- **Favicon:** Add `<link rel="icon" href="/struct-favicon.svg" />` to `apps/web/index.html`. Copy `struct-favicon.svg` to `apps/web/public/` (favicon is the one exception to the inline rule — it must be a static file for the browser to load it).
- **Compact lockup:** Must fit within the 256px (w-64) sidebar width. When navigation is collapsed, the logo may need to be hidden or reduced to the standalone icon.
- **Accessibility:** A lockup that identifies the product should use `alt="Struct"` (or `aria-label` for inline SVG). A standalone icon adjacent to visible "Struct" text is decorative and should use `aria-hidden="true"`.
- **Wordmark:** The wordmark is vector geometry. Never recreate it as text or approximate it with a font.

## Session History

<!-- AGENT-START:step-session-history -->
- No sessions yet.
<!-- AGENT-END:step-session-history -->
