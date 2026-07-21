# Execution Brief

- Prerequisite: STEP-10-01 canonical project scope and route.
- Required reading: approved design; DEC-0013 and DEC-0014; BUG-0012; current `App.tsx`, `index.tsx`, `index.css`, and Home/Research/Notebook pages.
- Starting files: `apps/web/src/App.tsx`, `apps/web/src/index.tsx`, `apps/web/src/index.css`, `apps/web/src/pages/`, and new bounded workspace components.
- Checklist: implement WorkspaceShell, left navigation, center conversation region, right evidence region, independent pane state, Manrope/IBM Plex Mono roles, DaisyUI primitives, semantic landmarks, focus restoration, and no outer max-width container.
- Edge cases: long project/source names, narrow desktop, collapsed panes, deep route load, theme restoration, zoom/text scaling, and keyboard-only pane changes.

## Refinement Addendum — Execution-Ready Contract

### Outcome and slice boundary

- Success means every canonical project route is one full-viewport LTR application surface: project/navigation left, conversation center, evidence/reference right. The old brand block, navbar, breadcrumb, editorial title, drawer nesting, and max-width application card are absent.
- STEP-10-01 project state is a hard prerequisite. This slice creates shell/state boundaries and honest placeholders only; STEP-10-03 through STEP-10-06 own source import, thread creation, evidence data adaptation, and note CRUD.

### Concrete starting points and required reading

- Replace/refactor `apps/web/src/App.tsx`, `index.tsx`, `index.css`, and old shell assumptions in `pages/HomePage.tsx`, `ResearchPage.tsx`, `NotebookPage.tsx`, and `CitationPage.tsx`.
- Preserve contracts in `components/ResearchStream.tsx`, `NotebookView.tsx`, `CitationViewer.tsx`, `base-path.ts`, `server.ts`, and `vite.config.ts`.
- Add bounded components under `apps/web/src/components/workspace/`: `WorkspaceShell`, `WorkspaceNavigation`, `ConversationWorkspace`, `EvidenceInspector` placeholder, and a Solid signal/store workspace provider. Do not add a client state library.
- Read `docs/frontend-architecture.md`, `docs/accessibility.md`, the approved workspace design/plan, DEC-0013/0014, and the complete BUG-0012 note before editing.
- Preserve and extend `apps/web/e2e/walking-skeleton.spec.ts`, `recursive-analysis.spec.ts`, `notebook-report.spec.ts`, and `support/theme-readiness.ts`; add a focused shell component/e2e spec.

### Required behavior

1. Desktop uses semantic `nav`, primary `main`, and complementary evidence regions in left-to-right DOM/focus order. Left and right panes collapse independently; center owns remaining space and never gains an editorial max-width wrapper.
2. Tablet keeps conversation primary and opens evidence from the right. Mobile keeps conversation primary and opens navigation/evidence as separate labelled sheets. STEP-10-07 completes the audit, but working keyboard/focus behavior is required now.
3. Shell state is project-scoped and survives nested route transitions. Remounting a page must not erase the current draft/state owned by the provider.
4. Before STEP-10-05, `CitationPage` keeps its existing data behavior but renders inside the shell; inline right-pane evidence remains a labelled no-selection placeholder. No citation API redesign occurs here.
5. Project changes reset only project-scoped pane selections after confirmation; same-project pane changes preserve center state and scroll position.
6. Opening a user-requested drawer/sheet moves focus to its heading/first control; Escape/close restores focus to the opener. Passive responsive changes do not steal focus.
7. Theme initialization and `html`/app-root `data-theme` synchronization remain intact. Deep links and assets remain `BASE_PATH` aware.
8. Adopt the approved later typography: locally bundled Manrope for interface/conversation and existing IBM Plex Mono for identifiers/query metadata; remove Newsreader from workspace routes. No remote font fetch is permitted.

### Constraints, risks, and recovery

- DaisyUI owns primitives/tokens; Tailwind owns bounded layout. Do not recreate BUG-0012 with page-level component CSS. Custom CSS is limited to theme/font declarations and layout behavior without an existing primitive.
- Use transform/opacity for pane motion and respect reduced motion from the start. Avoid hidden duplicate interactive trees at breakpoints.
- Long names wrap/truncate with accessible full labels; panes have `min-width: 0`; wide content scrolls inside its owner rather than the viewport.
- If a nested legacy route fails, the shell stays mounted and shows a bounded route error. Error boundaries must not replace the full application.
- Handoff records component ownership, route nesting, focus rules, typography dependency changes, and placeholder contracts consumed by Steps 03–06.

### Readiness verdict

- **Pass.** Typography authority, interim citation behavior, starting files, required reading, non-goals, responsive/focus behavior, security/performance considerations, regressions, and downstream handoff are resolved.

## Related Notes

- Step: [[02_Phases/Phase_10_v1_usable_research_workspace/Steps/Step_02_build-unified-three-pane-workspace-shell|STEP-10-02 Build Unified Three Pane Workspace Shell]]
- Phase: [[02_Phases/Phase_10_v1_usable_research_workspace/Phase|Phase 10 v1 usable research workspace]]
