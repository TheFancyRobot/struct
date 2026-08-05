---
note_type: bug
template_version: 2
contract_version: 1
title: Vault link metadata and managed blocks drift from their contract
bug_id: BUG-0124
status: fixed
severity: sev-3
category: logic
reported_on: '2026-08-05'
fixed_on: '2026-08-05'
owner: bug-0124-attempt-1
created: '2026-08-05'
updated: '2026-08-05'
related_notes:
  - '[[02_Phases/Phase_09_v1_production_hardening_and_release/Phase|PHASE-09 v1 Production Hardening and Release]]'
  - '[[02_Phases/Phase_11_v1_1_research_usability/Phase|Phase 11 v1.1 Research Usability]]'
  - '[[03_Bugs/BUG-0121_canonical-v1-performance-resilience-report-hashes-are-stale|BUG-0121 Canonical v1 performance resilience report hashes are stale]]'
  - '[[03_Bugs/BUG-0122_full-test-suite-leaks-persistence-ownership-state-across-integration-tests|BUG-0122 Full test suite leaks persistence ownership state across integration tests]]'
  - '[[03_Bugs/BUG-0123_phase-11-status-conflicts-with-the-active-context|BUG-0123 Phase 11 status conflicts with the active context]]'
tags:
  - agent-vault
  - bug
---

# BUG-0124 - Vault link metadata and managed blocks drift from their contract

Use one note per bug. Capture reproduction, impact, root cause, workaround, and verification, then link back to the relevant phase, step, decision, or session. See [[07_Templates/Note_Contracts|Note Contracts]].

## Summary

- Vault link metadata and managed blocks drifted from their contract.
- Related notes: PHASE-09, Phase 11, BUG-0121, BUG-0122, and BUG-0123.

## Observed Behavior

- Relationship frontmatter was serialized as scalars instead of YAML lists, and linked bugs appeared outside their managed blocks.

## Expected Behavior

- Relationship frontmatter uses YAML lists and each generated relationship stays inside its managed block.

## Reproduction Steps

1. Inspect Phase 09, Phase 11, and BUG-0121 through BUG-0123.
2. Compare their relationship frontmatter and managed blocks with the note contracts.
3. Observe scalar collections and unmanaged relationship entries.

## Scope / Blast Radius

- Affects Agent Vault relationship metadata and generated phase/bug relationship blocks.

## Suspected Root Cause

- A prior bounded mutation serialized list values as block scalars and appended one Phase 11 relationship outside its generated block.

## Confirmed Root Cause

- The note contracts require list collections and generated relationship blocks; the affected notes used scalar values or entries after the end marker.

## Workaround

- None; metadata is corrected in place.

## Permanent Fix Plan

- Normalize the affected collections to YAML lists and place each relationship inside its matching managed block.

## Regression Coverage Needed

- Run Vault validation and the documentation linter.

## Related Notes

<!-- AGENT-START:bug-related-notes -->
- Phase: [[02_Phases/Phase_09_v1_production_hardening_and_release/Phase|PHASE-09 v1 Production Hardening and Release]]
- Phase: [[02_Phases/Phase_11_v1_1_research_usability/Phase|Phase 11 v1.1 Research Usability]]
- Related bugs: [[03_Bugs/BUG-0121_canonical-v1-performance-resilience-report-hashes-are-stale|BUG-0121]], [[03_Bugs/BUG-0122_full-test-suite-leaks-persistence-ownership-state-across-integration-tests|BUG-0122]], and [[03_Bugs/BUG-0123_phase-11-status-conflicts-with-the-active-context|BUG-0123]]
<!-- AGENT-END:bug-related-notes -->

## Timeline

<!-- AGENT-START:bug-timeline -->
- 2026-08-05 - Reported.
<!-- AGENT-END:bug-timeline -->
- 2026-08-05 - Fixed: normalized affected relationship collections to YAML lists, restored managed-block membership, and aligned Phase 11 with its planned, unblocked state. Vault validation and docs lint pass.
