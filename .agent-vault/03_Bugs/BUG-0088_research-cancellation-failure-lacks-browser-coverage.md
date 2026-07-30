---
note_type: bug
template_version: 2
contract_version: 1
title: Research cancellation failure lacks browser coverage
bug_id: BUG-0088
status: new
severity: sev-3
category: testing
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

# BUG-0088 - Research cancellation failure lacks browser coverage

Use one note per bug. Capture reproduction, impact, root cause, workaround, and verification, then link back to the relevant phase, step, decision, or session. See [[07_Templates/Note_Contracts|Note Contracts]].

## Summary

- Research cancellation failure lacks browser coverage.
- Related notes: [[02_Phases/Phase_10_v1_usable_research_workspace/Steps/Step_07_complete-responsive-accessibility-and-theme-behavior|STEP-10-07 Complete Responsive Accessibility and Theme Behavior]], [[05_Sessions/2026-07-28-204323-complete-responsive-accessibility-and-theme-behavior-codex|SESSION-2026-07-28-204323 Codex session for Complete Responsive Accessibility and Theme Behavior]].
- **Gap:** Browser coverage verifies successful cancellation but not a rejected/failed cancellation request and its user recovery state.
- **Expected regression:** Force cancellation API failure, assert actionable feedback, state preservation, and light/dark responsive screenshots.
- **Evidence:** `.local/ui-audit/inventory.md` E2E missing states.

## Observed Behavior

- ResearchStream cancellation **requested** (success) state IS e2e covered (`recursive-analysis.spec.ts`), but the cancellation **error** state (failed/rejected cancel request) is `❌ | ❌` — no e2e, no unit (inventory Route 7 table).
- §3.3 lists "Cancellation request error" as reachable but not individually tested; §5.2 lists "Cancellation request failure | ResearchStream | ResearchPage" under E2E Tests Missing States.
- No exercised path exists for a rejected cancellation and its user recovery state.

## Expected Behavior

- Regression e2e forces the cancellation API to fail (reject/error) during a live recursive run.
- Assert actionable feedback (error message/banner) is shown to the user.
- Assert prior research/stream state is preserved (no data loss).
- Capture light and dark responsive screenshots of the failure/recovery state.

## Reproduction Steps

1. Start from a project with a live recursive research run (Route 7 `/projects/:projectId/research/:threadId/runs/:runId`).
2. Configure/mock the cancellation API to reject (return error) BEFORE clicking Cancel, then click Cancel and assert the failed-cancellation recovery UI.
3. Observe: no test exercises the failed-cancellation branch; the recovery UI state is unverified (inventory §3.3 and §5.2).

## Scope / Blast Radius

- Affected component: `ResearchStream` on ResearchPage (Route 7).
- Affected tests: `recursive-analysis.spec.ts` (cancel success only); ResearchStream has no unit tests.
- Users: anyone whose cancellation request fails (network/API error) — recovery UX is unverified.

## Suspected Root Cause

- Record current theories and assumptions.

## Confirmed Root Cause

- Testing-coverage gap, not a code defect: the cancellation-failure branch of ResearchStream has zero e2e and zero unit coverage (inventory Route 7: Cancellation error `❌ | ❌`; §3.3; §5.2).
- Decisive evidence: `.local/ui-audit/inventory.md` §5.2 — "Cancellation request failure | ResearchStream | ResearchPage".

## Workaround

- None at runtime; successful cancellation remains covered.
- Manual-only: reproduce locally by failing the cancel request and inspecting the UI — not durable regression coverage.

## Permanent Fix Plan

- Add an e2e spec forcing the cancellation API to fail during a live recursive run.
- Assert actionable feedback, state preservation, and capture light/dark responsive screenshots.
- Add a ResearchStream unit test for the cancel-error state (component currently has no unit tests).

## Regression Coverage Needed

- E2E: failed/rejected cancellation request on ResearchPage Route 7 — actionable feedback + state preservation.
- E2E: light and dark responsive screenshots of the cancellation-failure/recovery state.
- Unit: ResearchStream cancel-error branch (currently `❌`).
- Docs: update `.local/ui-audit/inventory.md` Route 7 "Cancellation error" row from `❌ | ❌` to reflect new coverage.

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
