---
note_type: session
template_version: 2
contract_version: 1
title: codex-step-04-03-worker session for Implement Allowlisted Read-Only SQL Service
session_id: SESSION-2026-07-19-205401
date: '2026-07-19'
status: in-progress
owner: codex-step-04-03-worker
branch: ''
phase: '[[02_Phases/Phase_04_structured_datasets_and_deterministic_sql/Phase|Phase 04 structured datasets and deterministic sql]]'
context:
  context_id: SESSION-2026-07-19-205401
  status: active
  updated_at: '2026-07-19T20:54:01.046Z'
  current_focus:
    summary: Advance [[02_Phases/Phase_04_structured_datasets_and_deterministic_sql/Steps/Step_03_implement-allowlisted-read-only-sql-service|STEP-04-03 Implement Allowlisted Read-Only SQL Service]].
    target: '[[02_Phases/Phase_04_structured_datasets_and_deterministic_sql/Steps/Step_03_implement-allowlisted-read-only-sql-service|STEP-04-03 Implement Allowlisted Read-Only SQL Service]]'
  resume_target:
    type: step
    target: '[[02_Phases/Phase_04_structured_datasets_and_deterministic_sql/Steps/Step_03_implement-allowlisted-read-only-sql-service|STEP-04-03 Implement Allowlisted Read-Only SQL Service]]'
    section: Context Handoff
  last_action:
    type: saved
related_bugs: []
related_decisions: []
created: '2026-07-19'
updated: '2026-07-19'
tags:
  - agent-vault
  - session
---

# codex-step-04-03-worker session for Implement Allowlisted Read-Only SQL Service

Use one note per meaningful work session. Record chronology, validation, and handoff state, but promote durable conclusions into phase, architecture, bug, or decision notes. See [[07_Templates/Note_Contracts|Note Contracts]].

## Objective

- Advance [[02_Phases/Phase_04_structured_datasets_and_deterministic_sql/Steps/Step_03_implement-allowlisted-read-only-sql-service|STEP-04-03 Implement Allowlisted Read-Only SQL Service]].
- Leave a clean handoff if the work stops mid-step.

## Planned Scope

- Review [[02_Phases/Phase_04_structured_datasets_and_deterministic_sql/Steps/Step_03_implement-allowlisted-read-only-sql-service|STEP-04-03 Implement Allowlisted Read-Only SQL Service]] before editing.
- Record changed paths and validation as the session progresses.

## Execution Log

<!-- AGENT-START:session-execution-log -->
- 20:54 - Created session note.
- 20:54 - Linked related step [[02_Phases/Phase_04_structured_datasets_and_deterministic_sql/Steps/Step_03_implement-allowlisted-read-only-sql-service|STEP-04-03 Implement Allowlisted Read-Only SQL Service]].
<!-- AGENT-END:session-execution-log -->
- Loaded the complete Effect-TS skills, STEP-04-03 Execution Brief and Validation Plan, parent phase scope, DEC-0005, DEC-0009, and STEP-04-02 Outcome.
- Confirmed STEP-04-02 is merged and began target-rooted implementation.
- Root self-review remediation completed: shared client deadline budgets, safe artifact failure classification, volatile/sampling SQL rejection, projection-sensitive schema hashing, decoded result-shape invariants, Bun-side auth/catalog orchestration, and scoped materialization resolution.
- Kept the boundary service-only: no public HTTP endpoint was added because real user-auth middleware does not yet exist.
- PR #21 Codex review remediation: unreadable/malformed artifact 404 responses now fall back to retryable `handoff-not-found`; generated Active Context and the STEP-04-03 Agent-Managed Snapshot now consistently reflect the active in-progress review state.
- PR #21 CodeRabbit remediation: session managed blocks now carry authoritative changed paths and validation; SQL execution requires top-level `ORDER BY ALL`, giving a total order across every projected value before truncation and hashing while byte-identical duplicate rows remain interchangeable.
- 2026-07-19: Addressed the existing CodeRabbit findings without requesting another review: replaced placeholder generated session summaries, required top-level `ORDER BY ALL` for deterministic total ordering, expanded live sidecar coverage to 165 assertions, and restored unique vault bug identity by renumbering the Solid theme fix from BUG-0007 to BUG-0010 while preserving the original event-journal BUG-0007. Rebuilt the bug index and confirmed Agent Vault doctor is clean.

## Findings

- Record important facts learned during the session.
- DuckDB's Node adapter exposes parser-backed `extractStatements`, prepared `statementType`, and `getTableNames`; these support a fail-closed SQL boundary without adding another parser dependency.
- Stable query values use DuckDB JSON conversion followed by string/boolean/null normalization, preserving integer and decimal exactness across the protocol.

## Context Handoff

- Use this as the single canonical prose section for prepared context, resume notes, and handoff summaries tied to the current effective context.
- Keep durable conclusions promoted into phase, bug, decision, or architecture notes when they outlive the session.

## Changed Paths

<!-- AGENT-START:session-changed-paths -->
- Data-engine protocol/client/query service and tests.
- Sidecar SQL policy/execution and live integration coverage.
- Scoped dataset materialization resolver and PostgreSQL coverage.
- Worker materialization client-shape updates.
- STEP-04-03 step, companion, outcome, and session notes.
<!-- AGENT-END:session-changed-paths -->
- `packages/data-engine/src/protocol.ts`
- `packages/data-engine/src/protocol.test.ts`
- `packages/data-engine/src/client.ts`
- `packages/data-engine/src/client.test.ts`
- `packages/data-engine/src/materialize.ts`
- `packages/data-engine/test/sidecar.integration.test.ts`
- `services/data-engine-sidecar/server.mjs`
- `apps/worker/src/jobs/materialize-dataset.ts`
- `apps/worker/src/jobs/materialize-dataset.test.ts`
- STEP-04-03 Implementation Notes, Outcome, step mirror, and this session note.
- Added `packages/data-engine/src/query-service.ts` and `query-service.test.ts`.
- Updated `packages/persistence/src/repositories/dataset-materializations.ts`, its integration test, and persistence exports for scoped immutable query resolution.
- Updated client/server/live tests and STEP-04-03 durable notes for root-review remediation.

## Validation Run

<!-- AGENT-START:session-validation-run -->
- Command: default and PostgreSQL/live aggregate suites plus static, container,
  documentation, secrets, and vault gates.
- Result: passed.
- Notes: 404 default tests passed with 144 expected skips and 1,588 assertions;
  499 PostgreSQL/live tests passed with 2,490 assertions; live sidecar passed
  2 tests with 165 assertions.
<!-- AGENT-END:session-validation-run -->
- `bun run test`: 404 pass, 144 skip, 0 fail, 1,588 assertions.
- `DATABASE_URL=postgres://struct:struct@127.0.0.1:5432/struct DATA_ENGINE_INTEGRATION=1 bun run test`: 499 pass, 0 fail, 2,490 assertions.
- `DATA_ENGINE_INTEGRATION=1 bun test packages/data-engine/test/sidecar.integration.test.ts`: 2 pass, 0 fail, 165 assertions.
- Focused service/client, PostgreSQL resolver, and live-sidecar suites passed.
- `bun run typecheck`, `bun run lint`, `bun run lint:imports`, `bun run build`, `bun run docs:lint`, `bun run secrets:scan`, `docker compose config --quiet`, `node --check services/data-engine-sidecar/server.mjs`, image rebuild/health, and Agent Vault doctor: passed.
- Root-review remediation focused suite: 22 passed, 0 failed, 258 assertions.
- Live rebuilt sidecar: 2 passed, 0 failed, 165 assertions; covers total ordering, join/filter, timeout, disconnect recovery, volatile/sampling rejection, and result-schema hashing.
- Scoped PostgreSQL materialization resolver: 3 passed, 0 failed, 29 assertions; covers exact scope, cross-workspace rejection, and missing materialization.
- Root typecheck, ESLint, dependency/import boundaries, Compose image rebuild/health, and manual sanitized 500 artifact-engine classification passed.

## Bugs Encountered

<!-- AGENT-START:session-bugs-encountered -->
- None.
<!-- AGENT-END:session-bugs-encountered -->

## Decisions Made or Updated

<!-- AGENT-START:session-decisions-made-or-updated -->
- None.
<!-- AGENT-END:session-decisions-made-or-updated -->

## Follow-Up Work

<!-- AGENT-START:session-follow-up-work -->
- [ ] Continue [[02_Phases/Phase_04_structured_datasets_and_deterministic_sql/Steps/Step_03_implement-allowlisted-read-only-sql-service|STEP-04-03 Implement Allowlisted Read-Only SQL Service]].
<!-- AGENT-END:session-follow-up-work -->
- [x] Root independently self-reviewed and remediated the SQL allowlist,
  protocol, authenticated catalog boundary, and failure semantics.
- [ ] Publish the dedicated STEP-04-03 PR, address all actionable review feedback, and merge before STEP-04-04.

## Completion Summary

- State what finished, what remains, and whether handoff is clean.
- STEP-04-03 implementation and local validation are complete with no known defect.
- The handoff is clean for root self-review, branch commit/push, PR checks, bot feedback remediation, and merge.
- Keep the step/session in progress until the root orchestration gates complete.
