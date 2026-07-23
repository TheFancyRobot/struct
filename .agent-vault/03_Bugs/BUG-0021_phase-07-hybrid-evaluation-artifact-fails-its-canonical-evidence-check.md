---
note_type: bug
template_version: 2
contract_version: 1
title: Phase 07 Hybrid Evaluation Artifact Fails Its Canonical Evidence Check
bug_id: BUG-0021
status: resolved
severity: sev-3
category: logic
reported_on: '2026-07-22'
fixed_on: '2026-07-22'
owner: root-orchestrator
created: '2026-07-22'
updated: '2026-07-22'
related_notes:
  - '[[02_Phases/Phase_07_hybrid_cross_source_research/Steps/Step_03_normalize-and-reconcile-cross-source-evidence|STEP-07-03 Normalize and Reconcile Cross-Source Evidence]]'
tags:
  - agent-vault
  - bug
---

# BUG-0021 - Phase 07 Hybrid Evaluation Artifact Fails Its Canonical Evidence Check

Use one note per bug. Capture reproduction, impact, root cause, workaround, and verification, then link back to the relevant phase, step, decision, or session. See [[07_Templates/Note_Contracts|Note Contracts]].

## Summary

- Phase 07 Hybrid Evaluation Artifact Fails Its Canonical Evidence Check.
- Related notes: [[02_Phases/Phase_07_hybrid_cross_source_research/Steps/Step_03_normalize-and-reconcile-cross-source-evidence|STEP-07-03 Normalize and Reconcile Cross-Source Evidence]].

## Observed Behavior

- Describe what actually happens.
- `bun packages/evaluation/src/run-phase-07-hybrid-evaluation.ts --check` fails deterministically with `Phase 07 hybrid evaluation report evidence is invalid`.
- A current canonical evaluation serialized to `/tmp/phase07-expected.json` differs only in two criterion evidence IDs, derived provenance hash, and report hash from the tracked artifact.

## Expected Behavior

- Describe what should happen instead.
- The tracked Phase 07 artifact must equal the current canonical evaluation and pass `run-phase-07-hybrid-evaluation.ts --check`.

## Reproduction Steps

1. List the exact setup state.
2. List the user or developer actions.
3. Record the observed result.
4. Run `bun packages/evaluation/src/run-phase-07-hybrid-evaluation.ts --check` from the repository root.
5. Observe the evidence-invalid failure.

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
Regenerated the artifact with its canonical generator and added a regression assertion that tracked bytes equal fresh deterministic serialization.

## Regression Coverage Needed

- List tests, fixtures, reproductions, alerts, or docs updates needed.

## Related Notes

<!-- AGENT-START:bug-related-notes -->
- Phase: [[02_Phases/Phase_07_hybrid_cross_source_research/Phase|Phase 07 hybrid cross source research]]
- Step: [[02_Phases/Phase_07_hybrid_cross_source_research/Steps/Step_03_normalize-and-reconcile-cross-source-evidence|STEP-07-03 Normalize and Reconcile Cross-Source Evidence]]
<!-- AGENT-END:bug-related-notes -->

## Timeline

<!-- AGENT-START:bug-timeline -->
- 2026-07-22 - Reported.
- 2026-07-22 - Resolved by regenerating the tracked artifact from the canonical Phase 07 generator and keeping a regression assertion that committed bytes equal fresh deterministic serialization.
- 2026-07-22 - Verified with `bun packages/evaluation/src/run-phase-07-hybrid-evaluation.ts --check`.
<!-- AGENT-END:bug-timeline -->
