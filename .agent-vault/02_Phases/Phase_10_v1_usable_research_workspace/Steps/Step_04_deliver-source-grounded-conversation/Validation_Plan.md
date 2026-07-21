# Validation Plan

- Acceptance: ask during background ingestion, use only ready versions, stream progress, reload/reconnect without duplicate events, and continue the thread.
- Direct checks: API client tests, research integration tests, component state tests, SSE replay tests, and Playwright conversation flow.
- Regression: bounded execution, tool authorization, citation validation, and research evaluation gates remain green.

## Refinement Addendum — Exact Validation

### Automated checks

```bash
bun test --timeout 30000 --max-concurrency 1 packages/domain/src/research-events.test.ts packages/domain/src/research-execution.test.ts
bun test --timeout 30000 --max-concurrency 1 packages/persistence/src/repositories/research-durability.integration.test.ts packages/persistence/src/repositories/research-event-contract.integration.test.ts packages/persistence/src/repositories/research-projections.integration.test.ts
bun test --timeout 30000 --max-concurrency 1 apps/api/src/routes/research.test.ts apps/api/src/routes/research-events.test.ts apps/api/src/routes/research.integration.test.ts apps/api/src/routes/threads.test.ts
bun test --timeout 30000 --max-concurrency 1 apps/worker/test/research-replay.integration.test.ts
bun test --preload ./apps/web/test/solid-test-preload.ts --max-concurrency 1 apps/web/src/api/research.test.ts apps/web/src/hooks/useSSE.test.ts apps/web/src/components/conversation-workspace.test.tsx apps/web/src/components/recursive-progress.test.tsx
bun run --filter @struct/web build
bun test --timeout 60000 --max-concurrency 1 apps/web/e2e/conversation.spec.ts
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

- With zero ready sources the composer is semantically disabled with a reason; when one source becomes ready the next question can use it without reload.
- Submit a first question, then a follow-up; assert one thread with two durable runs in correct order and an unchanged first-question title.
- Ask while other sources process; the submitted run contains only the displayed ready version IDs. Newly ready sources affect the next default scope, not the in-flight run.
- Preserve a non-empty draft and explicit source subset across left/right pane changes, same-project navigation, route away/back, and SSE reconnect. Project changes do not leak the draft.
- Disconnect after a committed event, replay overlapping frames, and remount the route; every committed message/progress item appears once and the cursor advances only after successful decode/reduction.
- Reload during a run, cancel, retry, provider failure, durable partial output, replay gap, and missing/mismatched deep link all recover honestly without losing the submitted question or showing invalid citations as complete.
- Paginate a long thread and assert deterministic ordering, bounded initial payload, no N+1 request pattern, and stable scroll when older history prepends.
- Test foreign workspace/thread/run/source-version scopes for not-found parity and preserve existing prompt-injection, bounded-execution, tool-authorization, citation-validation, and research evaluation gates.
- Run at `/struct/projects/:projectId`; console/network logs contain no unexpected failure.

### Exit gate

- Real canonical conversation routes no longer depend on a demo fixture, source/draft/cursor contracts are recorded for Steps 05–06, focused/full gates pass, and no confirmed defect remains before STEP-10-05.

## Related Notes

- Step: [[02_Phases/Phase_10_v1_usable_research_workspace/Steps/Step_04_deliver-source-grounded-conversation|STEP-10-04 Deliver Source Grounded Conversation]]
- Phase: [[02_Phases/Phase_10_v1_usable_research_workspace/Phase|Phase 10 v1 usable research workspace]]
