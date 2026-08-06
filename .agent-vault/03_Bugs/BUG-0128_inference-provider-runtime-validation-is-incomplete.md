---
note_type: bug
template_version: 2
contract_version: 1
title: Inference provider runtime validation is incomplete
bug_id: BUG-0128
status: fixed
severity: sev-3
category: logic
reported_on: '2026-08-06'
fixed_on: '2026-08-06'
owner: ''
created: '2026-08-06'
updated: '2026-08-06'
related_notes: '["[[03_Bugs/BUG-0127_inference-settings-review-feedback-leaves-runtime-configuration-incomplete|BUG-0127]]","[[02_Phases/Phase_10_v1_usable_research_workspace/Phase|PHASE-10 v1 Usable Research Workspace]]","[[02_Phases/Phase_05_typed_research_planning_and_bounded_execution/Steps/Step_03_implement-bounded-graph-orchestration-and-model-routing|STEP-05-03 Implement Bounded Graph Orchestration and Model Routing]]"]'
tags:
  - agent-vault
  - bug
---

# BUG-0128 - Inference provider runtime validation is incomplete

Use one note per bug. Capture reproduction, impact, root cause, workaround, and verification, then link back to the relevant phase, step, decision, or session. See [[07_Templates/Note_Contracts|Note Contracts]].

## Summary

- Inference provider runtime validation is incomplete.
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
- The shared credential resolver allowed a provider-independent key list, while API writes accepted any HTTPS endpoint and the worker passed persisted values to Fred without validating their provider pairing.

## Workaround

- Describe any temporary mitigation and remaining risk.

## Permanent Fix Plan

- Describe the intended durable fix.
- Centralize the OpenAI provider's allowed credential reference and public endpoint policy in the workflows adapter; apply it before API persistence and before worker runtime configuration.

## Regression Coverage Needed

- List tests, fixtures, reproductions, alerts, or docs updates needed.
- Cover valid configuration plus rejected unapproved endpoint and mismatched credential at the shared adapter and API route boundaries.

## Related Notes

<!-- AGENT-START:bug-related-notes -->
- None yet.
<!-- AGENT-END:bug-related-notes -->

## Timeline

<!-- AGENT-START:bug-timeline -->
- 2026-08-06 - Reported.
<!-- AGENT-END:bug-timeline -->
- 2026-08-06 - Fixed: provider-specific credential and approved-endpoint validation now applies before persistence and worker runtime configuration.
