---
note_type: bug
template_version: 2
contract_version: 1
title: Source attachment checkboxes have indistinguishable accessible names
bug_id: BUG-0068
status: fixed
severity: sev-2
category: accessibility
reported_on: '2026-07-28'
fixed_on: '2026-07-30'
owner: root-orchestrator
created: '2026-07-28'
updated: '2026-07-30'
related_notes:
  - '[[02_Phases/Phase_10_v1_usable_research_workspace/Steps/Step_07_complete-responsive-accessibility-and-theme-behavior|STEP-10-07 Complete Responsive Accessibility and Theme Behavior]]'
  - '[[05_Sessions/2026-07-28-204323-complete-responsive-accessibility-and-theme-behavior-codex|SESSION-2026-07-28-204323 Codex session for Complete Responsive Accessibility and Theme Behavior]]'
tags:
  - agent-vault
  - bug
---

# BUG-0068 - Source attachment checkboxes have indistinguishable accessible names

Use one note per bug. Capture reproduction, impact, root cause, workaround, and verification, then link back to the relevant phase, step, decision, or session. See [[07_Templates/Note_Contracts|Note Contracts]].

## Summary

- Before the fix, source attachment checkboxes had indistinguishable accessible names.
- Related notes: [[02_Phases/Phase_10_v1_usable_research_workspace/Steps/Step_07_complete-responsive-accessibility-and-theme-behavior|STEP-10-07 Complete Responsive Accessibility and Theme Behavior]], [[05_Sessions/2026-07-28-204323-complete-responsive-accessibility-and-theme-behavior-codex|SESSION-2026-07-28-204323 Codex session for Complete Responsive Accessibility and Theme Behavior]].
- **Observed:** Before the fix, every global source row exposed a checkbox named only `Use in project`; two sources produced two identical checkbox names without source or project identity.
- **Expected:** Include source and target project in each accessible name for screen-reader and voice-control users.
- **Reproduction:** Load two sources on `/sources` and inspect the interactive accessibility tree.
- **Evidence:** `.local/ui-audit/lead/screenshots/source-library-identical-checkbox-labels.png`.

## Observed Behavior

- Before the fix, every global source row on `/sources` exposed a checkbox with the same literal label `Use in project`; two sources produced two identical accessible names with no source or project identity, so rows were indistinguishable to screen-reader and voice-control users.

## Expected Behavior

- Each checkbox accessible name includes the source name (with stable source ID) plus the target project name, so duplicate source names remain distinguishable.

## Reproduction Steps

1. Start the web app and open `/sources`.
2. Load two sources, including two with the same source name.
3. Inspect the interactive accessibility tree — before the fix, this exposed two checkboxes both named `Use in project` (see `.local/ui-audit/lead/screenshots/source-library-identical-checkbox-labels.png`); the fixed app now uses source-ID-qualified accessible names.

## Scope / Blast Radius

- Web app `/sources` source library global source rows. Affects screen-reader and voice-control users identifying which source to attach; no backend or other routes impacted.

## Suspected Root Cause

- Source attachment checkboxes inherited a static literal `Use in project` label without source or project identity.

## Confirmed Root Cause

- Each checkbox inherited the same literal `Use in project` label. The source and selected-project names were not included, and source names are not unique.

## Workaround

- No user-facing workaround existed before the fix; sighted users could distinguish rows visually, but accessible names were identical for screen-reader and voice-control users until the fix was applied.

## Permanent Fix Plan

- The library attachment checkbox label now includes source name, stable source ID, and target: `Use {source.name} ({source.sourceId}) in {selectedProject()?.name ?? 'a project'}`. This preserves visible label text while making duplicate source names distinguishable.

## Regression Coverage Needed

- `apps/web/e2e/source-import.spec.ts` loads two same-named source rows and asserts one checkbox with each source-ID-qualified accessible name.

## Related Notes

<!-- AGENT-START:bug-related-notes -->
- Phase: [[02_Phases/Phase_10_v1_usable_research_workspace/Phase|Phase 10 v1 usable research workspace]]
- Step: [[02_Phases/Phase_10_v1_usable_research_workspace/Steps/Step_07_complete-responsive-accessibility-and-theme-behavior|STEP-10-07 Complete Responsive Accessibility and Theme Behavior]]
- Session: [[05_Sessions/2026-07-28-204323-complete-responsive-accessibility-and-theme-behavior-codex|SESSION-2026-07-28-204323 Codex session for Complete Responsive Accessibility and Theme Behavior]]
<!-- AGENT-END:bug-related-notes -->

## Timeline

<!-- AGENT-START:bug-timeline -->
- 2026-07-28 - Reported.
- 2026-07-30 - Fixed with source-ID-qualified checkbox accessible names; targeted browser regression passed (7/7) and web typecheck passed.
<!-- AGENT-END:bug-timeline -->
