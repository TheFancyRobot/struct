# Implementation Notes

- Capture durable findings learned during execution. Prefer short bullets with file paths, commands, and observed behavior.
- Added `source_text_index` and `research_run_results` in migration `0003_research_text_index.sql`; normalized text is indexed by immutable `source_version_id` with generated PostgreSQL `tsvector` and GIN search.
- Added `packages/retrieval` for workspace/project/source-version-scoped deterministic FTS and stable line locators, `packages/research-engine` for fixed typed plan/result and evidence/citation checks, and `packages/fred-workflows` for the bounded Fred graph.
- Fred core is pinned exactly to `@fancyrobot/fred@2.0.0`. The walking graph contains one search tool, one answer-synthesizer agent, and a citation-validation node; configuration defaults are five steps, one tool call, one model call, and 60 seconds.
- Added `POST /research/runs`, durable worker claim/stale-recovery execution, atomic completion/failure persistence, and `research-started`, `retrieval-completed`, `citations-validated`, `research-completed`, and `research-failed` journal events.
- Extended source ingestion to carry `projectId` and index normalized text only after immutable source-version creation.
- Added mock-provider, unit, migration, route, and real PostgreSQL integration coverage for grounded completion, exact citations, insufficient evidence, scope isolation, durable terminal state, and stale recovery.
- Second independent-review remediation preserves positional evidence only in contiguous original-source windows, retains repeated lexeme occurrences and exact cross-line character locators, and limits omission-separated multi-range evidence to non-positional queries.
- Exhausted stale ingestion recovery owns its sanitized terminal journal event in the same PostgreSQL transaction as the status transition, with deterministic event identity and fault-injected rollback/idempotency coverage.
- Bun is the canonical test runtime for subsequent validation; this bounded pass did not remove existing test tooling or scripts.

## Related Notes

- Step: [[02_Phases/Phase_01_walking_skeleton/Steps/Step_04_implement-deterministic-retrieval-and-fred-research-workflow|STEP-01-04 Implement Deterministic Retrieval and Fred Research Workflow]]
- Phase: [[02_Phases/Phase_01_walking_skeleton/Phase|Phase 01 walking skeleton]]
