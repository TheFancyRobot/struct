# Validation Plan

## Acceptance Checks

- Confirm this deliverable is present, testable where applicable, and bounded to the step: Branded IDs and Effect Schemas for the first walking-slice entities: `Workspace`, `Source`, `ResearchRun`, and `Citation`.
- Confirm this deliverable is present, testable where applicable, and bounded to the step: `packages/persistence/src/migrations/0001_init.sql` with workspace-scoped tables, immutable version references, and foreign keys that match the domain model.
- Confirm this deliverable is present, testable where applicable, and bounded to the step: Repository interfaces that decode database rows back into typed domain records without leaking SQL details into app code.
- The step leaves the next dependent step with a stable typed boundary, not a placeholder or undocumented assumption.

## Planned Verification

- Plan schema decoding tests for each core entity plus a migration smoke test that creates the initial tables on a fresh database.
- Plan repository tests that prove insert/read round-trips preserve IDs, status enums, and citation/source-version references.
- Planned command once these packages exist: `bun test packages/domain packages/persistence` plus the nearest package-level `bun run typecheck`.
- Plan a fresh-database migration smoke test and an upgrade-path test so the new schema contract is reversible and auditable.

## Edge Cases

- The first migration must decide what is nullable in the walking slice and avoid later data backfills caused by vague contracts.
- Citation records cannot point only to mutable source identity; the migration must leave room for immutable source-version references.
- Repository contracts should fail loudly on decode drift instead of returning partially typed objects.

## Regression Expectations

- This step should remain a clean successor to [[02_Phases/Phase_01_walking_skeleton/Steps/Step_01_scaffold-monorepo-and-runtime-applications|STEP-01-01 Scaffold Monorepo and Runtime Applications]] rather than reworking already-planned scope upstream.
- Do not break the planned monorepo boundaries between apps and reusable packages.
- Do not bypass deterministic retrieval or provenance rules just to make the first demo easier.
- Keep the walking skeleton small enough that the next phase can iterate on a real slice instead of replacing throwaway code.

## Security / Observability / Evaluation Focus

- Preserve workspace scoping, typed failures, and source-version lineage even in the first runnable slice.
- Make progress streaming and citation rendering observable and restart-aware from day one.
- Do not introduce hidden model loops or ad-hoc filesystem access in the name of speed.

## Related Notes

- Step: [[02_Phases/Phase_01_walking_skeleton/Steps/Step_02_define-core-domain-schemas-and-persistence-migrations|STEP-01-02 Define Core Domain Schemas and Persistence Migrations]]
- Phase: [[02_Phases/Phase_01_walking_skeleton/Phase|Phase 01 walking skeleton]]
