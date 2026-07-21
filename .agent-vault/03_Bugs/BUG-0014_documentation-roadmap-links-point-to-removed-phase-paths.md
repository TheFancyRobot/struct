---
note_type: bug
template_version: 2
contract_version: 1
title: Documentation roadmap links point to removed phase paths
bug_id: BUG-0014
status: fixed
severity: sev-3
category: logic
reported_on: '2026-07-21'
fixed_on: '2026-07-21'
owner: orchestrator
created: '2026-07-21'
updated: '2026-07-21'
related_notes:
  - '[[02_Phases/Phase_09_v1_production_hardening_and_release/Steps/Step_06_publish-v1-documentation-accessibility-and-release-checklist|STEP-09-06 Publish v1 Documentation Accessibility and Release Checklist]]'
tags:
  - agent-vault
  - bug
---

# BUG-0014 - Documentation roadmap links point to removed phase paths

Use one note per bug. Capture reproduction, impact, root cause, workaround, and verification, then link back to the relevant phase, step, decision, or session. See [[07_Templates/Note_Contracts|Note Contracts]].

## Summary

- Documentation roadmap links point to removed phase paths.
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
Phase 10's directory was renamed from `Phase_10_v1_1_research_usability` to `Phase_10_v1_usable_research_workspace`, and every post-v1 phase (10–15) was renumbered/relabelled by one slot during vault refinement. `docs/roadmap.md` and `docs/implementation-plan.md` still referenced the pre-refactor directory names for PHASE-10 through PHASE-15, producing six broken relative links in each file (12 total broken links).

Affected broken links (identical in both files):
- `Phase_10_v1_1_research_usability` → should be `Phase_10_v1_usable_research_workspace`
- `Phase_11_v1_2_additional_sources` → should be `Phase_11_v1_1_research_usability`
- `Phase_12_v1_3_continuous_research` → should be `Phase_12_v1_2_additional_sources`
- `Phase_13_v1_4_collaboration_and_governance` → should be `Phase_13_v1_3_continuous_research`
- `Phase_14_v1_5_advanced_research` → should be `Phase_14_v1_4_collaboration_and_governance`
- `Phase_15_v2_scaled_research_platform` → should be `Phase_15_v1_5_advanced_research`

## Workaround

- Describe any temporary mitigation and remaining risk.

## Permanent Fix Plan

- Describe the intended durable fix.

## Regression Coverage Needed

- List tests, fixtures, reproductions, alerts, or docs updates needed.
- `bun run docs:lint` validates all 62 Markdown local links — passes.
- `vault_validate` (all four checks) passes with 0 errors across 584 notes.
- All 6 corrected Phase.md paths confirmed to exist on disk.

## Related Notes

<!-- AGENT-START:bug-related-notes -->
- Phase: [[02_Phases/Phase_09_v1_production_hardening_and_release/Phase|Phase 09 v1 production hardening and release]]
- Step: [[02_Phases/Phase_09_v1_production_hardening_and_release/Steps/Step_06_publish-v1-documentation-accessibility-and-release-checklist|STEP-09-06 Publish v1 Documentation Accessibility and Release Checklist]]
<!-- AGENT-END:bug-related-notes -->

## Timeline

<!-- AGENT-START:bug-timeline -->
- 2026-07-21 - Reported.
- 2026-07-21 - Diagnosed, fixed, and validated. Status: fixed.
<!-- AGENT-END:bug-timeline -->
