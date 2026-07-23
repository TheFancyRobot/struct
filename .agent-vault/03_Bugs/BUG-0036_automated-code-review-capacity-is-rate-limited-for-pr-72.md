---
note_type: bug
template_version: 2
contract_version: 1
title: 'Automated code review capacity is rate-limited for PR #72'
bug_id: BUG-0036
status: fixed
severity: sev-3
category: logic
reported_on: '2026-07-23'
fixed_on: '2026-07-23'
owner: ''
created: '2026-07-23'
updated: '2026-07-23'
related_notes:
  - '[[03_Bugs/BUG-0034_recursive-analysis-responsive-e2e-emits-unhandled-500-responses|BUG-0034 Recursive analysis responsive E2E emits unhandled 500 responses]]'
  - '[[02_Phases/Phase_10_v1_usable_research_workspace/Phase|PHASE-10 v1 Usable Research Workspace]]'
tags:
  - agent-vault
  - bug
---

# BUG-0036 - Automated code review capacity is rate-limited for PR #72

Use one note per bug. Capture reproduction, impact, root cause, workaround, and verification, then link back to the relevant phase, step, decision, or session. See [[07_Templates/Note_Contracts|Note Contracts]].

## Summary

- CodeRabbit's per-user review limit temporarily blocked PR #72; capacity returned and the review completed on 2026-07-23.
- Related notes: [[03_Bugs/BUG-0034_recursive-analysis-responsive-e2e-emits-unhandled-500-responses|BUG-0034]], [[02_Phases/Phase_10_v1_usable_research_workspace/Phase|PHASE-10]].

## Observed Behavior

- During the 2026-07-23 review window, CodeRabbit posted `Review limit reached` and delayed review of PR #72. Qodo remains paused. CodeRabbit later completed review of the branch; the PR now awaits resolution of its actionable feedback rather than review capacity.

## Expected Behavior

- PR #72 should receive its required automated review and have every actionable comment resolved before merge.

## Reproduction Steps

1. Open PR #72 after pushing `9fccb53`.
2. Check `gh pr view 72 --json statusCheckRollup,comments`.
3. Observe CodeRabbit's rate-limit response instead of a review.

## Scope / Blast Radius

- The rate-limit incident temporarily blocked merging the BUG-0034 remediation PR. It no longer blocks the merge; any remaining block is the PR's actionable review feedback.

## Suspected Root Cause

- The external reviewer quota has been consumed by recent PR review retries.

## Confirmed Root Cause

- CodeRabbit's PR #72 comment explicitly states review limit reached and provides a next-review window; this is an external service capacity constraint.

## Workaround

- Historical only: wait for review capacity. The required review has now completed.

## Permanent Fix Plan

- Completed: CodeRabbit review capacity returned and the review completed. Resolve its actionable feedback before merging PR #72 and starting BUG-0035.

## Regression Coverage Needed

- Capacity regression: a future rate-limit response must clear before merge. Current PR work remains separately gated on resolving the completed review's actionable comments.

## Related Notes

<!-- AGENT-START:bug-related-notes -->
- [[03_Bugs/BUG-0034_recursive-analysis-responsive-e2e-emits-unhandled-500-responses|BUG-0034 Recursive analysis responsive E2E emits unhandled 500 responses]]
- [[02_Phases/Phase_10_v1_usable_research_workspace/Phase|PHASE-10 v1 Usable Research Workspace]]
<!-- AGENT-END:bug-related-notes -->

## Timeline

<!-- AGENT-START:bug-timeline -->
- 2026-07-23 - Reported: CodeRabbit review capacity was rate-limited for PR #72; PR merge was temporarily blocked.
- 2026-07-23 20:56 UTC - Retried `@coderabbitai review`; the prior rate-limit response still reported the next review window in approximately 26 minutes.
- 2026-07-23 21:57 UTC - CodeRabbit completed review of PR #72. The rate-limit incident is fixed; outstanding actionable feedback remains a separate merge gate.
<!-- AGENT-END:bug-timeline -->
