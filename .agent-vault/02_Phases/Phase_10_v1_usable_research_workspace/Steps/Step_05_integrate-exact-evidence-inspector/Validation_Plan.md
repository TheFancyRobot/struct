# Validation Plan

- Acceptance: document passages and deterministic calculations are inspectable from conversation citations with exact provenance and stable focus.
- Direct checks: component tests for every evidence kind/state; API authorization/projection tests; keyboard/focus tests; Playwright document and dataset citation flows.
- Regression: report and notebook citation paths continue to use the same verified contracts.

## Refinement Addendum — Exact Validation

### Automated checks

```bash
bun test --timeout 30000 --max-concurrency 1 packages/domain/src/dataset-query-evidence.test.ts packages/domain/src/cross-source-evidence.test.ts
bun test --timeout 30000 --max-concurrency 1 packages/persistence/src/repositories/research-projections.integration.test.ts packages/persistence/src/repositories/dataset-query-evidence.integration.test.ts
bun test --timeout 30000 --max-concurrency 1 apps/api/src/routes/citations.test.ts apps/api/src/routes/dataset-queries.test.ts
bun test --preload ./apps/web/test/solid-test-preload.ts --max-concurrency 1 apps/web/src/components/evidence-inspector.test.tsx apps/web/src/components/citation-base-path.test.tsx apps/web/src/pages/citation-page.test.ts
bun run --filter @struct/web build
bun test --timeout 60000 --max-concurrency 1 apps/web/e2e/evidence-inspector.spec.ts
bun run typecheck
bun run lint
bun run lint:imports
bun run test
bun run test:integration
bun run build
bun run docs:lint
bun run secrets:scan
```

### Required assertions and manual checks

- From a real conversation, open an exact document passage and a deterministic dataset calculation. Assert every required immutable locator/hash/query/unit/window/cohort/denominator field against persisted projections.
- Opening/switching/closing evidence never changes center scroll, message list, composer draft, selected source scope, or active thread.
- Back/Forward restores citation selection; reload with `?evidence=` reopens authorized evidence; `/struct` never escapes the configured base path.
- Keyboard activation focuses the inspector; rapid A→B selection cannot show A after B; close/Escape restores the exact citation trigger.
- Exercise no-selection, loading, missing, foreign, invalid, stale, repair-required, network retry, long excerpt, wide result, and truncated dataset states. Non-success states never use trusted-success styling.
- Verify document and dataset endpoints return not-found parity across workspace/project/thread/run/citation mismatches.
- Run desktop/tablet/mobile smoke checks in both themes; there is no viewport overflow, focus trap, console error, or unexpected failed request.
- Existing report/notebook citation navigation and base-path regression tests remain green until their routes are intentionally replaced.

### Exit gate

- Exact evidence is inspectable for both source classes, all authorization/provenance/base-path/focus checks pass, the evidence union is recorded for notes, and no confirmed defect remains before STEP-10-06.

## Related Notes

- Step: [[02_Phases/Phase_10_v1_usable_research_workspace/Steps/Step_05_integrate-exact-evidence-inspector|STEP-10-05 Integrate Exact Evidence Inspector]]
- Phase: [[02_Phases/Phase_10_v1_usable_research_workspace/Phase|Phase 10 v1 usable research workspace]]
