---
note_type: bug
template_version: 2
contract_version: 1
title: Frontend loads DaisyUI but bypasses its component framework
bug_id: BUG-0012
status: fixed
severity: sev-3
category: logic
reported_on: '2026-07-21'
fixed_on: '2026-07-21'
owner: Codex
created: '2026-07-21'
updated: '2026-07-21'
related_notes:
  - '[[02_Phases/Phase_09_v1_production_hardening_and_release/Phase|PHASE-09 v1 Production Hardening and Release]]'
  - '[[02_Phases/Phase_09_v1_production_hardening_and_release/Steps/Step_06_publish-v1-documentation-accessibility-and-release-checklist|STEP-09-06 Publish v1 Documentation Accessibility and Release Checklist]]'
  - '[[01_Architecture/System_Overview|System Overview]]'
  - '[[01_Architecture/Code_Map|Code Map]]'
  - '[[04_Decisions/DEC-0013_use-tailwind-css-and-daisyui-with-a-custom-theme-for-frontend-styling|DEC-0013 DaisyUI Frontend Styling]]'
  - '[[04_Decisions/DEC-0014_use-solidjs-vite-8-and-solid-router-for-frontend-runtime|DEC-0014 SolidJS Frontend Runtime]]'
  - '[[02_Phases/Phase_11_v1_1_research_usability/Phase|PHASE-11 v1.1 Research Usability]]'
  - '[[05_Sessions/2026-07-21-045505-publish-v1-documentation-accessibility-and-release-checklist-bug-0012-daisyui-worker|SESSION-2026-07-21-045505 DaisyUI refactor]]'
tags:
  - agent-vault
  - bug
---

# BUG-0012 - Frontend loads DaisyUI but bypasses its component framework

Use one note per bug. Capture reproduction, impact, root cause, workaround, and verification, then link back to the relevant phase, step, decision, or session. See [[07_Templates/Note_Contracts|Note Contracts]].

## Summary

- DaisyUI was installed and its theme plugin loaded, but the frontend largely bypassed the framework with a 2,372-line bespoke stylesheet and hundreds of custom component selectors.
- The frontend is now DaisyUI-first, with Tailwind limited to layout and utilities and only two domain-specific CSS helpers remaining.

## Observed Behavior

- `apps/web/src/index.css` contained 2,372 lines and 329 top-level bespoke selectors for buttons, cards, tabs, panels, dialogs, timelines, and other controls already provided by DaisyUI.
- Component markup used DaisyUI primitives only sporadically, while duplicated palettes, incomplete DaisyUI v5 radius tokens, and unbundled font fallbacks produced an inconsistent visual system.

## Expected Behavior

- DaisyUI 5 owns component primitives and semantic design tokens across the frontend; Tailwind utilities own layout, spacing, responsiveness, and the few domain arrangements without DaisyUI equivalents.
- Project-owned light/dark themes, bundled fonts, consistent radii, readable type scales, and accessibility behavior remain centralized and validated.

## Reproduction Steps

1. Inspect `apps/web/package.json` and confirm DaisyUI is installed.
2. Inspect `apps/web/src/index.css` and component markup before the repair.
3. Observe that most visible components are implemented through custom selectors rather than DaisyUI primitives, contrary to [[04_Decisions/DEC-0013_use-tailwind-css-and-daisyui-with-a-custom-theme-for-frontend-styling|DEC-0013]].

## Scope / Blast Radius

- Affected the complete `apps/web` presentation layer: shell/navigation, research, evidence, notebook/report editing, dialogs, loading/error states, light/dark themes, and responsive screenshots.
- Runtime APIs, SSE behavior, citations, base-path hosting, and persistence contracts were required to remain unchanged.

## Suspected Root Cause

- UI work accumulated page-level CSS around semantic hook names instead of composing DaisyUI primitives and extending the shared theme.

## Confirmed Root Cause

- The decisive evidence was the 2,372-line stylesheet, 329 bespoke selectors, duplicated theme values, and widespread custom component classes despite DaisyUI being loaded.

## Workaround

- No compatibility layer was retained. The greenfield repair replaced the custom component layer directly.

## Permanent Fix Plan

- Convert every applicable surface to DaisyUI primitives, consolidate semantic tokens into DaisyUI v5 light/dark themes, bundle Instrument Sans, Newsreader, and IBM Plex Mono, and retain custom CSS only for long-form synthesis typography and safe arbitrary wrapping.

## Regression Coverage Needed

- Repository lint, dependency boundaries, typecheck, unit tests, production builds, and focused browser workflows must pass.
- Responsive light/dark screenshots, keyboard navigation, theme persistence, accessibility, source/evidence exploration, report editing/repair/export, and base-path behavior must remain covered.

## Related Notes

<!-- AGENT-START:bug-related-notes -->
- [[02_Phases/Phase_09_v1_production_hardening_and_release/Phase|PHASE-09 v1 Production Hardening and Release]]
- [[02_Phases/Phase_09_v1_production_hardening_and_release/Steps/Step_06_publish-v1-documentation-accessibility-and-release-checklist|STEP-09-06 Publish v1 Documentation Accessibility and Release Checklist]]
- [[01_Architecture/System_Overview|System Overview]]
- [[01_Architecture/Code_Map|Code Map]]
- [[04_Decisions/DEC-0013_use-tailwind-css-and-daisyui-with-a-custom-theme-for-frontend-styling|DEC-0013 DaisyUI Frontend Styling]]
- [[04_Decisions/DEC-0014_use-solidjs-vite-8-and-solid-router-for-frontend-runtime|DEC-0014 SolidJS Frontend Runtime]]
- [[02_Phases/Phase_11_v1_1_research_usability/Phase|PHASE-11 v1.1 Research Usability]]
- [[05_Sessions/2026-07-21-045505-publish-v1-documentation-accessibility-and-release-checklist-bug-0012-daisyui-worker|SESSION-2026-07-21-045505 DaisyUI refactor]]
<!-- AGENT-END:bug-related-notes -->

## Timeline

<!-- AGENT-START:bug-timeline -->
- 2026-07-21 - Reported.
- 2026-07-21 - Refactored the frontend to DaisyUI-first primitives and reduced custom CSS from 2,372 lines to 140 lines with two domain helpers.
- 2026-07-21 - Independently verified 788 repository tests, 22 browser tests, lint, boundaries, typecheck, builds, docs, secrets, screenshots, and vault integrity; marked fixed.
<!-- AGENT-END:bug-timeline -->
