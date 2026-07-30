---
note_type: bug
template_version: 2
contract_version: 1
title: Citation unavailable state references a missing accessible heading
bug_id: BUG-0064
status: fixed
severity: sev-2
category: accessibility
reported_on: '2026-07-28'
fixed_on: '2026-07-30'
owner: bug-0064-attempt-1
created: '2026-07-28'
updated: '2026-07-30'
related_notes:
  - '[[02_Phases/Phase_10_v1_usable_research_workspace/Steps/Step_07_complete-responsive-accessibility-and-theme-behavior|STEP-10-07 Complete Responsive Accessibility and Theme Behavior]]'
  - '[[05_Sessions/2026-07-28-204323-complete-responsive-accessibility-and-theme-behavior-codex|SESSION-2026-07-28-204323 Codex session for Complete Responsive Accessibility and Theme Behavior]]'
tags:
  - agent-vault
  - bug
---

# BUG-0064 - Citation unavailable state references a missing accessible heading

Use one note per bug. Capture reproduction, impact, root cause, workaround, and verification, then link back to the relevant phase, step, decision, or session. See [[07_Templates/Note_Contracts|Note Contracts]].

## Summary

- Citation unavailable state references a missing accessible heading.
- Related notes: [[02_Phases/Phase_10_v1_usable_research_workspace/Steps/Step_07_complete-responsive-accessibility-and-theme-behavior|STEP-10-07 Complete Responsive Accessibility and Theme Behavior]], [[05_Sessions/2026-07-28-204323-complete-responsive-accessibility-and-theme-behavior-codex|SESSION-2026-07-28-204323 Codex session for Complete Responsive Accessibility and Theme Behavior]].
- **Observed:** The citation-unavailable state renders a plain section with `aria-labelledby="citation-title"`, but no `#citation-title` exists. Axe reports critical `aria-valid-attr-value` and serious `aria-prohibited-attr` findings.
- **Expected:** Render the referenced heading and a semantic region, or remove the broken ARIA wiring.
- **Reproduction:** Open `/projects/:projectId/research/:threadId/citation/:citationId` with valid-format missing IDs in either theme and run axe.
- **Evidence:** `.local/ui-audit/dark/citation-unavailable-dark-a11y.json`, tablet/light parity files, and screenshot `citation-unavailable-desktop-dark.png`.

## Observed Behavior

- Describe what actually happens.
The citation page wraps every render state (error, loading, and loaded) in one `<section aria-labelledby="citation-title">`. The `#citation-title` heading only exists in the loaded `<Match>` branch. In the error and loading branches the heading is absent, so axe reports `aria-valid-attr-value` (critical: ID does not exist) and `aria-prohibited-attr` (serious: `aria-labelledby` on a `<section>` with no valid role).

## Expected Behavior

- Describe what should happen instead.
Only the loaded citation branch should carry `aria-labelledby="citation-title"`, and the referenced `<h2 id="citation-title">` must live inside that same semantic region. The error and loading branches should render as plain regions/alerts without referencing a heading that does not exist.

## Reproduction Steps

1. List the exact setup state.
2. List the user or developer actions.
3. Record the observed result.
1. Start the web app and open `/projects/:projectId/research/:threadId/citation/:citationId` with a valid-format but missing/unresolvable citation ID (so the API returns 404 or the resource stays pending).
2. Run axe against the page in either theme.
3. Observe critical `aria-valid-attr-value` and serious `aria-prohibited-attr` findings on the `<section aria-labelledby="citation-title">` element.

## Scope / Blast Radius

- List affected packages, commands, integrations, environments, or users.
- `apps/web/src/components/CitationViewer.tsx` — the citation viewer component rendered by `CitationPage` for `/projects/:projectId/research/:threadId/citation/:citationId`. Only this component and its route are affected.

## Suspected Root Cause

- Record current theories and assumptions.

## Confirmed Root Cause

- Record the proven cause and decisive evidence.
The outer `<section aria-labelledby="citation-title">` wraps the entire `<Switch>`, but the `#citation-title` heading is declared only inside the loaded-state `<Match>` branch. In error/loading branches the section references a heading that never renders.

## Workaround

- Describe any temporary mitigation and remaining risk.
None. The error/loading states remain usable; the issue is an ARIA contract violation reported by axe, not a functional break.

## Permanent Fix Plan

- Describe the intended durable fix.
Move the `<section aria-labelledby="citation-title">` from the outer wrapper into the loaded-state `<Match>` branch, so the section and its referenced `<h2 id="citation-title">` always render together. Replace the outer wrapper with a plain `<div>` that preserves the layout classes. The error and loading branches now render without a dangling `aria-labelledby` reference.

Diff: `apps/web/src/components/CitationViewer.tsx` — outer `<section aria-labelledby="citation-title" class="max-w-3xl mx-auto space-y-4">` becomes `<div class="max-w-3xl mx-auto space-y-4">`; the loaded branch wraps its content in `<section aria-labelledby="citation-title" class="space-y-4">` containing the existing back-link, article, and `<h2 id="citation-title">`.

## Regression Coverage Needed

- List tests, fixtures, reproductions, alerts, or docs updates needed.
- Added `apps/web/src/components/citation-viewer.test.tsx`: SSR regression test that renders `CitationViewer` with a never-resolving fetch (loading branch) and asserts every `aria-labelledby` reference resolves to an element `id` in the same render. Fails on the pre-fix markup, passes after the fix.
- Added `apps/web/src/test/mock-solid-router.tsx`: shared `@solidjs/router` SSR mock using a mutable params record and object-literal exports, with a `setRouterParams` helper, so `citation-viewer.test.tsx` and the existing `sources-page.test.tsx` (BUG-0062) share one router stub instead of colliding via `mock.module`. `sources-page.test.tsx` was migrated to use this shared helper.
- No production code other than `CitationViewer.tsx` changed.

## Related Notes

<!-- AGENT-START:bug-related-notes -->
- Phase: [[02_Phases/Phase_10_v1_usable_research_workspace/Phase|Phase 10 v1 usable research workspace]]
- Step: [[02_Phases/Phase_10_v1_usable_research_workspace/Steps/Step_07_complete-responsive-accessibility-and-theme-behavior|STEP-10-07 Complete Responsive Accessibility and Theme Behavior]]
- Session: [[05_Sessions/2026-07-28-204323-complete-responsive-accessibility-and-theme-behavior-codex|SESSION-2026-07-28-204323 Codex session for Complete Responsive Accessibility and Theme Behavior]]
<!-- AGENT-END:bug-related-notes -->

## Timeline

<!-- AGENT-START:bug-timeline -->
- 2026-07-28 - Reported.
<!-- AGENT-END:bug-timeline -->
- 2026-07-30 - Root cause confirmed: outer `<section aria-labelledby="citation-title">` wrapped the whole `<Switch>`; heading only in loaded branch. Fix: move section into loaded branch, outer wrapper is now a plain `<div>`. Added `citation-viewer.test.tsx` regression (TDD red→green) and shared `mock-solid-router.tsx`; migrated `sources-page.test.tsx` to the shared mock to resolve a `mock.module` collision. Validation: `bun test apps/web/src` 82 pass/0 fail; full monorepo 1013 pass/0 fail; typecheck, lint, dependency-cruiser, boundary-check all clean.
