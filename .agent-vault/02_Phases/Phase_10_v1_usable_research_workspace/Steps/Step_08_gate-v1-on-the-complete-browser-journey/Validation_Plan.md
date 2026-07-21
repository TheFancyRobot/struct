# Validation Plan

- Acceptance: typecheck, lint, unit, integration, build, full Playwright, evaluation, security, documentation, and vault doctor are clean; no console errors or failed requests; BUG-0013 verification is reproducible.
- Required Playwright journey: create project → add sources → navigate during upload → observe progress → chat → open exact citation → save/edit note → reload/reopen on desktop and mobile.
- The phase and bug remain open if any confirmed defect exists anywhere in the repository.
- Rollback and recovery: preserve the previous deployable artifact and greenfield drop-recreate procedure; a failed candidate does not advance the release action.

## Refinement Addendum — Exact Validation

### Focused release journey

```bash
bun run build
bun test --timeout 120000 --max-concurrency 1 apps/web/e2e/workspace-release.spec.ts
```

- The harness must run the journey once at the default base and once with `BASE_PATH=/struct`; run desktop and mobile projects/loops and record both theme results required by the state matrix.
- Fail if the release spec uses page network stubs/fixture reports/direct API setup after stack start, hard-coded project/thread/run/note IDs, or an external nondeterministic model/network dependency.

### Full gate ladder

```bash
bun run typecheck
bun run lint
bun run lint:imports
bun run test
bun run test:integration
bun run build
bun run test:e2e
bun run v1:performance
bun run v1:evaluate
bun run ops:recovery-proof
bun run docs:lint
bun run secrets:scan
```

- Then run `vault_refresh` for all generated context and `vault_validate` with target `doctor`.
- Record exact test/evaluation counts, artifact hashes/paths, command exit status, duration, commit, and redacted environment in `Outcome.md` and the release checklist.

### Required journey assertions

- Empty browser → create project → add document/paste/folder/dataset → immediate navigation after durable acceptance → visible background progress → ready-source question during processing → transient SSE reconnect without duplicate output → exact document and dataset evidence → Save as note → edit/autosave → reload/reopen project/thread/note/evidence.
- Repeat the complete path at desktop and mobile; assert sheets/banner/focus, light/dark theme state, `/struct` routing, and no manual identifiers.
- Exercise cold start/readiness, dependency restart, slow ingestion, partial failure/retry, complete failure/retry, cancel race, refresh after every durable boundary, research partial/failure, stale/missing evidence, note conflict/offline recovery, and returning-user reopen.
- Browser console/page-error/request-failure/HTTP-5xx logs contain no unexpected entry; server/worker/data-engine remain healthy; artifacts and source versions retain exact provenance.
- Scan production web/routes for `mixedSourceDemoFixture`, `demo=mixed-source`, obsolete fixture-only navigation, and browser-supplied `workspaceId`; no primary path remains.
- Verify corrected `README.md`, setup/local-development/accessibility/release docs, real-state screenshot manifests, and release counts/hashes.
- Audit `.agent-vault/03_Bugs`: zero confirmed defects after BUG-0013 is verified. Phase and bug remain open on any failure.

### Rollback and release stop

- Prove the documented previous-artifact and greenfield drop/recreate recovery path without changing release state.
- Do not create/push a version tag, publish a GitHub release, or perform any v1.0 release action; hand off immediately before that point.

### Exit gate

- All focused/full/manual/vault checks pass with reproducible evidence, documentation describes the real product, fixtures no longer stand in for the release journey, BUG-0013 is closed, and the repository has zero known confirmed defects.

## Related Notes

- Step: [[02_Phases/Phase_10_v1_usable_research_workspace/Steps/Step_08_gate-v1-on-the-complete-browser-journey|STEP-10-08 Gate v1 on the Complete Browser Journey]]
- Phase: [[02_Phases/Phase_10_v1_usable_research_workspace/Phase|Phase 10 v1 usable research workspace]]
