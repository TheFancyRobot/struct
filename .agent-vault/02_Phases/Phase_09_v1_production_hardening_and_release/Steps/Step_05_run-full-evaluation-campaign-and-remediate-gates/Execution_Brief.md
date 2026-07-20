# Execution Brief

## Exact Outcome

- Compose and run one reproducible v1 release-gate campaign over all shipped capability and hardening evidence.
- Remediate every confirmed regression and commit a deterministic result artifact with zero failed criteria.

## Prerequisites

- STEP-09-04 and all preceding hardening steps are reviewed and merged with no known confirmed defect.
- Baseline includes the Phase 08 26/26 evaluator, 754 unit tests, 112 PostgreSQL/data-engine integration tests, and independently passing Playwright suites.

## Planned Starting Files

- Existing `packages/evaluation/src/run-phase-*` runners, report-fidelity runner, corpus utilities, and versioned results
- `packages/evaluation/src/benchmarks/run.ts` and root package scripts
- Existing Playwright suites in `apps/web/e2e/`
- `docs/evaluation-strategy.md`, `docs/evaluation-corpus.md`, and phase benchmark reports

## Required Reading

- [[02_Phases/Phase_09_v1_production_hardening_and_release/Phase|Phase 09]]
- [[01_Architecture/System_Overview|System Overview]]
- [[04_Decisions/DEC-0011_gate-releases-on-a-reproducible-25000-file-evaluation-corpus|DEC-0011]]
- STEP-09-01 through STEP-09-04 outcomes.

## Concrete Deliverables

- One bounded command composing—not duplicating—document, directory, SQL, planning, recursive, hybrid, report/provenance, security, recovery, performance, and accessibility gates.
- Versioned deterministic machine-readable result plus concise report including environment and artifact hashes.
- Remediation log for every observed failure; only confirmed product defects are fixed, with affected callers/tests reviewed in the same round.
- Zero-failure evidence across unit, PostgreSQL/data-engine integration, isolated Playwright, build, lint, boundaries, docs, secrets, and vault.

## Smallest Bounded Checklist

- Run each component gate in a clean reproducible environment and classify failures before changing code.
- Remediate confirmed defects, rerun the affected gate, then rerun the composite campaign.
- Confirm the 25,000-file corpus and every versioned evaluator threshold appear exactly once.
- Self-review the runner, hashes, thresholds, and remediation diff before PR.

## Constraints and Non-Goals

- Do not weaken thresholds, skip unavailable services silently, hand-edit generated results, or add a second evaluation framework.
- Keep existing Bun/Compose runtime boundaries and avoid compatibility/data-migration scope.
- Use Effect/SolidJS skills when touched; advance only with zero known confirmed defects.

## Related Notes

- [[02_Phases/Phase_09_v1_production_hardening_and_release/Steps/Step_05_run-full-evaluation-campaign-and-remediate-gates|STEP-09-05]]
- [[04_Decisions/DEC-0011_gate-releases-on-a-reproducible-25000-file-evaluation-corpus|DEC-0011]]
