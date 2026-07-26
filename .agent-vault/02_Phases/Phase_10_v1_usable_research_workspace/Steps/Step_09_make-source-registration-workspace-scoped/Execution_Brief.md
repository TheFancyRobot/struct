# Execution Brief

- Purpose: allow workspace-library imports before any project exists, while retaining explicit project attachment for project-scoped imports.
- Prerequisites: read [[01_Architecture/Domain_Model|Domain Model]], [[01_Architecture/Integration_Map|Integration Map]], and BUG-0046.
- Primary code paths: `apps/web/src/pages/SourcesPage.tsx`, `apps/api/src/main.ts`, `packages/persistence/src/repositories/source-registration.ts`, `apps/worker/src/jobs/ingest-source.ts`, and migration `0022_workspace_source_registration`.

## Execution Checklist

- Remove the project-selection gate from the source library.
- Persist a null project scope for unattached workspace imports; require attachment on project routes.
- Keep batch replay workspace-scoped and ingestion valid without a project index.
- Apply and test the greenfield migration, then run focused regressions and the full suite.

## Related Notes

- Step: [[02_Phases/Phase_10_v1_usable_research_workspace/Steps/Step_09_make-source-registration-workspace-scoped|STEP-10-09 Make Source Registration Workspace Scoped]]
- Phase: [[02_Phases/Phase_10_v1_usable_research_workspace/Phase|Phase 10 v1 usable research workspace]]
