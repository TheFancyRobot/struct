---
note_type: bug
template_version: 2
contract_version: 1
title: "<bug title>"
bug_id: "BUG-0000"
status: new
severity: sev-3
category: logic
reported_on: "YYYY-MM-DD"
fixed_on: ""
owner: ""
created: "YYYY-MM-DD"
updated: "YYYY-MM-DD"
related_notes: []
tags:
  - agent-vault
  - bug
---

# Bug Template

Use one note per bug. Capture reproduction, impact, root cause, workaround, and verification, then link back to the relevant phase, step, decision, or session. See [[07_Templates/Note_Contracts|Note Contracts]].

## Summary

- State the defect and affected workflow, command, or component.

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

## Related Notes

<!-- AGENT-START:bug-related-notes -->
- Phase: [[02_Phases/<phase path>/Phase|<phase name>]]
- Decision: [[04_Decisions/<decision note>|<decision note>]]
- Session: [[05_Sessions/<session note>|<session note>]]
<!-- AGENT-END:bug-related-notes -->

## Timeline

<!-- AGENT-START:bug-timeline -->
- YYYY-MM-DD - Reported.
- YYYY-MM-DD - Investigation updated.
- YYYY-MM-DD - Fixed and awaiting verification.
<!-- AGENT-END:bug-timeline -->
