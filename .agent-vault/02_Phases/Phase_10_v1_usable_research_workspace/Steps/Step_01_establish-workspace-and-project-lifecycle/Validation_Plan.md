# Validation Plan

- Acceptance: empty browser → create project → selected canonical route → reload → same project reopens; unauthorized workspaces remain indistinguishable from missing resources.
- Direct checks: focused domain tests, persistence integration tests, API authorization/validation tests, Solid state tests, and a Playwright first-project flow.
- Regression: existing authorization, health/readiness, base-path routing, and research API tests remain green.

## Refinement Addendum — Exact Validation

### Automated checks

```bash
bun test --timeout 30000 --max-concurrency 1 packages/domain/src/project-lifecycle.test.ts
bun test --timeout 30000 --max-concurrency 1 packages/persistence/src/repositories/projects.integration.test.ts packages/persistence/src/repositories/integration.test.ts
bun test --timeout 30000 --max-concurrency 1 apps/api/src/routes/projects.test.ts apps/api/src/routes/projects.integration.test.ts apps/api/src/auth-boundary.test.ts apps/api/src/auth-boundary.integration.test.ts
bun test --preload ./apps/web/test/solid-test-preload.ts --max-concurrency 1 apps/web/src/api/projects.test.ts apps/web/src/components/project-switcher.test.tsx apps/web/src/base-path.test.ts apps/web/src/server.test.ts
bun run --filter @struct/web build
bun test --timeout 60000 --max-concurrency 1 apps/web/e2e/project-lifecycle.spec.ts
bun run typecheck
bun run lint
bun run lint:imports
bun run test
bun run test:integration
bun run build
bun run docs:lint
bun run secrets:scan
```

- If a named new test file is intentionally split, run the equivalent committed paths and record them in `Outcome.md`; do not omit the coverage category.
- Run the e2e flow once at `/` and once with `BASE_PATH=/struct` through the built web server.

### Required assertions and manual checks

- Zero projects shows one labelled create affordance; blank/control/over-120-character names are rejected without a request.
- Create double-click, request retry, and reload during the response yield one project via idempotency.
- Exact and case-only normalized duplicates return the typed conflict without exposing another project.
- Successful creation lands on the canonical route; reload and Back/Forward preserve the correct selected project.
- A valid last-project ID reopens; stale, deleted, malformed, foreign, or unauthorized IDs clear the cache and produce the same not-found behavior without enumeration.
- `/struct/projects/:projectId` loads assets and API calls without a root-path escape.
- API timeout/unavailability retains the entered name, announces the failure, and offers a bounded retry.
- Browser console has no errors and the lifecycle emits no failed asset/API request other than failures deliberately asserted by the test.

### Exit gate

- Focused and repository-wide commands pass, the new migration upgrades from the current manifest and drops/recreates cleanly, no confirmed defect is introduced, and `Outcome.md` records exact evidence before STEP-10-02 starts.

## Related Notes

- Step: [[02_Phases/Phase_10_v1_usable_research_workspace/Steps/Step_01_establish-workspace-and-project-lifecycle|STEP-10-01 Establish Workspace and Project Lifecycle]]
- Phase: [[02_Phases/Phase_10_v1_usable_research_workspace/Phase|Phase 10 v1 usable research workspace]]
