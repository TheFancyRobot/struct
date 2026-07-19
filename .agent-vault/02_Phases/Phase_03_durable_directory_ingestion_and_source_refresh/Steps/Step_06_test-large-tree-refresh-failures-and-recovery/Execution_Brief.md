# Execution Brief

## Exact Outcome

- Produce the concrete contracts, artifacts, and bounded implementation/design surfaces for Large-Tree Refresh Failures and Recovery that this step is responsible for before any broader follow-on work begins.

## Prerequisites

- Re-read [[02_Phases/Phase_03_durable_directory_ingestion_and_source_refresh/Phase|Phase 03 durable directory ingestion and source refresh]] and confirm the step still matches the current roadmap sequence.
- Confirm the handoff from [[02_Phases/Phase_03_durable_directory_ingestion_and_source_refresh/Steps/Step_05_expose-directory-status-recovery-and-controls|STEP-03-05 Expose Directory Status Recovery and Controls]] before widening scope.
- Keep deterministic work in typed Effect services, repositories, and tools; reserve Fred for agentic orchestration only.
- Treat the listed files as planned starting points; create only the smallest set needed to land the slice.

## Planned Starting Files

- These paths may not exist yet; use them as the first bounded implementation or design surface.
- `packages/evaluation/src/directory-refresh.ts`
- `apps/worker/test/directory-recovery.integration.test.ts`
- `docs/operations/directory-recovery.md`
- `docs/benchmarks/directory-ingestion.md`

## Required Reading

- [[02_Phases/Phase_03_durable_directory_ingestion_and_source_refresh/Phase|Phase 03 durable directory ingestion and source refresh]]
- [[01_Architecture/Domain_Model|Domain Model]]
- [[01_Architecture/System_Overview|System Overview]]
- [[01_Architecture/Code_Map|Code Map]]
- [[02_Phases/Phase_03_durable_directory_ingestion_and_source_refresh/Steps/Step_05_expose-directory-status-recovery-and-controls|STEP-03-05 Expose Directory Status Recovery and Controls]]
- `docs/product-brief.md` sections 10, 18-19, 21-25, 26-27, and 29-31.

## Concrete Deliverables

- Produce an evidence-backed validation pass for Large-Tree Refresh Failures and Recovery, with explicit pass/fail criteria and durable output artifacts.
- Constrain worker-side execution in `apps/worker/test/directory-recovery.integration.test.ts` to one resumable, observable path for this slice.
- Add deterministic evaluation or benchmark artifacts in `packages/evaluation/src/directory-refresh.ts` so this step can be judged without hand-waving.
- Capture the durable contract or operator guidance in `docs/operations/directory-recovery.md`, `docs/benchmarks/directory-ingestion.md` rather than burying it in session-only notes.
- Use a deterministic generated tree capped at 1,000 files for Phase 03 correctness and recovery evidence; the planned 25,000-file corpus remains Phase 04+ work.
- Inject failures at discovery, hashing, checkpoint, artifact persistence, version creation, and event publication boundaries, then prove restart and replay convergence.
- Record correctness and resource observations without inventing hardware-independent latency claims.

## Smallest Bounded Checklist

- First, produce an evidence-backed validation pass for Large-Tree Refresh Failures and Recovery, with explicit pass/fail criteria and durable output artifacts.
- Then, constrain worker-side execution in `apps/worker/test/directory-recovery.integration.test.ts` to one resumable, observable path for this slice.
- Next, add deterministic evaluation or benchmark artifacts in `packages/evaluation/src/directory-refresh.ts` so this step can be judged without hand-waving.
- Finish by capturing the deterministic fixture, benchmark, or gate evidence that will let the validation plan judge the slice without guesswork.

## Constraints and Non-Goals

- Directory work must begin from manifests, hashing, and deterministic classification before any expensive downstream processing.
- Support partial success, resume, and refresh as first-class workflow behaviors rather than bolted-on retries.
- Never widen filesystem access beyond registered roots and explicit sandbox rules.

## Related Notes

- Step: [[02_Phases/Phase_03_durable_directory_ingestion_and_source_refresh/Steps/Step_06_test-large-tree-refresh-failures-and-recovery|STEP-03-06 Test Large-Tree Refresh Failures and Recovery]]
- Phase: [[02_Phases/Phase_03_durable_directory_ingestion_and_source_refresh/Phase|Phase 03 durable directory ingestion and source refresh]]
