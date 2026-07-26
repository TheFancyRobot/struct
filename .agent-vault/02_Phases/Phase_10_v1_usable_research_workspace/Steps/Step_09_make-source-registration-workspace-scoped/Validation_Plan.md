# Validation Plan

- Acceptance: a workspace with zero projects can import a source, receive an immutable source version, and complete ingestion without project text indexing or dataset materialization.
- Acceptance: project-route imports remain attached; library attachment is opt-in.
- Migration checks: apply all migrations on a clean greenfield database; reject rollback if workspace-only records exist.
- Commands run: focused API/web/worker/PostgreSQL regression tests, `bun run typecheck`, `bun run lint`, `bun run test`, and `vault_validate all`.
- Final evidence: 990 tests passed, 3 skipped, 0 failed; typecheck, lint, and vault validation passed.

## Related Notes

- Step: [[02_Phases/Phase_10_v1_usable_research_workspace/Steps/Step_09_make-source-registration-workspace-scoped|STEP-10-09 Make Source Registration Workspace Scoped]]
- Phase: [[02_Phases/Phase_10_v1_usable_research_workspace/Phase|Phase 10 v1 usable research workspace]]
