# Validation Plan

## Acceptance Checks

- Confirm this deliverable is present, testable where applicable, and bounded to the step: The narrowest typed slice for Deterministic Batch Extraction and Evidence Artifacts that is callable by the next step without broadening scope.
- Confirm this deliverable is present, testable where applicable, and bounded to the step: The retrieval boundary in `packages/retrieval/src/batch-select.ts` so ranking, filtering, and provenance remain inspectable and typed.
- Confirm this deliverable is present, testable where applicable, and bounded to the step: The orchestration or synthesis rules in `packages/research-engine/src/evidence-artifacts.ts` without moving deterministic work out of services/tools.
- The step leaves the next dependent step with a stable typed boundary, not a placeholder or undocumented assumption.

## Planned Verification

- Planned command once these packages exist: `bun test packages/research-engine packages/retrieval packages/source-storage` plus the nearest package-level `bun run typecheck`.
- Planned app/integration coverage once the app surfaces exist: `bun test apps/worker` for the API/worker/web path touched here.

## Edge Cases

- Partial progress, retries, or restarts should leave this step in a typed, inspectable state rather than a silent half-success.

## Regression Expectations

- This step should remain a clean successor to [[02_Phases/Phase_06_recursive_corpus_analysis/Steps/Step_02_implement-bounded-corpus-partitioning-and-scheduling|STEP-06-02 Implement Bounded Corpus Partitioning and Scheduling]] rather than reworking already-planned scope upstream.
- Do not regress bounded execution, cancellation, or checkpoint/recovery while adding parallel corpus analysis.
- Keep minority findings and contradictions visible instead of flattening them into averages.
- Make sure large-corpus UX still points back to exact evidence rather than only synthesized prose.

## Security / Observability / Evaluation Focus

- Bound partition size, concurrency, intermediate artifact size, and model budgets before attempting 25,000-file analysis.
- Persist structured findings and evidence references so replay and audit remain possible.
- Carry prompt-injection defenses into batch extraction, partition prompts, and recursive merges.

## Related Notes

- Step: [[02_Phases/Phase_06_recursive_corpus_analysis/Steps/Step_03_implement-deterministic-batch-extraction-and-evidence-artifacts|STEP-06-03 Implement Deterministic Batch Extraction and Evidence Artifacts]]
- Phase: [[02_Phases/Phase_06_recursive_corpus_analysis/Phase|Phase 06 recursive corpus analysis]]

## Refined Acceptance and Commands

- Prove deterministic artifact bytes/hashes and exact aggregates across input ordering and process restart; prove changed source/version/query inputs change identity.
- Verify complete lineage, exclusion/truncation accounting, hostile-content labeling, sandbox/auth enforcement, idempotent commit, cancellation, storage failure cleanup, and reuse without re-extraction.
- Exercise sidecar restart through the real Compose network and confirm the Bun host never imports a native DuckDB runtime.
- Run focused source-storage/data-engine/research-engine/persistence tests, `docker compose up -d postgres data-engine data-engine-gateway`, the relevant integration suite, then `bun run typecheck`, `bun run test`, `bun run lint`, `bun run lint:imports`, `bun run build`, and `docker compose config --quiet`.
- Re-run Phase 04 deterministic SQL/provenance and Phase 05 replay tests affected by artifact/checkpoint changes.
- Confirm step/context mirrors and `vault_validate target=doctor` are clean.
