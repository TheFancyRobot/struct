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
updated: '2026-01-23'
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

- Outcome: The global stylesheet (`apps/web/src/index.css`) contains `--struct-*` brand tokens as the single source of truth, DaisyUI theme blocks reference those tokens via `var()`, and brand fonts (Inter + JetBrains Mono) are installed and wired. Both light and dark modes render brand-correct colors through the existing `data-theme` mechanism.
- No custom `@theme inline` utilities are added — DaisyUI's built-in utilities (`bg-base-100`, `text-primary`, etc.) are the only utility classes used.
- `.brand/` directory is reference-only (gitignored); values are copied manually into `index.css`, never imported.
- Parent phase: [[02_Phases/Phase_10B_brand_implementation/Phase|PHASE-10B Brand Implementation]].
- Sequencing: first step in phase; no prior dependencies.

## Required Reading

- [[02_Phases/Phase_10B_brand_implementation/Phase|PHASE-10B Brand Implementation]] — Grilling Session Decisions section
- `.brand/STRUCT_BRAND_IMPLEMENTATION.md` sections 4 (color system), 5 (typography — note: omit Space Grotesk per grilling decision)
- `.brand/struct-theme.css` — reference for `--struct-*` token values (light and dark)
- `apps/web/src/index.css` — current global stylesheet (the file being modified)
- `apps/web/src/App.tsx` — theme toggle mechanism (uses `data-theme`, no changes needed)
- `apps/web/package.json` — current font dependencies

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
- Next action: Install Inter + JetBrains Mono font packages, add `--struct-*` tokens to `:root` and `[data-theme="struct-dark"]` in `index.css`, update DaisyUI theme blocks to reference `var(--struct-*)`, update `@theme` font config, remove old font packages.
<!-- AGENT-END:step-agent-managed-snapshot -->

## Human Notes

- **Token architecture:** `:root` defines `--struct-*` tokens (single source of truth). `[data-theme="struct-dark"]` overrides them for dark mode. DaisyUI `@plugin "daisyui/theme"` blocks reference `var(--struct-*)` — DaisyUI is a consumer, not the source.
- **No custom `@theme inline` utilities:** Do not add `@theme inline { --color-surface: ... }` blocks. Use DaisyUI's built-in utilities (`bg-base-100`, `text-base-content`, `bg-primary`, etc.) only.
- **Fonts:** Install `@fontsource-variable/inter` and `@fontsource-variable/jetbrains-mono`. Remove `@fontsource-variable/manrope` and `@fontsource/ibm-plex-mono`. Omit Space Grotesk (brand spec allows this: "If the application must minimize font payload, keep Inter and JetBrains Mono, use the SVG wordmark, and omit Space Grotesk").
- **Dark mode:** Already using `data-theme` attribute via `App.tsx` (`document.documentElement.dataset.theme`). No `.dark` class selector. No changes to the toggle mechanism.
- **`.brand/` is reference-only:** Gitignored, never imported. Copy token values manually from `.brand/struct-theme.css` into `index.css`.
- **DaisyUI theme block structure:** Keep `@plugin "daisyui"` with `themes: false`, then define `@plugin "daisyui/theme"` blocks for `struct-light` (default) and `struct-dark`. Replace hardcoded hex values with `var(--struct-*)` references.
- **Font config:** Update the existing `@theme { --font-sans: ...; --font-mono: ... }` block to use Inter and JetBrains Mono.

## Session History

<!-- AGENT-START:step-session-history -->
- No sessions yet.
<!-- AGENT-END:step-session-history -->
