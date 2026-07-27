---
note_type: phase
template_version: 2
contract_version: 1
title: Brand Implementation
phase_id: PHASE-10B
status: completed
owner: ''
created: '2026-07-26'
updated: '2026-07-27'
depends_on:
  - '[[02_Phases/Phase_10_v1_usable_research_workspace/Phase|PHASE-10 v1 Usable Research Workspace]]'
related_architecture:
  - '[[01_Architecture/System_Overview|System Overview]]'
  - '[[01_Architecture/Code_Map|Code Map]]'
related_decisions:
  - '[[04_Decisions/DEC-0013_use-tailwind-css-and-daisyui-with-a-custom-theme-for-frontend-styling|DEC-0013 Use Tailwind CSS and DaisyUI with a Custom Theme for Frontend Styling]]'
  - '[[04_Decisions/DEC-0014_use-solidjs-vite-8-and-solid-router-for-frontend-runtime|DEC-0014 Use SolidJS Vite 8 and Solid Router for Frontend Runtime]]'
related_bugs:
  - '[[03_Bugs/BUG-0053_pre-existing-e2e-infra-defects-surface-as-failures-independent-of-brand-phase|BUG-0053 Pre-existing e2e infra defects surface as failures independent of brand phase]]'
tags:
  - agent-vault
  - phase
  - brand
---

# Phase 10B Brand Implementation

Use this note for a bounded phase. Keep it focused, link outward, and avoid duplicating durable detail from architecture, bug, or decision notes. See [[07_Templates/Note_Contracts|Note Contracts]].

## Objective

- Apply the Struct visual identity from `.brand/` to the existing application.
- Replace placeholder typography, integrate brand color tokens into the Tailwind v4 + DaisyUI theme, place the official logo in the top-left corner, and ensure all product surfaces use semantic brand tokens in both light and dark modes.

## Why This Phase Exists

- The `.brand/` directory contains a complete brand package (SVG assets, tokens, theme CSS, implementation spec) that has not yet been applied to the running application.
- Phase 10 established the workspace shell with DaisyUI themes and Manrope/IBM Plex Mono fonts; this phase upgrades those to the authoritative brand spec.
- This phase is logically inserted between [[02_Phases/Phase_10_v1_usable_research_workspace/Phase|PHASE-10 v1 Usable Research Workspace]] and [[02_Phases/Phase_11_v1_1_research_usability/Phase|PHASE-11 v1.1 Research Usability]].

## Scope

- Add `--struct-*` brand tokens to `:root` and `[data-theme="struct-dark"]` in `apps/web/src/index.css` as the single source of truth.
- Update DaisyUI `@plugin "daisyui/theme"` blocks to reference `var(--struct-*)` instead of hardcoded hex values.
- Replace Manrope Variable and IBM Plex Mono with Inter (interface) and JetBrains Mono (code/structured data). Omit Space Grotesk per grilling decision.
- Create inline SVG SolidJS components for all 18 brand assets in `apps/web/src/components/icons/`.
- Place the compact lockup in the top-left corner of the workspace navigation using `currentColor` for theme-aware coloring.
- Update the favicon to `struct-favicon.svg` (static file in `apps/web/public/`).
- Audit component surfaces for hardcoded colors and migrate any exceptions to DaisyUI semantic classes.
- Add visual regression test coverage using the existing `page.screenshot()` e2e pattern.
- No custom `@theme inline` utilities (`bg-surface`, `text-foreground`, etc.). DaisyUI built-in utilities only.

## Non-Goals

- Rewriting product logic, information architecture, or component behavior.
- Removing DaisyUI component classes (`btn`, `menu`, `input`, `card`, etc.) — DaisyUI is retained as the component library.
- Introducing a parallel design system or new component primitives.
- Changing the existing dark-mode toggle mechanism (`data-theme` attribute).
- Applying brand colors to data visualization palettes (future phase).

## Dependencies

- Depends on [[02_Phases/Phase_10_v1_usable_research_workspace/Phase|PHASE-10 v1 Usable Research Workspace]] (the workspace shell, DaisyUI themes, and theme toggle mechanism).
- The brand package at `.brand/` is complete and authoritative.
- [[04_Decisions/DEC-0013_use-tailwind-css-and-daisyui-with-a-custom-theme-for-frontend-styling|DEC-0013]] governs the styling architecture.

## Acceptance Criteria

- [ ] The official Struct symbol and custom wordmark are used from SVG assets — never approximated with a font.
- [ ] The compact lockup appears in the top-left corner of the workspace navigation, switching on-light/on-dark by active theme.
- [ ] The favicon is updated to `struct-favicon.svg`.
- [ ] Global colors are semantic and support both light and dark modes through the existing `data-theme` mechanism.
- [ ] No ordinary product component contains unexplained raw hex values (the codebase currently has none — this must remain true).
- [ ] Inter is the interface font; JetBrains Mono is the code/structured-data font. Space Grotesk is omitted.
- [ ] DaisyUI theme values match the brand palette in both modes via `var(--struct-*)` references.
- [ ] DaisyUI built-in utilities (`bg-base-100`, `text-primary`, etc.) are the only utility classes. No custom `bg-surface`, `text-foreground`, etc.
- [ ] Focus-visible states remain obvious and consistent.
- [ ] Dark mode uses navy/slate surfaces (not pure black) and remains readable.
- [ ] Responsive behavior is unchanged or improved.
- [ ] Existing tests pass and the production build succeeds.
- [ ] No product logic was changed solely for visual migration.

## Linear Context

<!-- AGENT-START:phase-linear-context -->
- Previous phase: [[02_Phases/Phase_10_v1_usable_research_workspace/Phase|PHASE-10 v1 Usable Research Workspace]]
- Current phase status: planned
- Next phase: [[02_Phases/Phase_11_v1_1_research_usability/Phase|PHASE-11 v1.1 Research Usability]]
<!-- AGENT-END:phase-linear-context -->

## Related Architecture

<!-- AGENT-START:phase-related-architecture -->
- [[01_Architecture/System_Overview|System Overview]]
- [[01_Architecture/Code_Map|Code Map]]
<!-- AGENT-END:phase-related-architecture -->

## Related Decisions

<!-- AGENT-START:phase-related-decisions -->
- [[04_Decisions/DEC-0013_use-tailwind-css-and-daisyui-with-a-custom-theme-for-frontend-styling|DEC-0013 Use Tailwind CSS and DaisyUI with a Custom Theme for Frontend Styling]]
- [[04_Decisions/DEC-0014_use-solidjs-vite-8-and-solid-router-for-frontend-runtime|DEC-0014 Use SolidJS Vite 8 and Solid Router for Frontend Runtime]]
<!-- AGENT-END:phase-related-decisions -->

## Related Bugs

<!-- AGENT-START:phase-related-bugs -->
- No phase-specific bugs.
- [[03_Bugs/BUG-0053_pre-existing-e2e-infra-defects-surface-as-failures-independent-of-brand-phase|BUG-0053 Pre-existing e2e infra defects surface as failures independent of brand phase]]
<!-- AGENT-END:phase-related-bugs -->

## Steps

<!-- AGENT-START:phase-steps -->
- [ ] [[02_Phases/Phase_10B_brand_implementation/Steps/Step_01_integrate-brand-theme-tokens-and-typography|STEP-10B-01 Integrate Brand Theme Tokens and Typography]]
- [ ] [[02_Phases/Phase_10B_brand_implementation/Steps/Step_02_add-brand-svg-assets-and-logo-placement|STEP-10B-02 Add Brand SVG Assets and Logo Placement]]
- [ ] [[02_Phases/Phase_10B_brand_implementation/Steps/Step_03_migrate-components-to-semantic-brand-tokens|STEP-10B-03 Migrate Components to Semantic Brand Tokens]]
- [ ] [[02_Phases/Phase_10B_brand_implementation/Steps/Step_04_validate-build-tests-and-visual-regression|STEP-10B-04 Validate Build Tests and Visual Regression]]
<!-- AGENT-END:phase-steps -->

## Notes

- The `.brand/STRUCT_BRAND_IMPLEMENTATION.md` is the authoritative usage guide.
- The `.brand/struct-theme.css` is the authoritative Tailwind v4 token source.
- The `.brand/struct-brand-tokens.json` is the machine-readable token source.
- The existing codebase has zero raw hex colors in components — a strong foundation the migration must preserve.
- The brand theme CSS `@custom-variant dark (&:where(.dark, .dark *))` must be adapted to the existing `[data-theme="struct-dark"]` selector to avoid maintaining two independent theme states.
- Font loading should use `@fontsource` packages consistent with the existing strategy (`@fontsource-variable/manrope`, `@fontsource/ibm-plex-mono` currently installed).
- The wordmark is vector geometry and has no font dependency. Do not recreate it as text.

## Grilling Session Decisions (2026-01-23)

**Token Architecture:**
- `:root` defines `--struct-*` tokens (single source of truth)
- `[data-theme="struct-dark"]` overrides `--struct-*` for dark mode
- `@plugin "daisyui/theme"` blocks reference `var(--struct-*)` (DaisyUI is consumer, not source)
- Use DaisyUI utilities only (`bg-base-100`, `text-primary`), no custom `@theme inline` utilities
- `.brand/` directory is reference-only, not imported into app code

**Typography:**
- Switch from Manrope/IBM Plex Mono → Inter/JetBrains Mono
- Install `@fontsource-variable/inter` and `@fontsource-variable/jetbrains-mono`
- Update `@theme` block in `apps/web/src/index.css`

**Dark Mode:**
- Use `data-theme` attribute (already implemented in `WorkspaceShell.tsx`)
- No `.dark` class selector

**SVG Assets (Step 2):**
- Inline SVG components in `apps/web/src/components/icons/`
- Use `currentColor` for theme-aware coloring
- No static asset serving

**Step 3 Scope:**
- Replace hardcoded Tailwind colors (`bg-blue-600`, `text-gray-500`) with DaisyUI semantic classes (`bg-primary`, `text-base-content/60`)
- Audit for scope, migrate incrementally

**Step 4 Validation:**
- Full gate: `bun run build && bun test && bunx playwright test`
- Add visual regression tests (Playwright `toHaveScreenshot()`) for critical components
