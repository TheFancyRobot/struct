# Validation Plan

## Acceptance Checks

- Confirm this deliverable is present, testable where applicable, and bounded to the step: The narrowest typed slice for Progress Drilldown and Partial Result UX that is callable by the next step without broadening scope.
- Confirm this deliverable is present, testable where applicable, and bounded to the step: Only the minimal API surface in `apps/api/src/routes/recursive-analysis.ts`, `apps/api/src/routes/research-events.ts` needed to exercise this step end to end.
- Confirm this deliverable is present, testable where applicable, and bounded to the step: `apps/web/src/components/RecursiveRunTimeline.tsx`, `apps/web/src/components/PartialFindingsPanel.tsx` to expose only the UI states required to inspect this step’s output and failures.
- The step leaves the next dependent step with a stable typed boundary, not a placeholder or undocumented assumption.

## Planned Verification

- Run the nearest repo-wide or package-targeted `bun run typecheck` command once the touched packages and apps exist.
- Planned app/integration coverage once the app surfaces exist: `bun test apps/api apps/web` for the API/worker/web path touched here.
- Add a browser/e2e or component-level check that exercises the visible UI state introduced by this step and one failure presentation path.

## Edge Cases

- Partial progress, retries, or restarts should leave this step in a typed, inspectable state rather than a silent half-success.

## Regression Expectations

- This step should remain a clean successor to [[02_Phases/Phase_06_recursive_corpus_analysis/Steps/Step_04_implement-recursive-fred-synthesis-and-contradiction-handling|STEP-06-04 Implement Recursive Fred Synthesis and Contradiction Handling]] rather than reworking already-planned scope upstream.
- Do not regress bounded execution, cancellation, or checkpoint/recovery while adding parallel corpus analysis.
- Keep minority findings and contradictions visible instead of flattening them into averages.
- Make sure large-corpus UX still points back to exact evidence rather than only synthesized prose.

## Security / Observability / Evaluation Focus

- Bound partition size, concurrency, intermediate artifact size, and model budgets before attempting 25,000-file analysis.
- Persist structured findings and evidence references so replay and audit remain possible.
- Carry prompt-injection defenses into batch extraction, partition prompts, and recursive merges.

## Related Notes

- Step: [[02_Phases/Phase_06_recursive_corpus_analysis/Steps/Step_05_add-progress-drilldown-and-partial-result-ux|STEP-06-05 Add Progress Drilldown and Partial Result UX]]
- Phase: [[02_Phases/Phase_06_recursive_corpus_analysis/Phase|Phase 06 recursive corpus analysis]]
