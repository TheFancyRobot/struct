# Validation Plan

## Acceptance Checks

- One bounded v1 command composes every shipped phase evaluator and hardening gate exactly once, including the 25,000-file corpus.
- Machine-readable results are deterministic, versioned, hashed, environment-qualified, and contain zero failed criteria.
- Any observed failure has a classification and remediation record; only confirmed product defects trigger code changes.
- Unit, PostgreSQL/data-engine integration, isolated Playwright, build, lint, boundaries, docs, secrets, and vault validation are all clean.

## Planned Verification

- Run each component gate from a clean reproducible environment, then run the composite campaign twice and compare deterministic fields/hashes.
- Validate report schema, threshold inventory, artifact provenance, environment metadata, and failure exit status.
- For each remediation, rerun the narrow failure, affected suite, and full campaign; self-review affected callers before PR.

## Edge Cases

- Unavailable Compose dependency, stale artifact, partial run, duplicate evaluator, unsupported environment, nondeterministic timestamps/order, and timeout.
- A flaky harness signal must be reproduced and classified before any product change.

## Regression Expectations

- The Phase 08 canonical 26/26 report result and all earlier versioned evaluator thresholds remain intact.
- Thresholds cannot be weakened, failures cannot be skipped silently, and generated pass artifacts cannot be hand-edited.
- Existing runners are composed rather than duplicated into a second evaluation framework.

## Security / Observability / Evaluation Focus

- The final artifact contains no secrets or source-sensitive payloads and links every result to reproducible evidence.
- Any confirmed defect blocks the zero-defect gate; review-bot claims are verified before repair.
- Final pass evidence is sufficient for STEP-09-06 to document release readiness without rerationalizing failures.

## Related Notes

- [[02_Phases/Phase_09_v1_production_hardening_and_release/Steps/Step_05_run-full-evaluation-campaign-and-remediate-gates|STEP-09-05]]
- [[04_Decisions/DEC-0011_gate-releases-on-a-reproducible-25000-file-evaluation-corpus|DEC-0011]]
