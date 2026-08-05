---
note_type: bug
template_version: 2
contract_version: 1
title: Inference settings review feedback leaves runtime configuration incomplete
bug_id: BUG-0127
status: fixed
severity: sev-3
category: logic
reported_on: '2026-08-05'
fixed_on: '2026-08-05'
owner: ''
created: '2026-08-05'
updated: '2026-08-05'
related_notes: |-
  - '[[03_Bugs/BUG-0120_ui-lacks-inference-provider-and-model-configuration|BUG-0120]]'
  - '[[02_Phases/Phase_10_v1_usable_research_workspace/Phase|PHASE-10 v1 Usable Research Workspace]]'
  - '[[02_Phases/Phase_05_typed_research_planning_and_bounded_execution/Steps/Step_03_implement-bounded-graph-orchestration-and-model-routing|STEP-05-03 Implement Bounded Graph Orchestration and Model Routing]]'
tags:
  - agent-vault
  - bug
---

# BUG-0127 - Inference settings review feedback leaves runtime configuration incomplete

Use one note per bug. Capture reproduction, impact, root cause, workaround, and verification, then link back to the relevant phase, step, decision, or session. See [[07_Templates/Note_Contracts|Note Contracts]].

## Summary

- Inference settings review feedback leaves runtime configuration incomplete.
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
- Persisted provider references were never resolved at a server runtime boundary, so runtime routing discarded endpoint and credential configuration. The Test action was fail-closed without a real check; assignments and blank endpoints also lacked complete persistence semantics.

## Workaround

- Describe any temporary mitigation and remaining risk.

## Permanent Fix Plan

- Describe the intended durable fix.

## Regression Coverage Needed

- List tests, fixtures, reproductions, alerts, or docs updates needed.
- Covered server-only `env://NAME` resolution, authenticated connection testing, blank endpoint normalization, assignment clearing, and runtime lookup fallback.

## Related Notes

<!-- AGENT-START:bug-related-notes -->
- None yet.
<!-- AGENT-END:bug-related-notes -->

## Timeline

<!-- AGENT-START:bug-timeline -->
- 2026-08-05 - Reported.
<!-- AGENT-END:bug-timeline -->
- 2026-08-05 - Fixed: server-side credential resolution now configures Fred runtime and authenticated provider checks; workspace FKs, assignment clearing, endpoint normalization, and resilient fallback are covered by focused tests.
