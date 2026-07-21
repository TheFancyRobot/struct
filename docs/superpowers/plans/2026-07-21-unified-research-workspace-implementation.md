# Unified Research Workspace Implementation Plan

**Date:** 2026-07-21\
**Bug:** BUG-0013 — v1 UI lacks core research workflows\
**Design:** `docs/superpowers/specs/2026-07-21-unified-research-workspace-design.md`

## Objective

Replace the hard-coded report demo with an API-backed, full-viewport research workspace that supports the complete v1 browser journey: create a project, add sources, navigate while ingestion continues, ask questions, inspect exact evidence, save a note, and reopen persisted work.

## Delivery Constraints

- Preserve the approved DaisyUI refactor and use DaisyUI components wherever a suitable primitive exists.
- Do not retain compatibility layers for the current demo route or fixture-driven home page.
- Do not change the research, provenance, or deterministic-computation guarantees.
- Keep `apps/web` as a SolidJS SPA communicating with `apps/api` over HTTP and SSE.
- Root orchestrator owns every git operation; implementation workers run no git commands.
- BUG-0013 remains release-blocking until the complete Playwright journey passes.

## Slice 1 — Workspace contracts and project lifecycle

### Outcome

A new browser session can list projects, create a project, select it, and load one stable workspace route.

### Work

- Add typed project-list and project-create request/response schemas in `packages/domain`.
- Add persistence repository operations for listing and creating projects within an authorized workspace.
- Add authenticated API routes for project listing and creation.
- Add `apps/web/src/api/projects.ts` with typed error handling.
- Introduce project-scoped workspace state and a canonical `/projects/:projectId` route.
- Implement the project selector/creator without a separate application shell.
- Remove reliance on hand-constructed project identifiers for primary navigation.

### Tests

- Domain schema tests for valid and invalid project inputs.
- Repository integration tests for workspace isolation and duplicate handling.
- API tests for authorization, list, create, and validation failures.
- Solid component tests for empty, loading, failure, and selected-project states.
- Playwright: create a project from an empty workspace and reopen it.

## Slice 2 — Unified workspace shell

### Outcome

The approved full-viewport LTR layout replaces the nested drawer, navbar, breadcrumbs, brand block, editorial heading, and centered outer container.

### Work

- Replace the current `App.tsx` shell with `WorkspaceShell` and responsive pane state.
- Implement `WorkspaceNavigation`, `ConversationWorkspace`, and `EvidenceInspector` boundaries.
- Use the approved Manrope and IBM Plex Mono typography roles.
- Use DaisyUI drawer, menu, button, input, textarea, progress, alert, tooltip, dropdown, and modal primitives where applicable.
- Retain only bounded custom layout CSS and semantic design tokens.
- Establish desktop, tablet, and mobile pane behavior from the approved spec.
- Provide keyboard-visible pane controls and predictable focus restoration.

### Tests

- Component tests for pane visibility, focus restoration, and active navigation.
- Visual assertions at 375, 768, 1024, and 1440px in both themes.
- Axe/accessibility checks for landmarks, names, focus order, and contrast.

## Slice 3 — Source catalog and non-blocking import

### Outcome

Users can add supported sources from the left pane, return immediately to navigation, and monitor durable background progress.

### Work

- Add project-scoped source-list/read projections if not already exposed by the API.
- Add browser-safe file upload contracts and endpoints for supported individual files and datasets.
- Reuse the existing text-source and directory-ingestion pipelines behind typed adapters rather than duplicating ingestion logic.
- Implement `SourceImportPanel` in the left pane with file picker, directory picker where browser capabilities allow, paste-text flow, validation, and explicit limits.
- Implement a project-scoped activity store fed by initial job reads and SSE events.
- Implement `BackgroundActivityTray` as reserved left-rail content above the account control.
- Return to navigation immediately after source selection.
- Support ready, queued, processing, unsupported, partial-failure, failed, cancelled, and retrying states.
- Keep ready sources available while other sources process.

### Tests

- API and persistence tests for upload validation, workspace isolation, idempotency, and limits.
- Component tests for import, immediate return, tray state, retry, and partial failure.
- Playwright: begin a multi-source upload, return to navigation, continue using the app, reopen progress, and observe completion.
- Accessibility test for polite progress announcements without focus theft.

## Slice 4 — Source-grounded conversation

### Outcome

Users can start and continue a conversation using selected ready sources, with durable streaming progress and recoverable drafts.

### Work

- Add `apps/web` API functions for creating research runs, reading thread history, and resuming event streams.
- Implement project-scoped thread list and active-thread state.
- Implement the central message history and persistent composer.
- Add source-scope selection using immutable ready source versions.
- Preserve drafts across pane changes, routes, and transient reconnects.
- Reuse `ResearchStream` behavior through smaller message/progress components rather than embedding the existing report page.
- Replace the root `mixedSourceDemoFixture` with real empty, loading, streaming, complete, partial, cancelled, and failed states.

### Tests

- API-client tests for research creation and failure mapping.
- Component tests for draft preservation, source scope, reconnect, partial output, cancellation, and bounded retry.
- Playwright: ask a question during background ingestion and receive a source-grounded answer from ready sources.

## Slice 5 — Evidence inspector

### Outcome

Selecting a citation opens exact document or dataset evidence in the right pane without moving the conversation.

### Work

- Refactor existing citation and report-evidence components into `EvidenceInspector` adapters.
- Preserve document locators, source versions, hashes, query text, result hashes, units, windows, cohorts, and denominators.
- Add explicit no-selection, loading, missing, stale, invalid, and repair-required states.
- Make inline citations keyboard reachable and focus the selected evidence item without trapping focus.
- On tablet, render evidence as a right drawer; on mobile, render it as a sheet.

### Tests

- Component tests for each evidence kind and failure state.
- Keyboard/focus tests for opening, switching, and closing evidence.
- Playwright: open an exact document passage and deterministic calculation from the conversation.

## Slice 6 — Durable user notes

### Outcome

Users can save an answer as an editable note with preserved provenance and reopen it later.

### Work

- Add a first-class Note domain model instead of conflating user-authored notes with generated findings.
- Add greenfield persistence schema and repository operations for create, list, read, update, and archive.
- Add authenticated project-scoped note API routes.
- Add `apps/web/src/api/notes.ts`.
- Implement Notes navigation, list, editor, autosave state, and failure recovery.
- Implement **Save as note** from an answer, retaining originating thread, run, source versions, and citations.
- Keep citation navigation available from saved notes.

### Tests

- Domain and repository tests for revision integrity, workspace isolation, authorship, and provenance.
- API tests for CRUD, validation, and authorization.
- Component tests for create, edit, autosave, conflict/failure, empty, and archived states.
- Playwright: save an answer, edit its title/content, reload, and reopen its evidence.

## Slice 7 — Responsive, accessibility, and theme completion

### Outcome

The same workflow remains usable across supported breakpoints, keyboard and screen-reader use, reduced motion, and both themes.

### Work

- Verify desktop three-pane, tablet evidence drawer, and mobile sheets/banner behavior.
- Guarantee 44px interactive targets, visible focus, semantic landmarks, labelled controls, and logical focus movement.
- Add `aria-live="polite"` progress summaries and alert semantics for actionable failures.
- Respect zoom, text scaling, reduced motion, and color-independent status communication.
- Verify semantic color tokens and computed contrast in light and dark themes.
- Remove emoji structural icons and use one SVG icon set.

### Tests

- Automated axe checks for primary states.
- Playwright keyboard-only journey.
- Computed-style contrast and theme assertions.
- Reduced-motion and large-text smoke checks.

## Slice 8 — Release journey, documentation, and demo removal

### Outcome

BUG-0013 is resolved only when the application works from an empty browser session against real API-backed state.

### Work

- Add one deterministic Playwright release test covering:
  1. create project;
  2. add sources;
  3. navigate during upload;
  4. observe background progress;
  5. ask a question;
  6. open a citation;
  7. save and edit a note;
  8. reload and reopen the project and note.
- Run the journey at desktop and mobile breakpoints.
- Remove the hard-coded home fixture and obsolete demo-only routing.
- Update user and local-development documentation to describe the real workflow.
- Update the release checklist so component demos cannot substitute for an end-to-end user journey.
- Regenerate screenshots only from the real application state.

### Validation

- Typecheck, lint, unit tests, integration tests, builds, and all Playwright suites pass.
- No browser console errors or failed network requests.
- Agent Vault validates cleanly.
- BUG-0013 verification records exact commands and evidence.
- The release gate remains blocked if any confirmed repository defect remains.

## Execution Order

The slices execute sequentially because each establishes contracts used by the next. Within each slice, implementation order is:

1. domain contracts;
2. persistence and migration;
3. API route;
4. web API client;
5. UI component;
6. component/integration tests;
7. Playwright verification;
8. documentation and vault update.

Each slice must leave the repository green before the next begins. New confirmed defects stop advancement and are fixed before continuing.

## Completion Definition

The work is complete when all eight slices pass, BUG-0013 is verified and closed, the v1 release checklist requires the real browser journey, and there are zero known confirmed defects across code, tests, builds, security, documentation, and Agent Vault state.
