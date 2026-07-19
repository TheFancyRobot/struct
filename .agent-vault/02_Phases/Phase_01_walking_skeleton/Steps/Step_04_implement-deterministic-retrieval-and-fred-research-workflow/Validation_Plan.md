# Validation Plan

## Acceptance Checks

- Confirm this deliverable is present, testable where applicable, and bounded to the step: Three new packages scaffolded in order: `packages/retrieval/`, `packages/research-engine/`, `packages/workflows/` (each with package.json, tsconfig.json, src/index.ts, test/).
- Confirm this deliverable is present, testable where applicable, and bounded to the step: `packages/workflows/package.json` includes exact `@fancyrobot/fred: 2.0.0` dependency (not `^2.0.0` or `~2.0.0`).
- Confirm this deliverable is present, testable where applicable, and bounded to the step: The smallest retrieval service that can search the stored text source deterministically and hand evidence into one Fred workflow.
- Confirm this deliverable is present, testable where applicable, and bounded to the step: A typed research graph for the walking slice with explicit plan/result schemas and no hidden tool contracts.
- Confirm this deliverable is present, testable where applicable, and bounded to the step: One API route and one worker job so a research request becomes a persisted run with bounded retrieval and synthesis.
- The step leaves the next dependent step with a stable typed boundary, not a placeholder or undocumented assumption.

## Planned Verification

- Plan a vertical integration test that asks one grounded question and verifies the retrieval service, workflow, and persistence interact through typed boundaries.
- Plan a negative test where no relevant text is found and the workflow returns an insufficiency/failure state instead of hallucinating an answer.
- Planned command once these packages exist: `bun test packages/workflows packages/research-engine packages/retrieval` plus the nearest package-level `bun run typecheck`.
- Planned app/integration coverage once the app surfaces exist: `bun test apps/api apps/worker` for the API/worker/web path touched here.

## Edge Cases

- The first retrieval path must preserve source-version identity and evidence references even if only one text source exists.
- If Fred output validation fails, the run should fail with a typed error instead of partial synthesized text.
- The walking-slice workflow must not let the model call arbitrary tools or bypass the retrieval service.

## Regression Expectations

- This step should remain a clean successor to [[02_Phases/Phase_01_walking_skeleton/Steps/Step_03_implement-single-text-source-ingestion-and-artifact-storage|STEP-01-03 Implement Single Text Source Ingestion and Artifact Storage]] rather than reworking already-planned scope upstream.
- Do not break the planned monorepo boundaries between apps and reusable packages.
- Do not bypass deterministic retrieval or provenance rules just to make the first demo easier.
- Keep the walking skeleton small enough that the next phase can iterate on a real slice instead of replacing throwaway code.

## Security / Observability / Evaluation Focus

- Preserve workspace scoping, typed failures, and source-version lineage even in the first runnable slice.
- Make progress streaming and citation rendering observable and restart-aware from day one.
- Do not introduce hidden model loops or ad-hoc filesystem access in the name of speed.
- Evaluation should verify provenance opening paths, contradiction reporting, and prompt-injection resistance for the evidence types touched here.

## Related Notes

- Step: [[02_Phases/Phase_01_walking_skeleton/Steps/Step_04_implement-deterministic-retrieval-and-fred-research-workflow|STEP-01-04 Implement Deterministic Retrieval and Fred Research Workflow]]
- Phase: [[02_Phases/Phase_01_walking_skeleton/Phase|Phase 01 walking skeleton]]
