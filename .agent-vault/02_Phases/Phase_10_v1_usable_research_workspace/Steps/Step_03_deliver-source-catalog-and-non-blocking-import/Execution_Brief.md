# Execution Brief

- Record why the step exists, prerequisites, likely code paths, and the smallest execution checklist here.

- Prerequisite: STEP-10-02 stable shell and left-pane ownership.
- Required reading: approved design; Phase 02–04; DEC-0006 and DEC-0009; existing source registration, directory controls, dataset catalog, worker ingestion, and SSE code.
- Starting files: source/domain schemas; persistence source, directory, and dataset repositories and migrations; `apps/api/src/main.ts`; `apps/api/src/routes/sources.ts`; `apps/web/src/api/directories.ts`; source-control components.
- Checklist: expose project source catalog; define browser-safe upload and staging limits; adapt existing ingestion pipelines; implement left-pane import states; create the project activity store; reserve activity-tray space above account; return to navigation after selection; expose retry, cancel, and review.
- Edge cases: duplicate files, unsupported type, mixed success, zero-byte or oversized file, unsafe folder input, cancellation, reconnect/replay, refresh mid-upload, concurrent batches, and ready-source use during processing.
- Rollback boundary: upload adapters remain removable without changing immutable source/version or existing directory-ingestion contracts.

## Related Notes

- Step: [[02_Phases/Phase_10_v1_usable_research_workspace/Steps/Step_03_deliver-source-catalog-and-non-blocking-import|STEP-10-03 Deliver Source Catalog and Non Blocking Import]]
- Phase: [[02_Phases/Phase_10_v1_usable_research_workspace/Phase|Phase 10 v1 usable research workspace]]
