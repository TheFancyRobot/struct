# Outcome

- Record the final result, validation performed, and explicit follow-up here.
- Removed the workspace import route's first-project lookup. Registration,
  persistence, replay, and ingestion now accept an unattached source with
  `projectId: null`; no hidden or fallback project is created.
- Migration 0022 makes source origin and import-batch project scope nullable,
  makes batch ownership workspace-scoped, and removes automatic origin-project
  attachment.
- Regression coverage proves API registration, PostgreSQL persistence/replay,
  and worker ingestion in a workspace with zero projects.
- Validation: 44 focused tests, full TypeScript typecheck, and ESLint passed.

## Related Notes

- Step: [[02_Phases/Phase_10_v1_usable_research_workspace/Steps/Step_09_make-source-registration-workspace-scoped|STEP-10-09 Make Source Registration Workspace Scoped]]
- Phase: [[02_Phases/Phase_10_v1_usable_research_workspace/Phase|Phase 10 v1 usable research workspace]]
