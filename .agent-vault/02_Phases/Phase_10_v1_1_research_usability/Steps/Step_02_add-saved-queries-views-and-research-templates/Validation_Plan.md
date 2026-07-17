# Validation Plan

## Acceptance Checks

- The slice for Saved Queries Views and Research Templates is implemented through typed module boundaries in the planned files (`packages/domain/src/research-template.ts`, `apps/api/src/routes/research-templates.ts`, `apps/web/src/components/SavedQueriesView.tsx`...).
- An observable path exists from the new code to the adjacent API, worker, persistence, or UI surface it must support.
- The result advances evidence-backed UX improvements without lowering research rigor without bypassing provenance, bounded execution, or validation expectations.

## Planned Verification

- Run the nearest repo-wide or package-targeted `bun run typecheck` command once the touched packages and apps exist.
- Run targeted unit tests for the domain, service, or adapter code introduced by this step.
- Run an integration flow that exercises the API/worker boundary touched by this step, including failure handling.
- Add a browser, e2e, or component-level verification path for the visible UX behavior named in this step.

## Edge Cases

- Partial progress, retries, or restarts should not leave Saved Queries Views and Research Templates in an ambiguous state.
- The step should surface unsupported, invalid, or adversarial inputs explicitly instead of silently guessing.
- Cancellation, duplicate actions, and no-progress loops should stop cleanly without duplicating side effects.

## Regression Expectations

- This step should remain a clean successor to [[02_Phases/Phase_10_v1_1_research_usability/Steps/Step_01_improve-research-search-navigation-and-command-ux|STEP-10-01 Improve Research Search Navigation and Command UX]] rather than reworking already-planned scope upstream.
- Do not regress citation inspection, source selection, or research-mode clarity while improving navigation.
- Keep keyboard and command flows aligned with accessibility and bounded action semantics.
- Avoid adding UI-only affordances that require unplanned backend behavior.

## Security / Observability / Evaluation Focus

- Preserve the distinction between computed facts, retrieved claims, and user-generated templates in the UX.
- Instrument feedback and usability flows without collecting unnecessary sensitive research content.
- Make sure new saved-view/template actions still honor workspace and project boundaries.

## Related Notes

- Step: [[02_Phases/Phase_10_v1_1_research_usability/Steps/Step_02_add-saved-queries-views-and-research-templates|STEP-10-02 Add Saved Queries Views and Research Templates]]
- Phase: [[02_Phases/Phase_10_v1_1_research_usability/Phase|Phase 10 v1 1 research usability]]
