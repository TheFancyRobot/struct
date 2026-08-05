---
note_type: bug
template_version: 2
contract_version: 1
title: Workspace skip link falls below the touch-target baseline
bug_id: BUG-0113
status: fixed
severity: sev-3
category: logic
reported_on: '2026-08-05'
fixed_on: '2026-08-05'
owner: ''
created: '2026-08-05'
updated: '2026-08-05'
related_notes: []
tags:
  - agent-vault
  - bug
---

# BUG-0113 - Workspace skip link falls below the touch-target baseline

Use one note per bug. Capture reproduction, impact, root cause, workaround, and verification, then link back to the relevant phase, step, decision, or session. See [[07_Templates/Note_Contracts|Note Contracts]].

## Summary

- Workspace skip link falls below the touch-target baseline.
- Related notes: none linked yet.

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
- Tailwind's `sr-only` utility reduced the skip link to a 1px × 1px off-screen box. The workspace mobile accessibility gate evaluates all in-document links, including this visually hidden link, and correctly reported it below the 44px touch-target baseline.

## Workaround

- Describe any temporary mitigation and remaining risk.

## Permanent Fix Plan

- Describe the intended durable fix.
- Added the `workspace-skip-link` class with explicit 2.75rem height and minimum width in the unlayered workspace stylesheet, overriding the `sr-only` 1px box while retaining the existing focus-visible skip-link presentation and `#workspace-main` destination.

## Regression Coverage Needed

- List tests, fixtures, reproductions, alerts, or docs updates needed.
- Added browser coverage that focuses and measures the skip link at the mobile baseline and verifies its `#workspace-main` destination. The existing full mobile accessibility audit also now validates the hidden link's 44px × 44px box.

## Related Notes

<!-- AGENT-START:bug-related-notes -->
- None yet.
<!-- AGENT-END:bug-related-notes -->

## Timeline

<!-- AGENT-START:bug-timeline -->
- 2026-08-05 - Reported.
<!-- AGENT-END:bug-timeline -->
- 2026-08-05 - Confirmed the 1px `sr-only` hit box, implemented the 44px override, and verified the targeted browser regression.
