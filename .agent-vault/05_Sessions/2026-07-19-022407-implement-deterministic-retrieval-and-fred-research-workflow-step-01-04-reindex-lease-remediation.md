---
note_type: session
template_version: 2
contract_version: 1
title: step-01-04-reindex-lease-remediation session for Implement Deterministic Retrieval and Fred Research Workflow
session_id: SESSION-2026-07-19-022407
date: '2026-07-19'
status: completed
owner: step-01-04-reindex-lease-remediation
branch: ''
phase: '[[02_Phases/Phase_01_walking_skeleton/Phase|Phase 01 walking skeleton]]'
context:
  context_id: SESSION-2026-07-19-022407
  status: active
  updated_at: '2026-07-19T02:24:07.724Z'
  current_focus:
    summary: Advance [[02_Phases/Phase_01_walking_skeleton/Steps/Step_04_implement-deterministic-retrieval-and-fred-research-workflow|STEP-01-04 Implement Deterministic Retrieval and Fred Research Workflow]].
    target: '[[02_Phases/Phase_01_walking_skeleton/Steps/Step_04_implement-deterministic-retrieval-and-fred-research-workflow|STEP-01-04 Implement Deterministic Retrieval and Fred Research Workflow]]'
  resume_target:
    type: step
    target: '[[02_Phases/Phase_01_walking_skeleton/Steps/Step_04_implement-deterministic-retrieval-and-fred-research-workflow|STEP-01-04 Implement Deterministic Retrieval and Fred Research Workflow]]'
    section: Context Handoff
  last_action:
    type: saved
related_bugs: '[''[[03_Bugs/BUG-0004_source-text-reindex-lacks-continuous-lease-renewal-and-database-clock-recovery|BUG-0004 Source text reindex lacks continuous lease renewal and database clock recovery]]'']'
related_decisions: []
created: '2026-07-19'
updated: '2026-07-19'
tags:
  - agent-vault
  - session
---

# step-01-04-reindex-lease-remediation session for Implement Deterministic Retrieval and Fred Research Workflow

Use one note per meaningful work session. Record chronology, validation, and handoff state, but promote durable conclusions into phase, architecture, bug, or decision notes. See [[07_Templates/Note_Contracts|Note Contracts]].

## Objective

- Advance [[02_Phases/Phase_01_walking_skeleton/Steps/Step_04_implement-deterministic-retrieval-and-fred-research-workflow|STEP-01-04 Implement Deterministic Retrieval and Fred Research Workflow]].
- Leave a clean handoff if the work stops mid-step.

## Planned Scope

- Review [[02_Phases/Phase_01_walking_skeleton/Steps/Step_04_implement-deterministic-retrieval-and-fred-research-workflow|STEP-01-04 Implement Deterministic Retrieval and Fred Research Workflow]] before editing.
- Record changed paths and validation as the session progresses.

## Execution Log

<!-- AGENT-START:session-execution-log -->
- 02:24 - Created session note.
- 02:24 - Linked related step [[02_Phases/Phase_01_walking_skeleton/Steps/Step_04_implement-deterministic-retrieval-and-fred-research-workflow|STEP-01-04 Implement Deterministic Retrieval and Fred Research Workflow]].
<!-- AGENT-END:session-execution-log -->
- Follow-up adversarial review reproduced a stale-attempt late index insertion on real PostgreSQL after ownership had transferred.
- Remediated `TextRetrieval.indexText` with an exact attempt-scoped `FOR UPDATE` precondition and a transaction-local rollback sentinel for missing completion ownership.
- Preserved the ingestion indexing path, immutable-content conflict behavior, idempotency, and claimed-reindex serialization.
- Final concurrency review replaced the provisional job-row `FOR UPDATE` with an exact non-locking precheck plus mandatory completion-fence rollback. This avoids lock-order inversion against ingestion while still rolling back a reindex insertion when ownership transfers after the precheck. A real concurrent PostgreSQL transfer regression proves the newer attempt persists and the stale index write does not.

## Findings

- Record important facts learned during the session.
- BUG-0004 was confirmed: source-text reindex recovery accepted a host-derived absolute cutoff and claimed work had no continuous lease renewal.
- `SourceTextReindexRepo` now renews only the exact source-version/workspace/project/attempt lease and stale recovery compares a duration against PostgreSQL `NOW()`.
- The worker races artifact verification and indexing against a bounded continuous heartbeat; ownership loss interrupts the stale worker without a late failure/completion transition, while database/infrastructure heartbeat failures remain fatal.
- Failure recording now uses the same full aggregate fence; existing reindex completion remains atomically fenced by source-version/workspace/project/attempt in `TextRetrieval.indexText`.

## Context Handoff

- Use this as the single canonical prose section for prepared context, resume notes, and handoff summaries tied to the current effective context.
- Keep durable conclusions promoted into phase, bug, decision, or architecture notes when they outlive the session.

## Changed Paths

<!-- AGENT-START:session-changed-paths -->
- None yet.
<!-- AGENT-END:session-changed-paths -->
- `packages/persistence/src/errors.ts`
- `packages/persistence/src/repositories/source-text-reindex.ts`
- `packages/persistence/src/repositories/source-text-reindex.test.ts`
- `packages/persistence/src/repositories/source-text-reindex.integration.test.ts`
- `apps/worker/src/config.ts`
- `apps/worker/src/config.test.ts`
- `apps/worker/src/jobs/reindex-source-text.ts`
- `apps/worker/src/jobs/reindex-source-text.test.ts`
- `apps/worker/src/main.ts`
- `apps/api/src/routes/research.integration.test.ts`
- `apps/worker/src/jobs/reindex-source-text.integration.test.ts` — serial PostgreSQL worker-level ownership-loss and infrastructure-failure interruption coverage.
- `packages/retrieval/src/search-text.ts` — exact pre-mutation reindex ownership lock and rollback-on-lost-completion fencing.
- `packages/retrieval/test/search-text.test.ts` — pre-call transfer and transaction rollback unit regressions.
- `apps/api/src/routes/research.integration.test.ts` — serial PostgreSQL pre-call and in-transaction ownership-transfer regressions.
- `03_Bugs/BUG-0004_source-text-reindex-lacks-continuous-lease-renewal-and-database-clock-recovery.md` — follow-up root cause, fix, coverage, and timeline evidence.

## Validation Run

<!-- AGENT-START:session-validation-run -->
- Command: not run yet
- Result: not run
- Notes: 
<!-- AGENT-END:session-validation-run -->
- PASS: `bun run typecheck`.
- PASS: `bun run lint`.
- PASS: `bun run lint:imports` (47 modules, 93 dependencies; zero boundary violations).
- PASS: `bun run build` for web, API, and worker.
- PASS: focused unit gate — 25 tests across worker config/reindex and persistence reindex repository.
- PASS: serial focused + real PostgreSQL gate — 78 tests across worker suites, reindex repository unit/integration, and research integration; 0 failures.
- PASS: dedicated real PostgreSQL reindex lease suite — exact renewal scope, DB-clock retry/exhaustion recovery, and stale failure fencing.
- PASS: serial real-PostgreSQL worker boundary — 2 tests prove an actual attempt transfer interrupts indexing without index/failure/completion writes and a heartbeat infrastructure failure interrupts work while leaving the claimed row nonterminal for stale recovery.
- Final remediation evidence totals 80 passing focused/serial real-DB tests across the combined suites, with typecheck and lint rerun green after the worker integration coverage was added.
- PASS: follow-up focused unit gate — 33 tests across retrieval, reindex worker, and reindex repository; 0 failures.
- PASS: follow-up serial real-PostgreSQL gate — 24 tests across research/retrieval integration, worker reindex lease integration, and persistence reindex integration; 0 failures. This includes the previously failing late-write counterexample.
- PASS: `bun run typecheck` and `bun run lint:imports` after the transaction remediation; final lint rerun follows the one corrected unused-parameter warning.
- FINAL PASS: combined final-state focused gate — 57 tests across six unit/serial PostgreSQL suites; 0 failures, 245 assertions.
- FINAL PASS: `bun run typecheck`, `bun run lint` with zero warnings, `bun run lint:imports` (48 modules, 94 dependencies; zero violations), whitespace validation, and Agent Vault doctor (147 notes; zero errors/warnings).
- PASS: final real-concurrency PostgreSQL regression transfers ownership on a separate connection after the exact transaction precheck and before the index insert; the new attempt remains `in-progress`, the stale index row is absent, and the current attempt subsequently completes normally.
- PASS: existing real-PostgreSQL ingestion/reindex serialization regression remains green, confirming the final lock order does not steal claimed ownership or deadlock.

## Bugs Encountered

<!-- AGENT-START:session-bugs-encountered -->
- None.
<!-- AGENT-END:session-bugs-encountered -->
- Fixed [[03_Bugs/BUG-0004_source-text-reindex-lacks-continuous-lease-renewal-and-database-clock-recovery|BUG-0004 Source text reindex lacks continuous lease renewal and database clock recovery]].

## Decisions Made or Updated

<!-- AGENT-START:session-decisions-made-or-updated -->
- None.
<!-- AGENT-END:session-decisions-made-or-updated -->

## Follow-Up Work

<!-- AGENT-START:session-follow-up-work -->
- [ ] Continue [[02_Phases/Phase_01_walking_skeleton/Steps/Step_04_implement-deterministic-retrieval-and-fred-research-workflow|STEP-01-04 Implement Deterministic Retrieval and Fred Research Workflow]].
<!-- AGENT-END:session-follow-up-work -->

## Completion Summary

- State what finished, what remains, and whether handoff is clean.
- Completed BUG-0004 remediation with exact attempt-fenced continuous reindex lease renewal and PostgreSQL-clock stale recovery.
- Preserved content-addressed manifest/hash verification, retry budgets, and atomic completion/failure ownership fencing.
- Added unit and serial real-PostgreSQL regression coverage; focused typecheck, lint, import boundaries, build, and 78-test validation are green.
- Handoff is clean for root orchestration to independently review and include in the STEP-01-04 PR remediation commit.
