# Unified Research Workspace Design

**Date:** 2026-07-21\
**Status:** Approved visual design; pending written-spec review\
**Related defect:** BUG-0013 — v1 UI lacks core research workflows

## Purpose

Replace the current report-oriented demo shell with one coherent SaaS workspace where a user can manage sources, conduct source-grounded conversations, inspect evidence, and save notes without navigating through nested application frames or hand-constructed URLs.

The interface must feel like one application rather than a dashboard wrapped around an editorial document. It removes the logo block, breadcrumb bar, outer content container, and editorial page heading.

## Product Principles

1. **One workspace surface.** Navigation, sources, conversation, and evidence share the full viewport.
2. **Stable spatial model.** Standard left-to-right flow: navigation and sources on the left, primary work in the center, reference material on the right.
3. **Conversation owns focus.** The central conversation and composer remain spatially stable while secondary panes change.
4. **Actions transform their owning pane.** Source-management actions transform the left pane; citation and reference actions transform the right pane.
5. **Background work never blocks navigation.** Uploading and indexing continue while users navigate or chat with ready sources.
6. **Progressive disclosure.** Detailed source, evidence, and error information appears only when relevant.
7. **Trust remains inspectable.** Answers, saved notes, and reports retain direct links to exact source evidence.

## Information Architecture

### Left pane: project navigation and source management

The left pane is the extensible navigation system. Its default state contains:

- project selector;
- Conversation;
- Sources with count;
- Notes with count;
- Reports with count;
- recent-source shortcuts;
- persistent **Add sources** action;
- active background-task tray when work is running;
- account control at the bottom.

Future sections may be added, removed, or reordered within this rail without changing the conversation or evidence layouts.

Selecting **Add sources** replaces the left navigation in place with source-import controls. A clear Back action restores the previous navigation state and scroll position. Choosing files returns the user to normal navigation immediately; upload details can be reopened from the activity tray.

### Center pane: conversation

The center pane is the primary work surface and contains only:

- compact thread title and secondary actions;
- conversation history;
- answer actions such as Save as note and Copy;
- persistent composer;
- selected/ready source scope.

There is no editorial heading such as “Grounded analysis,” no duplicate project title, and no breadcrumb row. The thread title supplies the necessary local orientation.

### Right pane: evidence and reference context

The right pane is reserved for contextual reference material:

- citations used in the active answer;
- exact document passages;
- deterministic query results and calculation metadata;
- selected note details where appropriate;
- explicit empty state when no reference is selected.

Source uploading never repurposes this pane. Selecting a citation opens or updates the pane without moving the conversation.

## Core User Flows

### Create or select a project

The project selector opens a lightweight chooser supporting project selection and creation. Selecting a project loads its source catalog, recent threads, notes, and reports while preserving the three-pane spatial model.

### Add sources

1. The user selects **Add sources** in the left rail.
2. The left pane changes to an import view with a clear Back action.
3. The user may choose files, choose a local folder, paste text, or add supported structured data.
4. Selection creates one or more durable upload/ingestion jobs.
5. Normal navigation returns immediately after selection.
6. A reserved activity tray appears above the account control in the left rail.
7. Ready sources become available to chat without waiting for the entire batch.
8. Selecting the activity tray reopens detailed progress in the left pane.

The progress tray is not a toast. Long-running operations must remain visible without obscuring content. It displays an aggregate count, current item, progress, and state. It reserves layout space rather than floating over navigation.

On completion, the tray shows a brief success state for three to five seconds and collapses. Partial failures and failures remain until the user reviews, retries, removes, or dismisses them.

### Ask questions

The composer clearly shows the active source scope, including ready and processing counts. A user may ask questions as soon as at least one source is ready. Processing sources are excluded from the current request and join the available scope automatically when ready.

Submitting a question creates or continues a thread and streams progress into the center pane. Reconnection never clears the draft or existing conversation.

### Inspect evidence

Selecting an inline citation opens the right evidence pane and focuses the matching reference. Evidence includes exact source identity, immutable version information, locator, excerpt or calculation, and a direct action to open the full source context.

### Save a note

Selecting **Save as note** on an answer creates an editable note containing:

- the selected answer content;
- preserved citations and provenance;
- originating thread and run;
- creation timestamp;
- user-authored title and subsequent edits.

The Notes destination in the left rail lists saved notes and supports reopening them without losing the current conversation draft.

## Component Boundaries

- `WorkspaceShell`: owns the full-viewport three-pane layout and responsive pane visibility.
- `ProjectSwitcher`: selects or creates projects.
- `WorkspaceNavigation`: renders primary destinations, recent sources, and the Add sources action.
- `SourceImportPanel`: owns source selection and detailed ingestion progress within the left pane.
- `BackgroundActivityTray`: summarizes active source jobs without overlaying navigation.
- `ConversationWorkspace`: owns thread state, messages, answer actions, and the composer.
- `SourceScopeControl`: displays and changes the source set used by the next question.
- `EvidenceInspector`: renders document, dataset, directory, and recursive-analysis evidence.
- `NotesWorkspace`: lists, opens, creates, and edits saved notes with provenance.
- `ResponsivePaneController`: maps the same logical panes to desktop, tablet, and mobile presentations.

Each component has one primary responsibility and communicates through typed API clients and shared workspace state rather than reaching into another component’s internals.

## State and Data Flow

1. Project selection establishes workspace and project scope.
2. Project-scoped resources load through typed API clients: source catalog, threads, notes, reports, and active jobs.
3. Source import creates durable jobs; upload and ingestion events update a project-scoped activity store.
4. The left activity tray derives its summary from that store and survives pane changes and route navigation.
5. Conversation submission captures the selected ready source versions and creates a research run.
6. Server-sent events update run progress and committed answer state.
7. Citation selection updates evidence-pane state using the citation’s exact source locator.
8. Saving a note persists answer content together with citation and run provenance.

Critical workspace state—project, active thread, draft, selected sources, pane state, and active job summaries—must survive navigation and reconnects. Durable server state is authoritative; local state provides responsive continuity.

## Responsive Behavior

### Desktop: 1024px and wider

- Three panes may be visible simultaneously.
- Left navigation and right evidence panes can collapse independently.
- The conversation remains centered and does not reflow into an editorial container.

### Tablet: 768px to 1023px

- Left navigation remains available.
- Conversation stays primary.
- Evidence opens as a right-side drawer with a clear close action and preserved citation selection.

### Mobile: below 768px

- Conversation occupies the primary screen.
- Sources/navigation and evidence open as separate sheets, never at the same hierarchy level as bottom navigation.
- Active upload progress becomes a compact banner above the composer.
- The banner reserves space so it does not obscure messages or controls.
- Tapping the banner opens a source-progress sheet.

The implementation must be verified at 375px, 768px, 1024px, and 1440px, including landscape orientation where applicable.

## Loading, Empty, and Error States

### Empty project

The center pane explains that sources are required and directs attention to **Add sources**. The composer is semantically disabled until a source is ready and explains why.

### Processing

Ready sources remain usable. The source count and activity tray disclose how many sources are ready, processing, queued, failed, or unsupported.

### Reconnecting

Existing content remains readable and drafts remain editable. A concise reconnecting indicator appears without blocking input. Successful reconnection resumes event consumption from the last committed cursor.

### Partial upload failure

Successful sources remain ready. The activity tray identifies that attention is required and offers Review. Detailed progress lists each failed item with cause and recovery action.

### Complete upload failure

The activity tray remains visible with a plain-language cause and Retry or Remove actions. Failure feedback never auto-dismisses.

### Research failure

The center pane preserves the submitted question and any committed partial progress, describes the failure, and offers a bounded retry. Evidence from incomplete or invalid results is never presented as complete.

## Visual System

- Minimal, utilitarian SaaS tone rather than editorial or marketing presentation.
- Neutral surfaces and high-contrast text; color is reserved for status, selection, and primary actions.
- Typography uses Manrope for interface and conversational text, with IBM Plex Mono reserved for query text, identifiers, hashes, and tabular calculation metadata. Body text is at least 16px on mobile and 14px on desktop controls.
- A consistent 4px/8px spacing rhythm.
- Moderate radii: approximately 8px for controls, 12px for panels, and 14–16px for prominent inputs or sheets.
- One consistent SVG icon family; no emoji as structural icons.
- Motion communicates pane origin and continuity, uses transform/opacity, lasts 150–300ms, and respects reduced-motion preferences.
- Light and dark themes share the same surface hierarchy and semantic token system.

## Accessibility Requirements

- Complete keyboard access with visual focus indicators.
- Logical focus order follows left navigation, center conversation, then right evidence in desktop LTR layout.
- Pane transitions move focus only when explicitly opened by the user.
- Upload progress uses `aria-live="polite"` and never steals focus.
- Errors use clear text in addition to color and expose appropriate alert semantics.
- Icon-only controls have accessible labels and at least 44px target areas.
- Normal text meets WCAG AA 4.5:1 contrast; large text and interface graphics meet applicable 3:1 requirements.
- Text scaling and zoom do not truncate controls or hide actions.
- Reduced-motion mode removes nonessential transitions while preserving state clarity.

## Validation and Release Gates

### End-to-end Playwright journey

From an empty browser state, a user must be able to:

1. create a project;
2. add multiple source types;
3. return to navigation while upload continues;
4. observe background progress;
5. ask a question using ready sources;
6. inspect an exact citation;
7. save the answer as a note;
8. reopen the project and note later.

### Required state coverage

- empty project;
- uploading and indexing;
- navigation during upload;
- ready, queued, processing, unsupported, partial failure, complete failure, cancelled, and retrying source states;
- streaming, reconnecting, complete, partial, cancelled, empty, and failed research states;
- evidence open, changed, closed, missing, and stale;
- note creation, editing, persistence, and provenance retention.

### Quality checks

- No browser console errors.
- No broken API or asset requests.
- No horizontal scrolling at target breakpoints.
- No content hidden behind fixed controls or activity banners.
- Keyboard and screen-reader flows are usable.
- Both themes meet contrast and hierarchy requirements.
- Upload, draft, pane, and selected-source state survive route changes and reconnects.

The application is not a v1 candidate until the complete browser-driven journey passes against real API-backed state rather than demo fixtures.

## Out of Scope

- Audio generation, podcasts, flashcards, quizzes, and other NotebookLM-adjacent features.
- Generic web browsing.
- Plugin marketplaces or social features.
- Decorative landing-page or editorial-report layouts inside the application workspace.
- Advanced v1.1 conveniences such as reusable templates or global command palettes unless required to complete the core v1 journey.
