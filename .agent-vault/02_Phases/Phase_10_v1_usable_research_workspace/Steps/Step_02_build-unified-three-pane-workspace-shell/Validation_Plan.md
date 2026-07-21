# Validation Plan

- Acceptance: no brand block, breadcrumb bar, editorial heading, or nested application card; standard LTR pane order remains stable.
- Direct checks: Solid render/state tests; Playwright layout at 375, 768, 1024, and 1440px in both themes; automated landmark, name, and focus checks.
- Regression: citation, research, notebook, base-path, and theme tests remain green.

## Refinement Addendum — Exact Validation

### Automated checks

```bash
bun test --preload ./apps/web/test/solid-test-preload.ts --max-concurrency 1 apps/web/src/components/workspace/workspace-shell.test.tsx apps/web/src/components/workspace/workspace-state.test.ts apps/web/src/base-path.test.ts apps/web/src/server.test.ts
bun run --filter @struct/web build
bun test --timeout 60000 --max-concurrency 1 apps/web/e2e/workspace-shell.spec.ts apps/web/e2e/walking-skeleton.spec.ts apps/web/e2e/recursive-analysis.spec.ts apps/web/e2e/notebook-report.spec.ts
bun run typecheck
bun run lint
bun run lint:imports
bun run test
bun run build
bun run docs:lint
bun run secrets:scan
```

- Run the focused shell spec at 375, 768, 1024, and 1440 CSS pixels in both `struct-light` and `struct-dark`, plus one `/struct/projects/:projectId` built-server run.

### Required assertions and manual checks

- No workspace route contains the old brand/logo block, breadcrumb/navbar row, `Grounded analysis` editorial heading, nested drawer shell, or outer max-width application container.
- DOM landmarks and keyboard order are left navigation → center conversation → right evidence on desktop; mobile/tablet sheets are not duplicated in the accessibility tree when closed.
- Independently collapse/open both side panes; verify focus enters only after explicit open and returns to the exact opener on close/Escape.
- Navigate among same-project routes and use Back/Forward; project selection, center draft fixture, pane state, and scroll continuity remain correct.
- At every target width/theme: no horizontal viewport scroll, no hidden action, no overlap, long names stay contained, and both `html` and app root expose the selected theme.
- Verify Manrope and IBM Plex Mono are served from the built asset bundle with no remote font request; workspace routes do not use Newsreader.
- Test 200% zoom and reduced motion as smoke checks now; STEP-10-07 performs the final full matrix.
- Console and network logs contain no unexpected errors or failed requests.

### Exit gate

- Existing research, notebook, citation, theme, proxy, and base-path behavior remains green; shell placeholders have stable contracts for Steps 03–06; no confirmed defect remains before STEP-10-03.

## Related Notes

- Step: [[02_Phases/Phase_10_v1_usable_research_workspace/Steps/Step_02_build-unified-three-pane-workspace-shell|STEP-10-02 Build Unified Three Pane Workspace Shell]]
- Phase: [[02_Phases/Phase_10_v1_usable_research_workspace/Phase|Phase 10 v1 usable research workspace]]
