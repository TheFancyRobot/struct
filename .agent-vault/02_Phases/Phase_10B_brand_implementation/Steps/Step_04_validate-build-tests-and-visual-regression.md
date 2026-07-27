---
note_type: step
template_version: 2
contract_version: 1
title: Validate Build Tests and Visual Regression
step_id: STEP-10B-04
phase: '[[02_Phases/Phase_10B_brand_implementation/Phase|PHASE-10B Brand Implementation]]'
status: completed
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

- Outcome: The full repository passes all gates (build, unit tests, e2e tests). Both light and dark modes render correctly. Visual regression test coverage is added for critical pages (dashboard/workspace views in both themes). The brand implementation meets all acceptance criteria from the phase note.
- Parent phase: [[02_Phases/Phase_10B_brand_implementation/Phase|PHASE-10B Brand Implementation]].
- Sequencing: start after [[02_Phases/Phase_10B_brand_implementation/Steps/Step_03_migrate-components-to-semantic-brand-tokens|STEP-10B-03]] is complete.

## Required Reading

- [[02_Phases/Phase_10B_brand_implementation/Phase|PHASE-10B Brand Implementation]] — Grilling Session Decisions section and Acceptance Criteria
- `.brand/STRUCT_BRAND_IMPLEMENTATION.md` section 10 (acceptance criteria checklist)
- `apps/web/e2e/` — existing e2e test structure (uses `bun:test` + Playwright chromium, NOT `@playwright/test`)
- `apps/web/e2e/notebook-report.spec.ts` — existing screenshot pattern using `page.screenshot()`

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
- Next action: Run the full validation gate (`bun run build && bun test && bun run test:e2e`), add visual regression coverage using the existing `page.screenshot()` pattern, verify all phase acceptance criteria.
<!-- AGENT-END:step-agent-managed-snapshot -->

## Human Notes

- **Validation gate:** `bun run build && bun test && bun run test:e2e` (from repo root). All three must pass.
- **Visual regression:** The e2e tests use `bun:test` + Playwright's chromium browser directly (NOT `@playwright/test`). `toHaveScreenshot()` is NOT available. Either: (a) add `@playwright/test` as a dev dependency with a separate config, or (b) implement screenshot comparison using the existing `page.screenshot()` pattern already in `notebook-report.spec.ts`. Option (b) is preferred — it reuses the existing infrastructure.
- **E2e test assertions:** Some e2e tests assert on color contrast ratios and take screenshots (see `notebook-report.spec.ts` lines 817-900). These may need threshold updates if brand colors change contrast ratios. Check `waitForThemeStyles` usage.
- **Font loading metrics:** New fonts (Inter, JetBrains Mono) may have different metrics than Manrope/IBM Plex Mono. Verify no text overflow or truncation regressions in e2e tests.
- **Existing screenshot tests:** `notebook-report.spec.ts` already takes 6 screenshots (3 viewports × 2 themes) and checks contrast ratios. These serve as a baseline for visual regression.

## Session History

<!-- AGENT-START:step-session-history -->
- No sessions yet.
<!-- AGENT-END:step-session-history -->
