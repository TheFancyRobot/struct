# Validation Plan

- Acceptance: add multiple sources, navigate immediately, keep ready sources usable, reopen progress, recover partial failure, and preserve job truth across reload/reconnect.
- Direct checks: domain, API, and repository tests for validation, idempotency, isolation, limits, and event replay; component tests for every activity state; Playwright background-upload flow.
- Accessibility: progress uses polite live announcements, never steals focus, and failures remain actionable.

## Refinement Addendum — Exact Validation

### Automated checks

```bash
bun test --timeout 30000 --max-concurrency 1 packages/domain/src/source-uploads.test.ts packages/domain/src/source-catalog.test.ts
bun test --timeout 30000 --max-concurrency 1 packages/persistence/src/repositories/source-catalog.integration.test.ts packages/persistence/src/repositories/dataset-materializations.integration.test.ts packages/persistence/src/repositories/ingestion-event-contract.integration.test.ts
bun test --timeout 30000 --max-concurrency 1 apps/api/src/routes/sources.test.ts apps/api/src/routes/sources.integration.test.ts apps/api/src/routes/source-catalog.test.ts apps/api/src/routes/project-activity.test.ts apps/api/src/routes/directory-events.test.ts apps/api/src/routes/ingestion-jobs.integration.test.ts
bun test --timeout 30000 --max-concurrency 1 apps/worker/src/jobs/ingest-source.test.ts apps/worker/src/jobs/materialize-dataset.test.ts
bun test --preload ./apps/web/test/solid-test-preload.ts --max-concurrency 1 apps/web/src/api/sources.test.ts apps/web/src/components/source-import-panel.test.tsx apps/web/src/components/background-activity-tray.test.tsx apps/web/src/components/directory-controls.test.tsx apps/web/src/hooks/useSSE.test.ts
bun run --filter @struct/web build
bun test --timeout 60000 --max-concurrency 1 apps/web/e2e/source-import.spec.ts
bun run typecheck
bun run lint
bun run lint:imports
bun run test
bun run test:integration
bun run build
bun run docs:lint
bun run secrets:scan
```

### Required browser/API matrix

- Import one document, pasted text, a multi-file folder, and structured data; verify exact source kind and committed immutable version/materialization.
- Exercise duplicate, zero-byte, oversize, unsupported media/extension, unsafe relative path, excessive file count/aggregate bytes, and cross-workspace source/job/event access.
- Start a deliberately delayed mixed batch, return to navigation immediately after durable acceptance, use a ready source while another processes, expand/collapse progress, and verify no overlay obscures content.
- Refresh before/after the first activity event; hydrate existing jobs, reconnect from the last successfully reduced cursor, and assert no lost/duplicated state.
- Force one item to fail while siblings succeed; verify success remains usable and the failure persists with Review/Retry/Remove. Exercise retry exhaustion and cancel/complete races.
- Run with directory-picker support and with the capability absent; multi-file fallback remains usable and no absolute client path appears in request, response, log, event, or UI.
- Verify success tray collapse occurs within 3–5 seconds, while partial/complete failure never auto-dismisses.
- At `/struct/projects/:projectId`, all upload/activity URLs remain base-path aware. Progress announcements are polite and never move focus.
- Assert bounded memory/stream behavior with configured-limit fixtures, no browser console error, and no unexpected failed request.

### Exit gate

- Catalog/activity projections are authoritative after reload, all supported import modes and recovery states pass, full repository gates remain green, and the exact ready-version contract is recorded before STEP-10-04.

- Step: [[02_Phases/Phase_10_v1_usable_research_workspace/Steps/Step_03_deliver-source-catalog-and-non-blocking-import|STEP-10-03 Deliver Source Catalog and Non Blocking Import]]
- Phase: [[02_Phases/Phase_10_v1_usable_research_workspace/Phase|Phase 10 v1 usable research workspace]]
