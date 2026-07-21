# Implementation Notes

- Capture durable findings learned during execution. Prefer short bullets with file paths, commands, and observed behavior.

- Added `scripts/v1-evaluation-campaign.ts` and root `v1:evaluate`, composing
  23 unique capability, hardening, recovery, UI, and static gates without
  duplicating the Phase 02–08 owner evaluators.
- Added deterministic versioned evidence at
  `packages/evaluation/results/v1-evaluation-campaign-v1.json`, including
  environment, source, evaluator, remediation, manifest, lockfile, and Compose
  hashes.
- Fixed recovery cleanup by preparing the active artifact root and
  force-recreating Compose services when bind mounts change.
- Fixed intermittent screenshot setup with one bounded computed-style
  readiness helper shared by all responsive theme matrices.
- Strengthened the campaign lint gate to fail on warnings.

## Related Notes

- Step: [[02_Phases/Phase_09_v1_production_hardening_and_release/Steps/Step_05_run-full-evaluation-campaign-and-remediate-gates|STEP-09-05 Run Full Evaluation Campaign and Remediate Gates]]
- Phase: [[02_Phases/Phase_09_v1_production_hardening_and_release/Phase|Phase 09 v1 production hardening and release]]
