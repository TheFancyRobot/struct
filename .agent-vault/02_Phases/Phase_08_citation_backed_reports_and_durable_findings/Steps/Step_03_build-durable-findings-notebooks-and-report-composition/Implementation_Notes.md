# Implementation Notes

- Capture durable findings learned during execution. Prefer short bullets with file paths, commands, and observed behavior.

- Added immutable finding and exact report-revision snapshots with append-only persistence, revision-scoped source/finding/section/claim projections, and exact provenance foreign keys.
- Added `DurableArtifactsRepo` with scoped completed-run validation, canonical claim identity checks, optimistic report revisions, exact idempotency replay, typed collision handling, and race-safe insert-loser re-reads.
- Added deterministic report composition for add, reorder, remove, selected-section edit/regeneration, exact finding allocation, and unchanged-section preservation.
- Added authenticated workspace/project API routes for finding notebooks and report creation/mutation with non-enumerating scope failures and replay-before-stale semantics.
- Added the SolidJS notebook workflow, completed-run save action, honest unsupported-citation state, matching-run citation links, responsive light/dark styling, and curated persistence error messages.
- Added Playwright coverage and screenshots at 1440x900 light and 390x844 dark under `docs/demos/durable-notebook/`.
- PostgreSQL behavioral coverage uses outer transaction rollback plus per-repository savepoints, preserving append-only production triggers while remaining repeatable.

## Related Notes

- Step: [[02_Phases/Phase_08_citation_backed_reports_and_durable_findings/Steps/Step_03_build-durable-findings-notebooks-and-report-composition|STEP-08-03 Build Durable Findings Notebooks and Report Composition]]
- Phase: [[02_Phases/Phase_08_citation_backed_reports_and_durable_findings/Phase|Phase 08 citation backed reports and durable findings]]
