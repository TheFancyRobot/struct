# Validation Plan

- Acceptance: save answer → edit → reload → reopen note → inspect original evidence, with revision and provenance integrity preserved.
- Direct checks: domain, repository, and API tests for CRUD, revisions, isolation, authorship, and citations; component autosave/error tests; Playwright note-persistence flow.
- Regression: existing findings and reports retain their current contracts and auditability.

## Refinement Addendum — Exact Validation

### Automated checks

```bash
bun test --timeout 30000 --max-concurrency 1 packages/domain/src/note.test.ts packages/domain/src/branded-ids.test.ts
bun test --timeout 30000 --max-concurrency 1 packages/persistence/src/migrations/note-lifecycle.test.ts packages/persistence/src/repositories/notes.integration.test.ts packages/persistence/src/repositories/durable-artifacts.integration.test.ts
bun test --timeout 30000 --max-concurrency 1 apps/api/src/routes/notes.test.ts apps/api/src/routes/notes.integration.test.ts apps/api/src/routes/durable-artifacts.test.ts
bun test --preload ./apps/web/test/solid-test-preload.ts --max-concurrency 1 apps/web/src/api/notes.test.ts apps/web/src/components/notes-workspace.test.tsx apps/web/src/components/note-editor.test.tsx apps/web/src/components/notebook-view.test.tsx
bun run --filter @struct/web build
bun test --timeout 60000 --max-concurrency 1 apps/web/e2e/notes.spec.ts
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

- Save one completed answer twice through double-click/retry and assert one Note with exact origin thread/run/citations/source versions.
- Save an eligible durable-partial answer and reject provisional streaming, failed, unsupported, and invalid-citation output.
- Edit title/body, wait for autosave, reload, reopen, and verify revision numbers/content hashes/authorship and unchanged origin provenance.
- Race two updates from the same revision; one commits and one receives conflict. The losing UI retains its text and explicit Reload latest/Save copy actions.
- Force timeout/offline during autosave and route change; dirty text remains in session scope, retry commits once, and project/thread drafts remain intact.
- Enforce title/body/control-character limits, render hostile Markdown/HTML as non-executable content, and verify no credential/evidence body enters long-lived storage.
- Archive/unarchive behavior, default/archived lists, pagination/order, stale loads, and archive/update races are deterministic.
- Open document and dataset citations from a reloaded note at root and `/struct`; evidence matches the immutable origin even if a logical source has a newer version.
- Cross-workspace/project/note/revision/provenance mismatches use not-found parity. Existing Finding/Report behavior and auditability remain green.
- Browser console/network logs contain no unexpected error or failed request.

### Exit gate

- Note create/edit/revision/conflict/archive/provenance and evidence reopening pass against durable state, all full gates remain green, and no confirmed defect remains before STEP-10-07.

## Related Notes

- Step: [[02_Phases/Phase_10_v1_usable_research_workspace/Steps/Step_06_add-durable-user-notes-with-provenance|STEP-10-06 Add Durable User Notes with Provenance]]
- Phase: [[02_Phases/Phase_10_v1_usable_research_workspace/Phase|Phase 10 v1 usable research workspace]]
