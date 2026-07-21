# Execution Brief

- Prerequisite: STEP-10-02 stable shell and left-pane ownership.
- Required reading: approved design; Phase 02–04; DEC-0006 and DEC-0009; existing source registration, directory controls, dataset catalog, worker ingestion, and SSE code.
- Starting files: source/domain schemas; persistence source, directory, and dataset repositories and migrations; `apps/api/src/main.ts`; `apps/api/src/routes/sources.ts`; `apps/web/src/api/directories.ts`; source-control components.
- Checklist: expose project source catalog; define browser-safe upload and staging limits; adapt existing ingestion pipelines; implement left-pane import states; create the project activity store; reserve activity-tray space above account; return to navigation after selection; expose retry, cancel, and review.
- Edge cases: duplicate files, unsupported type, mixed success, zero-byte or oversized file, unsafe folder input, cancellation, reconnect/replay, refresh mid-upload, concurrent batches, and ready-source use during processing.
- Rollback boundary: upload adapters remain removable without changing immutable source/version or existing directory-ingestion contracts.

## Refinement Addendum — Execution-Ready Contract

### Outcome and prerequisites

- Success means the selected project hydrates a truthful source catalog and durable activity list, accepts supported file/folder/paste/dataset imports, returns to navigation immediately after durable acceptance, and lets ready sources remain usable while other items queue, process, fail, cancel, or retry.
- Requires STEP-10-01 authenticated project scope and STEP-10-02 left-pane ownership. This step publishes the ready-version/activity contract used by STEP-10-04 and the mobile banner contract used by STEP-10-07.

### Concrete starting points

- Domain/persistence: `packages/domain/src/source-uploads.ts`, `directory-controls.ts`, `dataset-catalog.ts`; `packages/persistence/src/repositories/interfaces.ts` (`SourceRepo`, `SourceVersionRepo`), `directory-controls.ts`, `dataset-materializations.ts`, event-journal readers, and the next migration only if a new batch projection is required.
- Storage/worker: `packages/source-storage/src/object-store.ts`; `apps/worker/src/jobs/ingest-source.ts`, `materialize-dataset.ts`, and existing directory refresh/discovery adapters.
- API: `apps/api/src/routes/sources.ts`, `directories.ts`, `ingestion-jobs.ts`, `directory-events.ts`, and route wiring in `main.ts`; add bounded source-catalog, browser-import, and project-activity route modules rather than embedding logic in `main.ts`.
- Web: `apps/web/src/api/directories.ts`, `hooks/useSSE.ts`, `components/DirectoryControlPanel.tsx`, `IngestionJobStatus.tsx`, and `SourceControls.tsx`; add `api/sources.ts`, `SourceImportPanel`, `BackgroundActivityTray`, source catalog/list components, and a project activity store.

### Required contracts and behavior

1. A catalog row exposes source ID, display name, kind, immutable latest version ID/version, readiness, media/format summary, updated time, and current/last job summary. It never reports a source ready until the immutable version/materialization commit exists.
2. Initial project load fetches catalog plus active/recent activity before subscribing to cursor-based project activity SSE. Replay deduplicates by cursor/identity so refresh before the first live event cannot lose or duplicate progress.
3. Replace base64 JSON for browser uploads with bounded multipart/stream staging. Enforce configured per-file bytes, batch file count, aggregate bytes, allowed extension/media pairs, and actual streamed bytes. Keep current `MAX_TEXT_SOURCE_BYTES` compatibility only as a server configuration input, not as a browser transport design.
4. Import mode is explicit: document files use the current `source-uploads.ts` allowlist; paste text creates a named text/Markdown source; structured data adds CSV/TSV/JSON/JSONL/Parquet validators and enters the existing dataset snapshot/materialization path; the server does not guess document-versus-dataset semantics from content.
5. Browser folder import uploads selected file bytes plus normalized POSIX relative paths. Reject absolute paths, `..`, empty components, control characters, duplicates after normalization, and policy limits. Never accept or expose a client absolute path, follow a symlink, or ask the server to scan the browser host.
6. If directory selection is unsupported, omit/disable it with a plain explanation and keep multi-file selection available. Do not polyfill unsafe path access.
7. A client batch idempotency key makes double submit/retry return the committed batch. Each accepted item has independent durable success/failure; one failure never deletes a successful source.
8. Source selection returns to navigation only after the API has durably staged/enqueued the batch. The reserved activity tray hydrates after reload, expands to item detail, retains attention-required failures, and collapses 3–5 seconds after all items succeed.
9. Retry creates/fences a new attempt against the same authorized logical source where safe; cancel is best effort and terminal commits win races. Remove/dismiss changes UI/task visibility, not immutable successful source history.

### Security, performance, non-goals, and recovery

- Every catalog/job/event/import route derives workspace scope from auth and proves project/source/job ownership. Foreign and missing resources are indistinguishable.
- Stream to staged storage with backpressure; do not buffer a large dataset or whole folder in API/web memory. Bound activity hydration/page size and SSE replay/fanout for concurrent batches.
- Preserve immutable source versions, registered-root security, dataset sidecar limits, and worker idempotency. Do not build a second ingestion pipeline or overlay/toast progress system.
- Explicit recovery states: unsupported capability/type, zero-byte/oversize, duplicate, partial/complete failure, offline/timeout, refresh mid-batch, replay gap, cancel race, and retry exhaustion. Successful work remains visible and queryable.
- Handoff records final source kinds, limit configuration/defaults, catalog/activity schemas, SSE cursor semantics, and how STEP-10-04 obtains ready immutable version IDs.

### Readiness verdict

- **Pass.** Browser-safe folder and structured-data semantics, durable hydration/replay, exact starting paths, limits, failure recovery, security, performance, integration, and handoff are resolved.

## Related Notes

- Step: [[02_Phases/Phase_10_v1_usable_research_workspace/Steps/Step_03_deliver-source-catalog-and-non-blocking-import|STEP-10-03 Deliver Source Catalog and Non Blocking Import]]
- Phase: [[02_Phases/Phase_10_v1_usable_research_workspace/Phase|Phase 10 v1 usable research workspace]]
