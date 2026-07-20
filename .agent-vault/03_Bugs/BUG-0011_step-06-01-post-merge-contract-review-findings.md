---
note_type: bug
template_version: 2
contract_version: 1
title: STEP-06-01 post-merge contract review findings
bug_id: BUG-0011
status: fixed
severity: sev-3
category: logic
reported_on: '2026-07-20'
fixed_on: '2026-07-20'
owner: step-06-01-postmerge-fix
created: '2026-07-20'
updated: '2026-07-20'
related_notes:
  - '[[02_Phases/Phase_06_recursive_corpus_analysis/Steps/Step_01_define-recursive-decomposition-and-aggregation-contracts|STEP-06-01 Define Recursive Decomposition and Aggregation Contracts]]'
  - '[[05_Sessions/2026-07-20-071742-define-recursive-decomposition-and-aggregation-contracts-step-06-01-worker|SESSION-2026-07-20-071742 step-06-01-worker session for Define Recursive Decomposition and Aggregation Contracts]]'
  - '[[05_Sessions/2026-07-20-074814-define-recursive-decomposition-and-aggregation-contracts-step-06-01-postmerge-fix|SESSION-2026-07-20-074814 step-06-01-postmerge-fix session for Define Recursive Decomposition and Aggregation Contracts]]'
tags:
  - agent-vault
  - bug
---

# BUG-0011 - STEP-06-01 post-merge contract review findings

Use one note per bug. Capture reproduction, impact, root cause, workaround, and verification, then link back to the relevant phase, step, decision, or session. See [[07_Templates/Note_Contracts|Note Contracts]].

## Summary

- STEP-06-01 post-merge contract review findings.
- Related notes: [[02_Phases/Phase_06_recursive_corpus_analysis/Steps/Step_01_define-recursive-decomposition-and-aggregation-contracts|STEP-06-01 Define Recursive Decomposition and Aggregation Contracts]], [[05_Sessions/2026-07-20-071742-define-recursive-decomposition-and-aggregation-contracts-step-06-01-worker|SESSION-2026-07-20-071742 step-06-01-worker session for Define Recursive Decomposition and Aggregation Contracts]].

## Observed Behavior

- Describe what actually happens.
- Post-merge review confirmed five contract defects: resolved contradictions blocked completion; batch evidence could cite a source version outside its partition; top-level contradiction evidence could be absent from carried findings; batch coverage was not bound to the nonempty expected partition; and generated vault mirrors remained stale after STEP-06-01 merged.

## Expected Behavior

- Describe what should happen instead.
- Retain resolved contradictions for audit while only unresolved contradictions force contradictory sufficiency. Require every contradiction evidence ID to resolve to carried finding evidence, every batch evidence source version to belong to its partition, and batch coverage to account for exactly that partition and all of its entry keys. Keep STEP-06-01 marked completed/merged while this bug remains the active pre-STEP-06-02 gate until its fix PR merges.

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
- The aggregate filters treated all retained contradiction IDs as unresolved blockers, while cross-contract validation stopped at canonical hashes and did not bind result evidence or coverage to the expected partition. Top-level contradiction objects were identity-checked without verifying that their supporting and conflicting evidence IDs were present in carried findings. Generated phase/home mirrors had not been refreshed after the merged step status changed.

## Workaround

- Describe any temporary mitigation and remaining risk.

## Permanent Fix Plan

- Describe the intended durable fix.
- Merged in PR #34: sufficiency tracks exactly unresolved contradictions while all resolved contradictions remain in the auditable result; batch and aggregation reject top-level contradiction evidence not carried by findings; batch validation rejects evidence outside the expected partition and coverage whose expected item/partition counts do not match that partition.

## Regression Coverage Needed

- List tests, fixtures, reproductions, alerts, or docs updates needed.
- Added positive coverage for sufficient completed aggregation retaining a resolved contradiction and negative coverage proving the unresolved form blocks completion.
- Added negative batch/aggregation coverage for dangling top-level supporting/conflicting evidence, foreign partition source versions, incorrect expected item counts, and incorrect expected partition counts.
- Focused package tests, repository unit/static/build/docs/secrets gates, and vault doctor must remain green before merge.

## Related Notes

<!-- AGENT-START:bug-related-notes -->
- Phase: [[02_Phases/Phase_06_recursive_corpus_analysis/Phase|Phase 06 recursive corpus analysis]]
- Step: [[02_Phases/Phase_06_recursive_corpus_analysis/Steps/Step_01_define-recursive-decomposition-and-aggregation-contracts|STEP-06-01 Define Recursive Decomposition and Aggregation Contracts]]
- Session: [[05_Sessions/2026-07-20-071742-define-recursive-decomposition-and-aggregation-contracts-step-06-01-worker|SESSION-2026-07-20-071742 step-06-01-worker session for Define Recursive Decomposition and Aggregation Contracts]]
<!-- AGENT-END:bug-related-notes -->

## Timeline

<!-- AGENT-START:bug-timeline -->
- 2026-07-20 - Reported.
<!-- AGENT-END:bug-timeline -->
- 2026-07-20 - Implemented all five confirmed remediations with focused regressions; root review and merge remain before marking fixed or activating STEP-06-02.
- 2026-07-20 - PR #34 passed automated review with no actionable findings and merged into `main` as `cee9509`; BUG-0011 is fixed.
