---
note_type: bug
template_version: 2
contract_version: 1
title: Project sidebar section label fails contrast in both themes
bug_id: BUG-0065
status: fixed
severity: sev-2
category: accessibility
reported_on: '2026-07-28'
fixed_on: '2026-07-30'
owner: bug-0065-attempt-1
created: '2026-07-28'
updated: '2026-07-30'
related_notes:
  - '[[02_Phases/Phase_10_v1_usable_research_workspace/Steps/Step_07_complete-responsive-accessibility-and-theme-behavior|STEP-10-07 Complete Responsive Accessibility and Theme Behavior]]'
  - '[[05_Sessions/2026-07-28-204323-complete-responsive-accessibility-and-theme-behavior-codex|SESSION-2026-07-28-204323 Codex session for Complete Responsive Accessibility and Theme Behavior]]'
tags:
  - agent-vault
  - bug
---

# BUG-0065 - Project sidebar section label fails contrast in both themes

Use one note per bug. Capture reproduction, impact, root cause, workaround, and verification, then link back to the relevant phase, step, decision, or session. See [[07_Templates/Note_Contracts|Note Contracts]].

## Summary

- Project sidebar section label fails contrast in both themes.
- Related notes: [[02_Phases/Phase_10_v1_usable_research_workspace/Steps/Step_07_complete-responsive-accessibility-and-theme-behavior|STEP-10-07 Complete Responsive Accessibility and Theme Behavior]], [[05_Sessions/2026-07-28-204323-complete-responsive-accessibility-and-theme-behavior-codex|SESSION-2026-07-28-204323 Codex session for Complete Responsive Accessibility and Theme Behavior]].
- **Observed:** The 12px `Project` `.menu-title` measures 2.55:1 in light mode and 3.32:1 in dark mode, below WCAG AA 4.5:1, across project Conversation, Sources, Notes, Research, and Citation states.
- **Expected:** The semantic label color meets at least 4.5:1 in each theme.
- **Reproduction:** Open any project route in light/dark at desktop or tablet and run axe.
- **Evidence:** `.local/ui-audit/light/report.md` L-02 and `.local/ui-audit/dark/report.md` ISSUE-003.

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

## Workaround

- Describe any temporary mitigation and remaining risk.

## Permanent Fix Plan

- Describe the intended durable fix.

## Regression Coverage Needed

- List tests, fixtures, reproductions, alerts, or docs updates needed.
- Added `apps/web/src/menu-title-contrast.test.ts`: parses the real brand tokens and the `.menu-title` override from `index.css`, resolves the color per theme, and asserts WCAG contrast ≥ 4.5:1 against `--struct-surface` in both `struct-light` and `struct-dark`. Fails fast if the override is removed or a token drops below AA.
- Existing `apps/web/src/components/workspace/workspace-shell.test.tsx` still asserts the `.menu-title` "Project" label renders inside the ordered nav.
- E2e `apps/web/e2e/workspace-accessibility.spec.ts` already exercises `.app-shell` brand contrast in both themes; the override improves that path.

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
- 2026-07-28 - Reported.
- 2026-07-30 - Fixed by bug-0065-attempt-1. Root cause: un-overridden DaisyUI `.menu-title` 40% alpha default. Fix: `.app-shell .menu-title { color: var(--struct-muted); }` in `apps/web/src/index.css` (7.56:1 light / 7.10:1 dark). Added `apps/web/src/menu-title-contrast.test.ts` regression coverage. Verified: 87 web unit tests pass, typecheck + lint clean, production build compiles with the override winning the cascade.
