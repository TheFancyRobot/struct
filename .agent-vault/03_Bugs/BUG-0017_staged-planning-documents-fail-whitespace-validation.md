---
note_type: bug
template_version: 2
contract_version: 1
title: Staged planning documents fail whitespace validation
bug_id: BUG-0017
status: fixed
severity: sev-3
category: logic
reported_on: '2026-07-21'
fixed_on: '2026-07-21'
owner: bug-0017-worker-2
created: '2026-07-21'
updated: '2026-07-21'
related_notes:
  - '[[02_Phases/Phase_09_v1_production_hardening_and_release/Steps/Step_06_publish-v1-documentation-accessibility-and-release-checklist|STEP-09-06 Publish v1 Documentation Accessibility and Release Checklist]]'
tags:
  - agent-vault
  - bug
---

# BUG-0017 - Staged planning documents fail whitespace validation

Use one note per bug. Capture reproduction, impact, root cause, workaround, and verification, then link back to the relevant phase, step, decision, or session. See [[07_Templates/Note_Contracts|Note Contracts]].

## Summary

- Staged planning documents fail whitespace validation.
- Related notes: [[02_Phases/Phase_09_v1_production_hardening_and_release/Steps/Step_06_publish-v1-documentation-accessibility-and-release-checklist|STEP-09-06 Publish v1 Documentation Accessibility and Release Checklist]].

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
- Newly added Phase 10 step notes, one BUG-0013 session note, and two `docs/superpowers` Markdown documents were staged with trailing spaces, including Markdown hard-break spaces in document metadata lines and blank trailing whitespace in note fields.
- Verification on 2026-07-21: `rg -n --color=never '[[:blank:]]+$'` across the 11 reported paths returned no matches.

## Workaround

- Describe any temporary mitigation and remaining risk.

## Permanent Fix Plan

- Describe the intended durable fix.

## Regression Coverage Needed

- List tests, fixtures, reproductions, alerts, or docs updates needed.

## Related Notes

<!-- AGENT-START:bug-related-notes -->
- Phase: [[02_Phases/Phase_09_v1_production_hardening_and_release/Phase|Phase 09 v1 production hardening and release]]
- Step: [[02_Phases/Phase_09_v1_production_hardening_and_release/Steps/Step_06_publish-v1-documentation-accessibility-and-release-checklist|STEP-09-06 Publish v1 Documentation Accessibility and Release Checklist]]
<!-- AGENT-END:bug-related-notes -->

## Timeline

<!-- AGENT-START:bug-timeline -->
- 2026-07-21 - Reported.
<!-- AGENT-END:bug-timeline -->
- 2026-07-21 - Fixed the remaining `docs/superpowers/plans/2026-07-21-unified-research-workspace-implementation.md` EOF blank line so the file ends with exactly one terminating newline.
- 2026-07-21 - Validation: `git diff --cached --check` reported `docs/superpowers/plans/2026-07-21-unified-research-workspace-implementation.md:227: new blank line at EOF` before the fix and passed after removing that final blank line.
