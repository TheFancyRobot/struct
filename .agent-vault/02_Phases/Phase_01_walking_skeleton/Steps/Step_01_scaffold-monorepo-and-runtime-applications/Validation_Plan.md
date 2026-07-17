# Validation Plan

## Acceptance Checks

- Confirm this deliverable is present, testable where applicable, and bounded to the step: The root monorepo manifests (`package.json`, `bunfig.toml`, `tsconfig.base.json`, `docker-compose.yml`) plus the first `apps/web`, `apps/api`, and `apps/worker` entrypoints.
- Confirm this deliverable is present, testable where applicable, and bounded to the step: The minimal package graph so the apps can import a shared `packages/domain` module without circular bootstrap hacks.
- Confirm this deliverable is present, testable where applicable, and bounded to the step: The skeleton bootable enough to host one project-create, ingest, and research path later in the phase.
- The step leaves the next dependent step with a stable typed boundary, not a placeholder or undocumented assumption.

## Planned Verification

- Plan a root-level install/typecheck command plus one per-app startup smoke test once the manifests and entrypoints exist.
- Plan a Compose smoke test that proves the chosen local stack can bring up required backing services before deeper feature work starts.
- Planned command once these packages exist: `bun test packages/domain` plus the nearest package-level `bun run typecheck`.
- Planned app/integration coverage once the app surfaces exist: `bun test apps/api apps/web apps/worker` for the API/worker/web path touched here.

## Edge Cases

- The scaffold should not assume production auth, queueing, or deployment concerns that are intentionally deferred to later phases.
- Cross-app imports must flow through package boundaries; direct app-to-app imports are a regression.
- If a package is empty, keep a narrow placeholder export instead of inventing APIs with no walking-slice caller.

## Regression Expectations

- This step should remain a clean successor to [[02_Phases/Phase_00_architecture_spikes_and_delivery_foundations/Steps/Step_06_establish-evaluation-corpus-specification-and-quality-gates|STEP-00-06 Establish Evaluation Corpus Specification and Quality Gates]] rather than reworking already-planned scope upstream.
- Do not break the planned monorepo boundaries between apps and reusable packages.
- Do not bypass deterministic retrieval or provenance rules just to make the first demo easier.
- Keep the walking skeleton small enough that the next phase can iterate on a real slice instead of replacing throwaway code.

## Security / Observability / Evaluation Focus

- Preserve workspace scoping, typed failures, and source-version lineage even in the first runnable slice.
- Make progress streaming and citation rendering observable and restart-aware from day one.
- Do not introduce hidden model loops or ad-hoc filesystem access in the name of speed.

## Related Notes

- Step: [[02_Phases/Phase_01_walking_skeleton/Steps/Step_01_scaffold-monorepo-and-runtime-applications|STEP-01-01 Scaffold Monorepo and Runtime Applications]]
- Phase: [[02_Phases/Phase_01_walking_skeleton/Phase|Phase 01 walking skeleton]]
