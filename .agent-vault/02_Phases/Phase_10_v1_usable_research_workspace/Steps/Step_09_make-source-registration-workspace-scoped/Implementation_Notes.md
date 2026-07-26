# Implementation Notes

- `Source.projectId`, browser import batches, registration aggregates, and ingestion payloads support `null` for workspace-only sources.
- The API forces project-route imports to attach and converts a library request with attachment disabled into a null project scope.
- Migration 0022 preserves origin-project attachment only for non-null project IDs, disambiguates legacy duplicate batch IDs, and refuses rollback after workspace-only imports exist.
- The worker skips project-only text indexing and dataset materialization for unattached sources, while still creating immutable source versions and completion events.
- A stale local migration record and artifact bind mount required a greenfield database/container recreation before the full suite was reproducible.

## Related Notes

- Step: [[02_Phases/Phase_10_v1_usable_research_workspace/Steps/Step_09_make-source-registration-workspace-scoped|STEP-10-09 Make Source Registration Workspace Scoped]]
- Phase: [[02_Phases/Phase_10_v1_usable_research_workspace/Phase|Phase 10 v1 usable research workspace]]
