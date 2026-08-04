---
note_type: bug
template_version: 2
contract_version: 1
title: Unavailable project attachment control has no explanation
bug_id: BUG-0082
status: fixed
severity: sev-3
category: ux
reported_on: '2026-07-28'
fixed_on: '2026-08-04'
owner: bug_0082
created: '2026-07-28'
updated: '2026-08-04'
related_notes:
  - '[[02_Phases/Phase_10_v1_usable_research_workspace/Steps/Step_07_complete-responsive-accessibility-and-theme-behavior|STEP-10-07 Complete Responsive Accessibility and Theme Behavior]]'
  - '[[05_Sessions/2026-07-28-204323-complete-responsive-accessibility-and-theme-behavior-codex|SESSION-2026-07-28-204323 Codex session for Complete Responsive Accessibility and Theme Behavior]]'
tags:
  - agent-vault
  - bug
---

# BUG-0082 - Unavailable project attachment control has no explanation

Use one note per bug. Capture reproduction, impact, root cause, workaround, and verification, then link back to the relevant phase, step, decision, or session. See [[07_Templates/Note_Contracts|Note Contracts]].

## Summary

- Unavailable project attachment control has no explanation.
- Related notes: [[02_Phases/Phase_10_v1_usable_research_workspace/Steps/Step_07_complete-responsive-accessibility-and-theme-behavior|STEP-10-07 Complete Responsive Accessibility and Theme Behavior]], [[05_Sessions/2026-07-28-204323-complete-responsive-accessibility-and-theme-behavior-codex|SESSION-2026-07-28-204323 Codex session for Complete Responsive Accessibility and Theme Behavior]].
- **Observed:** On a clean zero-project `/sources` state, `Attach new sources to a project` is disabled without an inline reason or recovery action; the label still appears clickable.
- **Expected:** Explain that a project is required and link to Add project, or hide the unavailable option.
- **Reproduction:** Start the clean stack before any project exists and open `/sources`.
- **Evidence:** Main-based lead audit LEAD-005.

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
- `SourcesPage` disabled the workspace attachment checkbox when `fetchProjects()` returned no projects, but did not expose why it was unavailable or provide the existing project-creation route. Its label also retained pointer affordance despite the disabled input.

## Workaround

- Describe any temporary mitigation and remaining risk.

## Permanent Fix Plan

- Describe the intended durable fix.
- When no project is available, render a labeled status explanation beside the disabled attachment option and link to the Home page's `#project-create` recovery flow. Remove the pointer cursor from the unavailable control.

## Regression Coverage Needed

- List tests, fixtures, reproductions, alerts, or docs updates needed.
- `sources-page.test.tsx` renders the shared recovery explanation and asserts its status semantics, clear reason, and `/#project-create` action.

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
- 2026-08-04 - Fixed: unavailable project attachment now explains the prerequisite and links to Add a project; focused page test and web typecheck pass.
