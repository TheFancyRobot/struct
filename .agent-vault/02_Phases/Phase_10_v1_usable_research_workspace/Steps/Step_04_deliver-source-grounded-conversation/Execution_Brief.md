# Execution Brief

- Prerequisite: STEP-10-03 exposes ready immutable source versions and durable activity state.
- Required reading: Agent Workflow; Phase 05–07; DEC-0008 and DEC-0010; research routes, event/cancel APIs, ResearchStream, and the SSE hook.
- Starting files: `packages/domain/src/research-execution.ts`, `packages/domain/src/research-events.ts`, `packages/persistence/src/repositories/research-execution.ts`, `apps/api/src/routes/research*.ts`, `apps/web/src/api/research.ts`, and `apps/web/src/components/ResearchStream.tsx`.
- Checklist: expose thread history; create/continue runs; select ready versions; stream committed events; preserve drafts and output across panes, routes, and reconnects; implement every honest state; remove fixture dependence from the primary route.
- Edge cases: no ready sources, a source becoming ready, stale selection, duplicate submit, cursor replay, cancel/retry, partial committed output, provider failure, and reload during a run.

## Refinement Addendum — Execution-Ready Contract

### Outcome and prerequisites

- Success means a user can create a first thread/run, append follow-up runs to that same thread, load paginated durable history, preserve a draft across same-project pane/route changes, submit only ready immutable source versions, reconnect without duplicate committed output, cancel/retry honestly, and reload an in-flight or terminal thread.
- Requires the canonical project/shell and STEP-10-03 catalog/activity contract. This step owns the message/run contract later consumed by evidence inspection and note provenance.

### Concrete starting points and required reading

- Domain/persistence: `packages/domain/src/research-events.ts`, `research-execution.ts`; `packages/persistence/src/repositories/interfaces.ts` (`ResearchThreadRepo`, `ResearchRunRepo`), `research-execution.ts`, and `research-projections.ts`.
- API: `apps/api/src/routes/research.ts`, `research-events.ts`, `research-cancel.ts`, `recursive-analysis.ts`, and route wiring in `main.ts`; add bounded thread-list/history and continue-thread route modules.
- Web: `apps/web/src/api/research.ts`, `hooks/useSSE.ts`, `components/ResearchStream.tsx`, `pages/HomePage.tsx`, `ResearchPage.tsx`, `components/MixedSourceReport.tsx`, and the project-scoped workspace store.
- Recovery evidence: `apps/worker/test/research-replay.integration.test.ts`, API event tests, and `apps/web/src/hooks/useSSE.test.ts`.
- Fixture-removal ownership in this slice: the canonical project conversation no longer depends on `HomePage` or `ResearchPage` demo state. Reusable rendering may remain temporarily, but `?demo=mixed-source` is not a primary workflow and is deleted no later than STEP-10-08.

### Required API/state behavior

1. Provide project-scoped thread list, one thread's paginated run/message history, create-first-thread/run, and append-follow-up-run endpoints. Current `startResearch` always creates a thread; refactor or add an explicit continuation command so follow-ups never silently create unrelated threads.
2. All routes derive workspace from authentication and verify project/thread/run/source ownership. Deep links to malformed, foreign, missing, or mismatched thread/run IDs return the same not-found shape.
3. Preserve the existing 1–10 unique source-version limit. At submit time capture exactly the selected ready immutable versions; queued/processing/failed versions are excluded and cannot join an in-flight run.
4. Default “all ready” scope recomputes for the next question as sources become ready. An explicit user subset remains explicit; stale/deleted selections are removed with an announcement before submit.
5. Move draft and active-thread state above route components. Store bounded project/thread drafts and selected IDs in `sessionStorage`, keyed by project/thread; never persist answer/evidence content or credentials in long-lived storage. Clear only after durable submission acceptance.
6. Refactor SSE reduction so the reconnect cursor advances only after a frame validates and is successfully reduced into UI state backed by durable server history. Receipt alone is not acknowledgement. Deduplicate replay by cursor/identity across unmount/remount.
7. Load durable history first, then replay events after its committed cursor. Paginate older history (bounded first page, deterministic cursor) and avoid per-message N+1 source requests.
8. Preserve submitted question and committed partial progress on failure. Provisional/incomplete output is visually distinct; unvalidated citations are never presented as complete evidence.
9. Cancel is best effort and idempotent. Retry starts a new durable run with an idempotency key and explicit link to the failed/cancelled run; it never mutates prior history.
10. Thread titles derive once from the first trimmed question with the existing bounded title rule; follow-ups do not rename silently. Thread ordering is deterministic by last activity and ID.

### Constraints, security, performance, recovery, and non-goals

- Imported source text is untrusted evidence and never changes prompt, tool, scope, budget, or UI instructions. Preserve bounded execution, authorization, citation validation, and prompt-injection evaluation gates.
- Keep SSE and Solid signals/stores; do not add WebSockets or a state framework. Bound message/event memory and render history incrementally for long threads.
- Explicit states: no ready sources, empty/loading history, submit pending, streaming, reconnecting, complete, durable partial, cancelled, failed, retrying, replay gap, provider failure, missing deep link, and offline.
- Handoff records thread/history/run schemas, cursor-commit semantics, source-scope rules, draft keys/limits, and the exact citation fields STEP-10-05 and run/thread fields STEP-10-06 consume.

### Readiness verdict

- **Pass.** Create-versus-continue semantics, committed cursor behavior, source scope, state continuity, exact files, failure recovery, security/performance, downstream contracts, and handoff are concrete.

## Related Notes

- Step: [[02_Phases/Phase_10_v1_usable_research_workspace/Steps/Step_04_deliver-source-grounded-conversation|STEP-10-04 Deliver Source Grounded Conversation]]
- Phase: [[02_Phases/Phase_10_v1_usable_research_workspace/Phase|Phase 10 v1 usable research workspace]]
