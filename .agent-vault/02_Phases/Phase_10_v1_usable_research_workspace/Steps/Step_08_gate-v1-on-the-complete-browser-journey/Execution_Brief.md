# Execution Brief

- Prerequisite: STEP-10-01 through STEP-10-07 complete and green.
- Required reading: Phase 09 release evidence and checklist; BUG-0013; approved design; all Phase 10 outcomes.
- Starting files: `apps/web/e2e/`, Playwright support, README, local-development and release-checklist docs, demo screenshots, and root HomePage/fixture routes.
- Checklist: add the deterministic release journey; run desktop and mobile; delete the fixture-driven primary route; update docs and real-state screenshots; record exact evidence; audit all known defects.
- Edge cases: cold start, dependency restart, slow upload, partial failure/retry, SSE reconnect, refresh at each stage, mobile sheets, dark theme, and browser console/network failures.
- Release rule: component demos, mocked fixtures, or direct API calls cannot substitute for the browser journey.

## Refinement Addendum — Execution-Ready Contract

### Outcome and prerequisites

- Success means reproducible release evidence starts from an empty browser and uses only visible user controls against durable real application state to create a project, add every v1 source mode, navigate during work, chat, inspect exact evidence, save/edit a Note, reload, and reopen. BUG-0013 closes only after zero-defect verification.
- STEP-10-01 through STEP-10-07 must be merged and green. This step performs release validation/documentation/demo removal; it does not perform the v1.0 tag or GitHub release action.

### Concrete starting points and exact removal/replacement targets

- Delete the fixture root in `apps/web/src/pages/HomePage.tsx`, the `?demo=mixed-source` path in `ResearchPage.tsx`, obsolete primary routes/wiring in `index.tsx`, and demo-only dependencies that no production/test consumer needs.
- Current `apps/web/e2e/walking-skeleton.spec.ts`, `mixed-source-report.spec.ts`, and `notebook-report.spec.ts` use mocked/fixture API state. Retain narrow component regression value if useful, but replace them as release evidence with `apps/web/e2e/workspace-release.spec.ts` and a real-stack support harness.
- Extend `apps/web/e2e/support/app-server.ts` (or bounded sibling helpers) to start/stop the built web proxy, API, worker, PostgreSQL, authenticated no-egress data-engine, and isolated artifact storage with readiness/timeouts/log capture.
- Correct `README.md`, `docs/setup.md`, `docs/local-development.md`, `docs/accessibility.md`, `docs/release-checklist.md`, `docs/release-policy.md`, and demo screenshot/manifests so none claim fixture/API-operator workflows are the complete product.

### Real-stack deterministic journey contract

1. Use an isolated empty test database/schema, workspace identity, artifact root, ports, and cleanup per run. The browser may rely on server-side configured auth identity, but it receives no token/workspace ID and performs no direct API/database setup after launch.
2. The application stack is real: web proxy, API routes/auth, persistence, worker queue, ingestion/materialization, event journal/SSE, retrieval/research, citation projections, and Note persistence. Page-level `route.fulfill`, fixture injection, direct SQL, and direct API commands cannot satisfy journey assertions.
3. A deterministic test Fred/model provider may be injected only through the existing provider boundary so CI has no external network/model dependency. It must still exercise the production worker/workflow/evidence/citation persistence path.
4. Through UI controls: create project; import a document, pasted text, browser folder, and structured dataset; deterministically delay at least one item; return to navigation; observe durable progress; use a ready source; ask a question; force/recover one SSE reconnect; open exact document and dataset evidence; save/edit a Note; reload; reopen project/thread/Note/evidence.
5. Run the full journey at desktop and mobile, in both themes where state differs, and under non-root `BASE_PATH=/struct`. IDs are discovered from UI/URL state, never hard-coded.
6. Add focused state/recovery scenarios for empty, unsupported, partial and complete upload failure/retry, cancel, research partial/failure/retry, stale/missing evidence, note conflict/offline autosave, dependency restart, cold start, and refresh at each durable boundary.
7. Capture browser console, page errors, request failures, HTTP 5xx, server/worker exit, readiness, trace/correlation IDs, timing, and screenshots. Expected injected failures are asserted narrowly; everything else fails the test.
8. Update maintained test counts/hashes/evaluation evidence and release checklist text when suites/artifacts change. Old fixture screenshots are removed or labelled non-release examples.

### Defect/release closure, recovery, and non-goals

- Non-goals: no product feature expansion, unrelated refactor, release-tag creation, production deploy, or relaxation of any existing gate. This slice validates, documents, removes obsolete demo paths, and remediates defects only.
- Audit all bug notes and repository output. BUG-0013 becomes `fixed` with `fixed_on` and exact evidence only after the journey and full gate ladder pass; any new confirmed defect keeps the phase/bug open.
- Preserve the last deployable artifact, greenfield drop/recreate procedure, and documented rollback. A failed candidate is cleaned up and never advances release state.
- Record exact commands, environment/config (redacted), commit, artifact hashes/paths, counts, timings, and manual accessibility results in Outcome/session/release docs.
- Performance evidence must keep the approved ceilings green and bound harness startup, ingestion waits, SSE replay, browser retries, logs, screenshots, and cleanup; arbitrary sleeps or unbounded polling invalidate the candidate.
- Handoff must state the zero-defect result, BUG-0013 closure evidence, final release-candidate commit/artifact hashes, rollback proof, and the single next action that remains intentionally unperformed.
- Stop immediately before creating a v1.0 tag, GitHub release, or other release action.

### Readiness verdict

- **Pass.** Real-stack boundary, deterministic provider rule, exact journey/state matrix, fixture/docs removal, command/evidence ownership, security/recovery, defect closure, and release stop are concrete.

## Related Notes

- Step: [[02_Phases/Phase_10_v1_usable_research_workspace/Steps/Step_08_gate-v1-on-the-complete-browser-journey|STEP-10-08 Gate v1 on the Complete Browser Journey]]
- Phase: [[02_Phases/Phase_10_v1_usable_research_workspace/Phase|Phase 10 v1 usable research workspace]]
