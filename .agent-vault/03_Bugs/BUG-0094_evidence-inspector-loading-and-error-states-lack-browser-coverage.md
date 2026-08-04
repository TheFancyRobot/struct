---
note_type: bug
template_version: 2
contract_version: 1
title: Evidence inspector loading and error states lack browser coverage
bug_id: BUG-0094
status: fixed
severity: sev-3
category: testing
reported_on: '2026-07-28'
fixed_on: '2026-08-04'
owner: bug_0094
created: '2026-07-28'
updated: '2026-08-04'
related_notes:
  - '[[02_Phases/Phase_10_v1_usable_research_workspace/Steps/Step_07_complete-responsive-accessibility-and-theme-behavior|STEP-10-07 Complete Responsive Accessibility and Theme Behavior]]'
  - '[[05_Sessions/2026-07-28-204323-complete-responsive-accessibility-and-theme-behavior-codex|SESSION-2026-07-28-204323 Codex session for Complete Responsive Accessibility and Theme Behavior]]'
tags:
  - agent-vault
  - bug
---

# BUG-0094 - Evidence inspector loading and error states lack browser coverage

Use one note per bug. Capture reproduction, impact, root cause, workaround, and verification, then link back to the relevant phase, step, decision, or session. See [[07_Templates/Note_Contracts|Note Contracts]].

## Summary

- Evidence inspector loading and error states lack browser coverage.
- Related notes: [[02_Phases/Phase_10_v1_usable_research_workspace/Steps/Step_07_complete-responsive-accessibility-and-theme-behavior|STEP-10-07 Complete Responsive Accessibility and Theme Behavior]], [[05_Sessions/2026-07-28-204323-complete-responsive-accessibility-and-theme-behavior-codex|SESSION-2026-07-28-204323 Codex session for Complete Responsive Accessibility and Theme Behavior]].
- **Gap:** EvidenceInspector ready behavior has component coverage, but its loading and fetch-error/retry states lack live browser validation.
- **Expected regression:** Open selected document/dataset evidence, force slow and failing fetches, assert focus/close/retry behavior, exact copy, and light/dark responsive screenshots.
- **Evidence:** `.local/ui-audit/inventory.md` Component Interaction Matrix.

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
- The loading, unavailable-error, retry, and focus-restoration paths existed but were only exercised by component tests; no deterministic live-browser specification covered their interaction with the responsive workspace shell.

## Workaround

- Describe any temporary mitigation and remaining risk.

## Permanent Fix Plan

- Describe the intended durable fix.

## Regression Coverage Needed

- List tests, fixtures, reproductions, alerts, or docs updates needed.
- Added `apps/web/e2e/evidence-inspector-states.spec.ts`: deterministic delayed fetch and 503 retry coverage verifies loading copy, unavailable alert copy, retry recovery, Escape close/focus restoration, and no horizontal overflow at 1440×900 and 390×844 in light and dark themes.
- Captured reviewed evidence in `docs/demos/evidence-inspector-states/`.

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
- 2026-08-04 - Fixed with deterministic responsive browser coverage; focused E2E and web typecheck passed.
