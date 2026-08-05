---
note_type: bug
template_version: 2
contract_version: 1
title: Lint gate fails on unused frontend imports
bug_id: BUG-0117
status: fixed
severity: sev-3
category: tooling
reported_on: '2026-08-05'
fixed_on: '2026-08-05'
owner: bug0117_attempt1
created: '2026-08-05'
updated: '2026-08-05'
related_notes:
  - '[[02_Phases/Phase_10_v1_usable_research_workspace/Steps/Step_08_gate-v1-on-the-complete-browser-journey|STEP-10-08 Gate v1 on the Complete Browser Journey]]'
tags:
  - agent-vault
  - bug
---

# BUG-0117 - Lint gate fails on unused frontend imports

Use one note per bug. Capture reproduction, impact, root cause, workaround, and verification, then link back to the relevant phase, step, decision, or session. See [[07_Templates/Note_Contracts|Note Contracts]].

## Summary

- Lint gate fails on unused frontend imports.
- Related notes: [[02_Phases/Phase_10_v1_usable_research_workspace/Steps/Step_08_gate-v1-on-the-complete-browser-journey|STEP-10-08 Gate v1 on the Complete Browser Journey]].

## Observed Behavior

- `bun run lint` reports `ResearchEvent` and `NotFoundPage` as unused despite their type-only and JSX usages.

## Expected Behavior

- The lint gate passes without disabling unused-variable checks for unrelated code.

## Reproduction Steps

1. Run `bun run lint` from the repository root.
2. Observe false-positive `no-unused-vars` warnings for the type-only `ResearchEvent` import and Solid JSX `NotFoundPage` import.

## Scope / Blast Radius

- List affected packages, commands, integrations, environments, or users.

## Suspected Root Cause

- Record current theories and assumptions.

## Confirmed Root Cause

- Record the proven cause and decisive evidence.
- ESLint uses Babel parsing and its core `no-unused-vars` rule does not recognize either TypeScript type-only imports or Solid JSX component references as usages. The two files lacked the scoped suppression already used elsewhere in the frontend.

## Workaround

- Describe any temporary mitigation and remaining risk.

## Permanent Fix Plan

- Describe the intended durable fix.
- Add file-scoped `no-unused-vars` suppressions with repository-standard explanations: one for the type-only `ResearchEvent` import and one for the Solid JSX `NotFoundPage` component import.

## Regression Coverage Needed

- List tests, fixtures, reproductions, alerts, or docs updates needed.

## Related Notes

<!-- AGENT-START:bug-related-notes -->
- Phase: [[02_Phases/Phase_10_v1_usable_research_workspace/Phase|Phase 10 v1 usable research workspace]]
- Step: [[02_Phases/Phase_10_v1_usable_research_workspace/Steps/Step_08_gate-v1-on-the-complete-browser-journey|STEP-10-08 Gate v1 on the Complete Browser Journey]]
<!-- AGENT-END:bug-related-notes -->

## Timeline

<!-- AGENT-START:bug-timeline -->
- 2026-08-05 - Reported.
<!-- AGENT-END:bug-timeline -->
- 2026-08-05: Added scoped Babel/Solid parser false-positive suppressions to `research-run-status.ts` and `not-found-page.test.tsx`. Verified `bun run lint` and `bun run typecheck` pass cleanly.
