# Validation Plan

## Acceptance Checks

- Confirm this deliverable is present, testable where applicable, and bounded to the step: `packages/evaluation/` scaffolded with package.json (including `corpus:smoke`, `corpus:eval`, `bench` scripts), tsconfig.json, src/index.ts, placeholder source files, and test/ directory.
- Confirm this deliverable is present, testable where applicable, and bounded to the step: The first vertical-slice integration/e2e tests, basic tracing/logging hooks, and setup documentation that explain how to run the skeleton.
- Confirm this deliverable is present, testable where applicable, and bounded to the step: `docs/setup.md` is a concise quickstart (<100 lines) that links to canonical docs (local-development.md, repository-contract.md, roadmap.md) rather than duplicating content.
- Confirm this deliverable is present, testable where applicable, and bounded to the step: The walking slice observable enough to diagnose ingest, retrieval, and citation failures without debugger-only access.
- Confirm this deliverable is present, testable where applicable, and bounded to the step: The exact demo path, prerequisites, and known gaps so Phase 02 builds on evidence rather than tribal knowledge.
- The step leaves the next dependent step with a stable typed boundary, not a placeholder or undocumented assumption.

## Planned Verification

- Plan one integration test, one browser/e2e flow, and one trace/log inspection path for the walking slice.
- Plan a documentation review that verifies a fresh developer could run the slice from setup docs without hidden local steps.
- Planned command once these packages exist: `bun test packages/evaluation packages/observability` plus the nearest package-level `bun run typecheck`.
- Planned app/integration coverage once the app surfaces exist: `bun test apps/api apps/web` for the API/worker/web path touched here.

## Edge Cases

- Tracing should include run IDs/source IDs without leaking secrets or raw provider credentials.
- The documented demo path should name any intentionally unsupported cases rather than implying broad readiness.
- A passing unit-only test set is insufficient if the end-to-end ingest→research→citation path is still unproven.

## Regression Expectations

- This step should remain a clean successor to [[02_Phases/Phase_01_walking_skeleton/Steps/Step_05_stream-persisted-progress-and-render-navigable-citation|STEP-01-05 Stream Persisted Progress and Render Navigable Citation]] rather than reworking already-planned scope upstream.
- Do not break the planned monorepo boundaries between apps and reusable packages.
- Do not bypass deterministic retrieval or provenance rules just to make the first demo easier.
- Keep the walking skeleton small enough that the next phase can iterate on a real slice instead of replacing throwaway code.

## Security / Observability / Evaluation Focus

- Preserve workspace scoping, typed failures, and source-version lineage even in the first runnable slice.
- Make progress streaming and citation rendering observable and restart-aware from day one.
- Do not introduce hidden model loops or ad-hoc filesystem access in the name of speed.
- Evaluation should verify provenance opening paths, contradiction reporting, and prompt-injection resistance for the evidence types touched here.

## Related Notes

- Step: [[02_Phases/Phase_01_walking_skeleton/Steps/Step_06_automate-vertical-slice-tests-documentation-and-observability|STEP-01-06 Automate Vertical Slice Tests Documentation and Observability]]
- Phase: [[02_Phases/Phase_01_walking_skeleton/Phase|Phase 01 walking skeleton]]
