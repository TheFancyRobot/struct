# Validation Plan

## Acceptance Checks

- Confirm this deliverable is present, testable where applicable, and bounded to the step: The narrowest typed slice for Recursive Fred Synthesis and Contradiction Handling that is callable by the next step without broadening scope.
- Confirm this deliverable is present, testable where applicable, and bounded to the step: The orchestration or synthesis rules in `packages/research-engine/src/merge-findings.ts`, `packages/research-engine/src/contradiction-detection.ts` without moving deterministic work out of services/tools.
- Confirm this deliverable is present, testable where applicable, and bounded to the step: Fred-specific graph/agent wiring isolated to `packages/workflows/src/agents/corpus-analyst.ts`, `packages/workflows/src/agents/evidence-critic.ts` and typed at every boundary.
- The step leaves the next dependent step with a stable typed boundary, not a placeholder or undocumented assumption.

## Planned Verification

- Planned command once these packages exist: `bun test packages/workflows packages/research-engine` plus the nearest package-level `bun run typecheck`.

## Edge Cases

- Partial progress, retries, or restarts should leave this step in a typed, inspectable state rather than a silent half-success.
- Cancellation, duplicate actions, replay after restart, and stale source-version assumptions should produce deterministic terminal states.

## Regression Expectations

- This step should remain a clean successor to [[02_Phases/Phase_06_recursive_corpus_analysis/Steps/Step_03_implement-deterministic-batch-extraction-and-evidence-artifacts|STEP-06-03 Implement Deterministic Batch Extraction and Evidence Artifacts]] rather than reworking already-planned scope upstream.
- Do not regress bounded execution, cancellation, or checkpoint/recovery while adding parallel corpus analysis.
- Keep minority findings and contradictions visible instead of flattening them into averages.
- Make sure large-corpus UX still points back to exact evidence rather than only synthesized prose.

## Security / Observability / Evaluation Focus

- Bound partition size, concurrency, intermediate artifact size, and model budgets before attempting 25,000-file analysis.
- Persist structured findings and evidence references so replay and audit remain possible.
- Carry prompt-injection defenses into batch extraction, partition prompts, and recursive merges.
- Evaluation should verify provenance opening paths, contradiction reporting, and prompt-injection resistance for the evidence types touched here.

## Related Notes

- Step: [[02_Phases/Phase_06_recursive_corpus_analysis/Steps/Step_04_implement-recursive-fred-synthesis-and-contradiction-handling|STEP-06-04 Implement Recursive Fred Synthesis and Contradiction Handling]]
- Phase: [[02_Phases/Phase_06_recursive_corpus_analysis/Phase|Phase 06 recursive corpus analysis]]

## Refined Acceptance and Commands

- Prove bounded prompt/artifact sizes, model-call count independent of file count at the leaf level, exact stop conditions, policy checks before calls, and no unregistered tools.
- Prove contradictions, missing/excluded evidence, coverage, confidence/quality state, and full lineage survive every aggregation level and partial terminal state.
- Exercise deterministic fake agents plus live recovery where already supported: provider/model typed failures, retry eligibility, cancellation, budget exhaustion, checkpoint resume, worker replacement, and no duplicate committed work.
- Run focused workflows/research-engine/worker/persistence/evaluation tests, `bun run --cwd apps/worker test:research-replay`, then `bun run typecheck`, `bun run test`, `bun run lint`, `bun run lint:imports`, and `bun run build`.
- Inspect Phase 05 golden traces/replay and STEP-06-02/03 identity/artifact tests for downstream regressions caused by orchestration changes.
- Confirm step/context mirrors and `vault_validate target=doctor` are clean.
