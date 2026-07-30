---
note_type: bug
template_version: 2
contract_version: 1
title: Removed source selection notice lacks browser coverage
bug_id: BUG-0089
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

# BUG-0089 - Removed source selection notice lacks browser coverage

Use one note per bug. Capture reproduction, impact, root cause, workaround, and verification, then link back to the relevant phase, step, decision, or session. See [[07_Templates/Note_Contracts|Note Contracts]].

## Summary

- Removed source selection notice lacks browser coverage.
- Related notes: [[02_Phases/Phase_10_v1_usable_research_workspace/Steps/Step_07_complete-responsive-accessibility-and-theme-behavior|STEP-10-07 Complete Responsive Accessibility and Theme Behavior]], [[05_Sessions/2026-07-28-204323-complete-responsive-accessibility-and-theme-behavior-codex|SESSION-2026-07-28-204323 Codex session for Complete Responsive Accessibility and Theme Behavior]].
- **Gap:** The live browser suite does not prove the warning shown when a previously selected source stops being ready and is removed from the question.
- **Expected regression:** Change a selected source readiness during a conversation and assert the `role=status` notice, reconciled selection, draft preservation, and theme/responsive screenshots.
- **Evidence:** `.local/ui-audit/inventory.md` coverage gaps; component logic has unit coverage only.

## Observed Behavior

- No browser (e2e) test drives a previously selected source out of the ready state mid-conversation, so the `role=status` removal notice (`ConversationPanel.tsx:350-351`) is never asserted in the live suite.
- `apps/web/e2e/conversation.spec.ts` mocks exactly one source (`ready.md`) with a constant `readiness: 'ready'` (lines 54-67); the catalog never transitions, so `reconcileSourceSelection` never produces a non-empty `removed` array in the browser.
- The removal notice text and `role=status` semantics are only exercised by the pure-function unit test `conversation-workspace.test.tsx`, which calls `reconcileSourceSelection` directly and never renders the panel or its `Show` block.

## Expected Behavior

- A browser regression should select a ready source, transition that source out of ready (catalog returns `readiness !== 'ready'` or omits the version) on a subsequent catalog fetch, and assert:
  - the `role=status` warning renders with the singular message `A source that is no longer ready was removed from this question.` (and the plural variant for two or more).
  - the reconciled selection no longer contains the removed version (submission payload excludes it).
  - an in-progress draft is preserved across the reconciliation (sessionStorage / `storageKey()`).
  - the notice and reconciled selection render correctly in both themes and at the approved responsive breakpoints (screenshots).

## Reproduction Steps

1. Setup: run the e2e suite (`apps/web/e2e/conversation.spec.ts`); confirm it contains no case where a selected source's `readiness` changes from `ready` to a non-ready value after selection.
2. Action: in a local browser, open `/projects/:projectId`, check a ready source checkbox, type a draft, then make the catalog return that source with `readiness: 'processing'` (or drop it from `items`).
3. Observed result (covered only by unit test): the panel's `createEffect` (`ConversationPanel.tsx:200-210`) sets `selectionNotice` and prunes `selected`; the `role=status` `<p class="alert alert-warning">` appears. No e2e assertion exists for this path, so a regression in the notice, reconciliation, or draft preservation would not fail the browser suite.

## Scope / Blast Radius

- Affected: `apps/web` e2e coverage for the conversation composer (`ConversationPanel.tsx`) and its state helper (`conversation-state.ts`).
- Commands: the Playwright/browser e2e suite under `apps/web/e2e/`.
- Reach: any regression in the removed-source notice, source-scope reconciliation after readiness loss, or draft preservation during reconciliation would ship undetected by the browser suite.
- Users: end users who keep a conversation open while a source is re-ingested or falls out of ready state; they would lose the warning silently.

## Suspected Root Cause

- Record current theories and assumptions.

## Confirmed Root Cause

- Coverage gap, not a code defect. `.local/ui-audit/inventory.md` Route 8 (Conversation-Only ResearchPage) lists `Selection notice (removed source) | Source no longer ready | e2e Covered: ❌ | Unit Covered: ✅ conversation-workspace.test.tsx`.
- `conversation-workspace.test.tsx` asserts only the pure return value of `reconcileSourceSelection` (selected/removed arrays); it does not render `ConversationPanel`, assert the `role=status` DOM, the singular/plural message text, sessionStorage draft preservation, or theme/responsive rendering.
- `conversation.spec.ts` keeps `ready.md` perpetually ready and never transitions a selected source out of ready, so the `removed` branch (`ConversationPanel.tsx:200-210`) and its `Show` notice (`:350-351`) are unreachable in the browser suite.

## Workaround

- None at runtime; the feature works as implemented. The risk is detection-only: a regression in the notice, reconciliation, or draft preservation would not be caught by the browser suite. Manual verification (step 2 above) is the only current check.

## Permanent Fix Plan

- Add a Playwright e2e case in `apps/web/e2e/conversation.spec.ts` (or a sibling spec) that:
  1. Serves a catalog with one ready source, checks it, and types a draft.
  2. On the next catalog fetch, returns that source with `readiness !== 'ready'` (or omits it) so `reconcileSourceSelection` yields a non-empty `removed`.
  3. Asserts the `role=status` warning text (singular; plus a second case for the plural message with two removed sources).
  4. Asserts the reconciled selection excludes the removed version and that the submit payload (intercepted POST) reflects the pruned selection.
  5. Asserts the draft textarea still holds the preserved text after reconciliation.
  6. Captures theme (light/dark) and responsive breakpoint screenshots of the notice state.
- Update `.local/ui-audit/inventory.md` Route 8 `Selection notice (removed source)` row to `e2e Covered: ✅`.

## Regression Coverage Needed

- e2e: removed-source notice (singular) — assert `role=status` text and reconciled selection.
- e2e: removed-source notice (plural, two sources) — assert plural message.
- e2e: draft preservation across the readiness transition.
- e2e: theme (light/dark) and responsive screenshot matrix for the notice state.
- Docs: flip the `Selection notice (removed source)` row in `.local/ui-audit/inventory.md` to e2e ✅ once added.

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
