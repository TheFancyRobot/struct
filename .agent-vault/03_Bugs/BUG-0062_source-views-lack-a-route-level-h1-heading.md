---
note_type: bug
template_version: 2
contract_version: 1
title: Source views lack a route level h1 heading
bug_id: BUG-0062
status: fixed
severity: sev-3
category: accessibility
reported_on: '2026-07-28'
fixed_on: '2026-07-29'
owner: bug-0062-attempt-1
created: '2026-07-28'
updated: '2026-07-29'
related_notes:
  - '[[02_Phases/Phase_10_v1_usable_research_workspace/Steps/Step_07_complete-responsive-accessibility-and-theme-behavior|STEP-10-07 Complete Responsive Accessibility and Theme Behavior]]'
  - '[[05_Sessions/2026-07-28-204323-complete-responsive-accessibility-and-theme-behavior-codex|SESSION-2026-07-28-204323 Codex session for Complete Responsive Accessibility and Theme Behavior]]'
tags:
  - agent-vault
  - bug
---

# BUG-0062 - Source views lack a route level h1 heading

Use one note per bug. Capture reproduction, impact, root cause, workaround, and verification, then link back to the relevant phase, step, decision, or session. See [[07_Templates/Note_Contracts|Note Contracts]].

## Summary

- Source views lack a route level h1 heading.
- Related notes: [[02_Phases/Phase_10_v1_usable_research_workspace/Steps/Step_07_complete-responsive-accessibility-and-theme-behavior|STEP-10-07 Complete Responsive Accessibility and Theme Behavior]], [[05_Sessions/2026-07-28-204323-complete-responsive-accessibility-and-theme-behavior-codex|SESSION-2026-07-28-204323 Codex session for Complete Responsive Accessibility and Theme Behavior]].
- **Observed:** `/sources` and `/projects/:projectId/sources` begin main content with H2 headings (`Add sources`, `Source library`/`Sources`) and expose no H1.
- **Expected:** Each route has one descriptive route-level H1 and a logical heading hierarchy.
- **Reproduction:** Open either Sources route and inspect the accessibility tree or run axe `page-has-heading-one`.
- **Evidence:** `.local/ui-audit/accessibility/report.md` ISSUE-002 and source-page snapshots in both themes.
- **Standards:** WCAG 1.3.1 and 2.4.6.

## Observed Behavior

- Describe what actually happens.

## Expected Behavior

- Describe what should happen instead.

## Reproduction Steps

1. List the exact setup state.
2. List the user or developer actions.
3. Record the observed result.

## Scope / Blast Radius

- List affected packages, commands, integrations, environments, or users.

## Suspected Root Cause

- Record current theories and assumptions.

## Confirmed Root Cause

- Record the proven cause and decisive evidence.
`SourcesPage` (`apps/web/src/pages/SourcesPage.tsx`) rendered the route content inside a `<section>` whose first heading was the `<h2>` inside `SourceImportPanel` ("Add sources"). In library mode a second `<h2>` ("Source library") followed; in project mode `SourceCatalogList` rendered an `<h2>` ("Sources"). No `<h1>` existed on either variant, so axe `page-has-heading-one` failed. The other workspace routes (`/projects/:id`, `/projects/:id/notes`) already had a route-level `<h1>`, making this an inconsistency.

## Workaround

- Describe any temporary mitigation and remaining risk.

## Permanent Fix Plan

- Describe the intended durable fix.
- Added a route-level `<h1>` at the top of `SourcesPage` content: "Source library" in library mode (`/sources`), "Sources" in project mode (`/projects/:projectId/sources`). Styled `text-lg font-semibold` to match the existing workspace h1 scale.
- Renamed the library-mode section `<h2>` from "Source library" to "Library sources" and the project-mode `SourceCatalogList` `<h2>` from "Sources" to "Project sources" so each heading name is unique (avoids Playwright `getByRole` strict-mode duplicates and keeps a logical h1 → h2 hierarchy).

## Regression Coverage Needed

- List tests, fixtures, reproductions, alerts, or docs updates needed.
- `apps/web/src/pages/sources-page.test.tsx` (new): renders `SourcesPage` via a `@solidjs/router` `useParams` mock in both library and project modes; asserts exactly one `<h1>`, that it precedes every `<h2>`, and that the route-level heading text is correct.

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
- 2026-07-29 - Fixed by bug-0062-attempt-1. Added route-level `<h1>` to `SourcesPage` (library: "Source library"; project: "Sources"); renamed sibling `<h2>` headings to "Library sources" and "Project sources" for uniqueness. Added `sources-page.test.tsx` regression coverage. Verified: `bun test --path-ignore-patterns='**/e2e/**' ./apps/web` → 82 pass / 0 fail; `tsc --noEmit` and `eslint` clean.
