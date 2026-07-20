# Validation Plan

## Acceptance Checks

- Confirm the bounded deterministic cross-source normalization/reconciliation slice is callable by the next step.
- Confirm existing evidence and contradiction contracts are extended with one lossless cross-source envelope and reconciliation result.
- Confirm this deliverable is present, testable where applicable, and bounded to the step: The orchestration or synthesis rules in `packages/research-engine/src/normalize-evidence.ts`, `packages/research-engine/src/reconcile-findings.ts` without moving deterministic work out of services/tools.
- The step leaves the next dependent step with a stable typed boundary, not a placeholder or undocumented assumption.

## Planned Verification

- Planned command once these packages exist: `bun test packages/domain packages/research-engine` plus the nearest package-level `bun run typecheck`.

## Edge Cases

- Partial progress, retries, or restarts should leave this step in a typed, inspectable state rather than a silent half-success.

## Regression Expectations

- This step should remain a clean successor to [[02_Phases/Phase_07_hybrid_cross_source_research/Steps/Step_02_implement-parallel-document-and-dataset-research-branches|STEP-07-02 Implement Parallel Document and Dataset Research Branches]] rather than reworking already-planned scope upstream.
- Do not weaken dataset guardrails or document provenance while combining them in one workflow.
- Keep branch execution bounded and replayable; hybrid behavior should not turn into an untraceable super-agent.
- Maintain compatibility with later durable findings and report composition steps.

## Security / Observability / Evaluation Focus

- Ensure mixed-source prompts cannot grant wider tool access than the individual branch tools already allow.
- Keep contradiction handling and reconciliation observable enough to debug incorrect synthesis.
- Validate that final answers still cite exact SQL, rows, files, and document spans where appropriate.

## Related Notes

- Step: [[02_Phases/Phase_07_hybrid_cross_source_research/Steps/Step_03_normalize-and-reconcile-cross-source-evidence|STEP-07-03 Normalize and Reconcile Cross-Source Evidence]]
- Phase: [[02_Phases/Phase_07_hybrid_cross_source_research/Phase|Phase 07 hybrid cross source research]]

## Refined PR Gate — 2026-07-20

- Table-test units, timezones/windows, versions, filters, cohorts, denominators, unsupported joins, duplicates, stale citations, and contradictions.
- Prove immutable identities and exact snapshots/hashes/ranges survive, with deterministic ordering/IDs under input permutations.
- Prove contradictory/insufficient evidence cannot become sufficient or disappear; untrusted content remains data.
- Run focused/property tests, `bun run typecheck`, `bun run lint`, `bun run lint:imports`, full `bun test`, and vault doctor.
- Inspect all consumers for lossy serialization, casts, guessed transformations, provenance gaps, injection, and secrets. Zero known defects may remain.
