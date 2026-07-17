# Validation Plan

## Acceptance Checks

- Confirm this deliverable is present, testable where applicable, and bounded to the step: Evaluate 25,000-file recursive analysis for correctness, bounded cost, resume behavior, and minority-finding retention.
- Confirm this deliverable is present, testable where applicable, and bounded to the step: Benchmark and recovery evidence that shows large-corpus analysis can be interrupted and resumed without losing coverage state.
- Confirm this deliverable is present, testable where applicable, and bounded to the step: The remaining scale blockers, especially around partition skew, checkpoint size, and contradiction handling.
- The output includes a clear pass/fail signal, recorded defects or blockers, and the next action for anything intentionally left unresolved.

## Planned Verification

- Plan scale tests that run representative large-corpus analysis, intentionally interrupt it, and verify resumed coverage/finding counts.
- Plan regression checks that compare recursive findings against deterministic ground truth where exact labels or counts are known.
- Planned command once these packages exist: `bun test packages/evaluation` plus the nearest package-level `bun run typecheck`.
- Planned app/integration coverage once the app surfaces exist: `bun test apps/worker` for the API/worker/web path touched here.

## Edge Cases

- A fast but coverage-poor run should fail the plan even if the final narrative sounds plausible.
- Checkpoint/recovery tests need to include interrupted merge stages, not just interrupted leaf partitions.
- The evaluation should expose how minority findings are preserved when majority patterns dominate the corpus.

## Regression Expectations

- This step should remain a clean successor to [[02_Phases/Phase_06_recursive_corpus_analysis/Steps/Step_05_add-progress-drilldown-and-partial-result-ux|STEP-06-05 Add Progress Drilldown and Partial Result UX]] rather than reworking already-planned scope upstream.
- Do not regress bounded execution, cancellation, or checkpoint/recovery while adding parallel corpus analysis.
- Keep minority findings and contradictions visible instead of flattening them into averages.
- Make sure large-corpus UX still points back to exact evidence rather than only synthesized prose.

## Security / Observability / Evaluation Focus

- Bound partition size, concurrency, intermediate artifact size, and model budgets before attempting 25,000-file analysis.
- Persist structured findings and evidence references so replay and audit remain possible.
- Carry prompt-injection defenses into batch extraction, partition prompts, and recursive merges.
- Trace every restart, cancel, and replay decision with run/step identifiers so operators can reconstruct the timeline after failure.

## Related Notes

- Step: [[02_Phases/Phase_06_recursive_corpus_analysis/Steps/Step_06_evaluate-25000-file-recursive-analysis-and-recovery|STEP-06-06 Evaluate 25000-File Recursive Analysis and Recovery]]
- Phase: [[02_Phases/Phase_06_recursive_corpus_analysis/Phase|Phase 06 recursive corpus analysis]]
