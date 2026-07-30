---
note_type: bug
template_version: 2
contract_version: 1
title: Notebook report 404 remains stuck in loading state
bug_id: BUG-0086
status: new
severity: sev-2
category: logic
reported_on: '2026-07-28'
fixed_on: ''
owner: unassigned
created: '2026-07-28'
updated: '2026-07-28'
related_notes:
  - '[[02_Phases/Phase_10_v1_usable_research_workspace/Steps/Step_07_complete-responsive-accessibility-and-theme-behavior|STEP-10-07 Complete Responsive Accessibility and Theme Behavior]]'
  - '[[05_Sessions/2026-07-28-204323-complete-responsive-accessibility-and-theme-behavior-codex|SESSION-2026-07-28-204323 Codex session for Complete Responsive Accessibility and Theme Behavior]]'
tags:
  - agent-vault
  - bug
---

# BUG-0086 - Notebook report 404 remains stuck in loading state

Use one note per bug. Capture reproduction, impact, root cause, workaround, and verification, then link back to the relevant phase, step, decision, or session. See [[07_Templates/Note_Contracts|Note Contracts]].

## Summary

- Notebook report 404 remains stuck in loading state.
- Related notes: [[02_Phases/Phase_10_v1_usable_research_workspace/Steps/Step_07_complete-responsive-accessibility-and-theme-behavior|STEP-10-07 Complete Responsive Accessibility and Theme Behavior]], [[05_Sessions/2026-07-28-204323-complete-responsive-accessibility-and-theme-behavior-codex|SESSION-2026-07-28-204323 Codex session for Complete Responsive Accessibility and Theme Behavior]].
- **Observed:** With valid project/workspace/report UUIDs for a missing report, `GET /reports/:reportId` returns 404 but Notebook stays on `Opening report workspace…` indefinitely.
- **Expected:** Resolve the resource to a clear report-not-found/error state with a back/retry action.
- **Reproduction:** Open `/projects/:projectId/notebook?workspaceId=:validWorkspaceId&reportId=:missingValidReportId`, wait for the 404, and observe the loader after 8+ seconds.
- **Evidence:** `.local/ui-audit/lead/screenshots/notebook-404-stuck-loading.png` and `.local/ui-audit/inventory.md` confirmed browser pass.

## Observed Behavior

- With valid project/workspace/report UUIDs for a missing report, `GET /reports/:reportId` returns 404 but Notebook stays on the `Opening report workspace…` spinner indefinitely (Summary; inventory §7 CONFIRMED).
- The `existingReport` resource stays in its loading state; after `networkidle` the spinner persists — the request appears to hang or take an unreasonably long time (inventory §7).
- No error text or recovery action is shown (screenshot `.local/ui-audit/lead/screenshots/notebook-404-stuck-loading.png` shows only the spinner).
- Reported 2026-07-28 during the STEP-10-07 / DEC-0024 audit; sev-2, category logic.

## Expected Behavior

- Resolve the missing report to a clear report-not-found/error state with a back/retry action (Summary).
- Specifically, reach the existing `This report could not be opened` error state instead of hanging on the loader (inventory §7 expected).

## Reproduction Steps

1. Setup: a valid project and workspace exist; pick a valid-format but non-existent `reportId` UUID.
2. Open `/projects/:projectId/notebook?workspaceId=:validWorkspaceId&reportId=:missingValidReportId` by direct URL (the route has no in-app link — only a disabled `Reports` button per inventory §3.2).
3. Wait for the 404 and observe the loader: `Opening report workspace…` persists after 8+ seconds / `networkidle`.
- Evidence: `.local/ui-audit/lead/screenshots/notebook-404-stuck-loading.png`; inventory §7 browser pass confirmed.

## Scope / Blast Radius

- Component: `apps/web/src/pages/NotebookPage.tsx` — loading fallback and `existingReport` resource gating (inventory §9).
- API: `GET /projects/:projectId/reports/:reportId` via `fetchReport`/`artifactRequest` (`apps/web/src/api/artifacts.ts`, inventory §9).
- Route: `/projects/:projectId/notebook` — requires `workspaceId` + `reportId`; reachable only via direct URL, citation `returnTo`, or programmatic navigation (inventory §3.2).
- Users: anyone opening a bookmarked/shared notebook link to a deleted or non-existent report — indefinite hang, no recovery action.

## Suspected Root Cause

- Record current theories and assumptions.

## Confirmed Root Cause

- Per inventory §7 CONFIRMED, the `existingReport` resource does not leave its loading state for a non-existent report; the report fetch appears to hang / not settle in the real stack, so NotebookPage never reaches its error branch.
- NotebookPage's loading fallback is gated only on the unresolved resource with no timeout or non-completion fallback (inventory §7 state: `existingReport` loading; affected file NotebookPage.tsx per inventory §9).
- The 404 error path itself is mocked-e2e-covered (inventory §2 Route 10 row `Report not found → fetchReport returns error → ✅ notebook-report.spec.ts`), so the defect is the real-stack non-settling fetch plus the missing loading timeout, not a missing error handler.
- Decisive evidence: screenshot `notebook-404-stuck-loading.png` + inventory §7 CONFIRMED state.

## Workaround

- None in-product: the user sees an indefinite spinner with no back/retry action and must manually edit the URL (drop the `reportId`) or navigate away.
- Reload does not help — the same missing report re-hangs.

## Permanent Fix Plan

- Make a missing report deterministically reach the error state: investigate why the real-stack `GET /reports/:reportId` does not settle (inventory: "appears to hang") and ensure it returns 404 promptly so the existing error path fires.
- Add a loading timeout / non-completion fallback in NotebookPage so the `existingReport` resource cannot hang the UI indefinitely.
- Render a back/retry action in the `This report could not be opened` error state (Summary expected).

## Regression Coverage Needed

- Add a real-stack (non-mocked) browser/e2e reproduction for a valid-but-non-existent `reportId` asserting the page reaches the error state within a bounded time; current `notebook-report.spec.ts` only mocks 404 via `page.route` (inventory §2 Route 10) and does not exercise the real-stack hang.
- Assert the error state exposes a back/retry action.
- Screenshot/axe regression for the error state; update inventory Route 10 `Report not found` row from mocked-e2e to real-stack covered.

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
