# Execution Brief

- Prerequisite: STEP-10-05 stable citation and run context.
- Required reading: Domain Model; Phase 08; DEC-0006; finding/report lifecycle code; approved Note requirements.
- Starting files: `packages/domain/src/finding.ts`, `packages/domain/src/report.ts`, persistence migrations and durable-artifact repositories/routes, `apps/web/src/api/artifacts.ts`, and `NotebookView.tsx`.
- Checklist: define a distinct Note model with authorship, revisions, and provenance; add greenfield persistence and repository; expose authenticated CRUD/archive routes; add a typed web client; implement list/editor/autosave; implement Save as note; retain citation navigation.
- Edge cases: empty title/content, concurrent edit, autosave failure, reload during save, citation drift, archived note, cross-workspace access, and note creation from partial output.
- Assumption: notes are user-authored durable objects, not aliases for generated findings; the greenfield policy permits direct schema creation without compatibility layers.

## Refinement Addendum — Execution-Ready Contract

### Outcome and model boundary

- Success means a user saves a terminal committed answer as a distinct editable Note, edits/autosaves it with optimistic concurrency, reloads/reopens it inside the project workspace without losing the conversation draft, and reopens its original exact evidence.
- Notes coexist with generated Findings and Reports; they do not replace or alias those domain models. Replace the answer-level user action currently implemented as `ResearchStream` → `saveCompletedResearchFinding` with `Save as note`; retain existing finding/report records and APIs for their own workflows.

### Concrete starting points and required reading

- Behavior references: `packages/domain/src/finding.ts`, `report.ts`; `packages/persistence/src/repositories/durable-artifacts.ts`; `apps/api/src/routes/durable-artifacts.ts`; `apps/web/src/api/artifacts.ts`; `components/ResearchStream.tsx`, `NotebookView.tsx`, `ReportEditor.tsx`; `pages/NotebookPage.tsx`; routing in `App.tsx`/`index.tsx`.
- Provenance/base path: the STEP-10-05 evidence union, `components/citation-paths.ts`, `pages/citation-return.ts`, and `base-path.ts`.
- Add `NoteId` and note schemas in bounded domain files, the next greenfield migration(s), a dedicated note repository/service and integration tests, `apps/api/src/routes/notes.ts`, `apps/web/src/api/notes.ts`, and bounded list/editor/save-action components.
- Read Domain Model, DEC-0006, Phase 08 outcomes, and the approved Note requirements. Do not copy unsupported/draft Finding support into Note provenance.

### Exact Note/revision/provenance contract

1. A Note owns ID, workspace/project, author identity, title, archive state, current revision, created/updated timestamps, and immutable origin metadata. A NoteRevision is append-only and stores revision number, title/body, author, timestamp, and content hash.
2. Origin metadata records originating thread/run and answer identity plus the exact validated citation IDs, source-version/snapshot IDs, and locators captured at creation. Later edits never retarget or mutate origin provenance.
3. `Save as note` is enabled only for terminal committed complete or durable-partial answer content whose cited evidence passed validation. Streaming provisional, failed, invalid-citation, or unsupported content cannot be saved as trusted note provenance.
4. Create/list/read/update/archive endpoints are project-scoped, derive workspace from auth, return typed schemas/errors, support deterministic pagination, and make foreign/missing resources indistinguishable.
5. Create uses an idempotency key tied to the origin answer so double-click/retry cannot create duplicates. Update requires `expectedRevision`; stale writes return `409` with current revision metadata but never overwrite either version.
6. Validate trimmed/NFC title 1–200 characters and UTF-8 body 1–262,144 bytes; reject controls unsafe for the editor. Store/render note text as untrusted plain text or sanitized Markdown—never raw HTML.
7. The editor autosaves 750 ms after the last change and exposes Saving/Saved/Failed/Conflict. Route change attempts a bounded flush; on timeout/failure retain the dirty draft in project/note-scoped `sessionStorage` and offer Retry. Never silently discard or merge conflicts.
8. Conflict UI preserves the user's text and offers Reload latest or Save copy. Reload is explicit. A retry uses the last acknowledged revision/idempotency key.
9. Archive is a reversible soft state/tombstone with an explicit command; archived notes leave the default list but remain directly readable only through an intentional archived view. Provenance remains auditable.
10. Notes navigation/list/open changes the owning workspace content without clearing the conversation draft. Citation actions reuse the EvidenceInspector and base-path-safe history state.

### Security, performance, recovery, and non-goals

- Author/project/workspace checks apply to every revision and provenance edge. API responses never expose raw storage/provider errors or another tenant's existence.
- Paginate lists/revisions, debounce writes, cancel stale loads, and avoid writing unchanged content hashes. No new editor framework, database, or compatibility model is allowed.
- Recovery covers empty/oversize input, offline/timeout, reload during save, conflict, archive race, stale/missing citation, missing origin run, cross-workspace access, and duplicate create.
- Handoff records the final schemas/migration, revision and autosave protocol, safety limits, archive semantics, evidence links, and any intentionally retained Finding/Report routes.

### Readiness verdict

- **Pass.** Note-versus-Finding boundary, data/revision/provenance model, exact files, autosave/conflict/archive behavior, safety/performance, failure recovery, navigation integration, and handoff are concrete.

## Related Notes

- Step: [[02_Phases/Phase_10_v1_usable_research_workspace/Steps/Step_06_add-durable-user-notes-with-provenance|STEP-10-06 Add Durable User Notes with Provenance]]
- Phase: [[02_Phases/Phase_10_v1_usable_research_workspace/Phase|Phase 10 v1 usable research workspace]]
