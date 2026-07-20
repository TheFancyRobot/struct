# Implementation Notes

- Added typed recursive run, partition, batch, partial-result, citation-lineage, and committed-event contracts under `packages/domain/src/`.
- Persistence canonicalizes and ownership-fences recursive event payloads, then supports exact idempotent replay while rejecting same-ID collisions with different content.
- Worker adapters publish only after durable operations succeed, carry monotonic recovery counts, use injected wall-clock timestamps, and leave single-batch partition updates nonterminal.
- The API folds the durable journal into a bounded, workspace-scoped recursive read model and merges repeated partition batch deltas without losing prior progress.
- The SolidJS UI combines the initial read with cursor-backed SSE updates, rejects identity drift and stale-read overwrites, supports cancellation/reconnection, and exposes exact validated citation navigation with an immutable raw-lineage fallback.
- Playwright covers partial and complete states, cancellation, keyboard disclosure, citation navigation, loading/reconnect/error states, persistent light/dark themes, reduced motion, responsive screenshots, and overflow/console/request failures.

## Related Notes

- Step: [[02_Phases/Phase_06_recursive_corpus_analysis/Steps/Step_05_add-progress-drilldown-and-partial-result-ux|STEP-06-05 Add Progress Drilldown and Partial Result UX]]
- Phase: [[02_Phases/Phase_06_recursive_corpus_analysis/Phase|Phase 06 recursive corpus analysis]]
