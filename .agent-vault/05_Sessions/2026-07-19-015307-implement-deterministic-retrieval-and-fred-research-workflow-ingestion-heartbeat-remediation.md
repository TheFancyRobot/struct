---
note_type: session
template_version: 2
contract_version: 1
title: ingestion-heartbeat-remediation session for Implement Deterministic Retrieval and Fred Research Workflow
session_id: SESSION-2026-07-19-015307
date: '2026-07-19'
status: completed
owner: ingestion-heartbeat-remediation
branch: ''
phase: '[[02_Phases/Phase_01_walking_skeleton/Phase|Phase 01 walking skeleton]]'
context:
  context_id: SESSION-2026-07-19-015307
  status: active
  updated_at: '2026-07-19T01:53:07.534Z'
  current_focus:
    summary: Advance [[02_Phases/Phase_01_walking_skeleton/Steps/Step_04_implement-deterministic-retrieval-and-fred-research-workflow|STEP-01-04 Implement Deterministic Retrieval and Fred Research Workflow]].
    target: '[[02_Phases/Phase_01_walking_skeleton/Steps/Step_04_implement-deterministic-retrieval-and-fred-research-workflow|STEP-01-04 Implement Deterministic Retrieval and Fred Research Workflow]]'
  resume_target:
    type: step
    target: '[[02_Phases/Phase_01_walking_skeleton/Steps/Step_04_implement-deterministic-retrieval-and-fred-research-workflow|STEP-01-04 Implement Deterministic Retrieval and Fred Research Workflow]]'
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

# ingestion-heartbeat-remediation session for Implement Deterministic Retrieval and Fred Research Workflow

Use one note per meaningful work session. Record chronology, validation, and handoff state, but promote durable conclusions into phase, architecture, bug, or decision notes. See [[07_Templates/Note_Contracts|Note Contracts]].

## Objective

- Advance [[02_Phases/Phase_01_walking_skeleton/Steps/Step_04_implement-deterministic-retrieval-and-fred-research-workflow|STEP-01-04 Implement Deterministic Retrieval and Fred Research Workflow]].
- Leave a clean handoff if the work stops mid-step.

## Planned Scope

- Review [[02_Phases/Phase_01_walking_skeleton/Steps/Step_04_implement-deterministic-retrieval-and-fred-research-workflow|STEP-01-04 Implement Deterministic Retrieval and Fred Research Workflow]] before editing.
- Record changed paths and validation as the session progresses.

## Execution Log

<!-- AGENT-START:session-execution-log -->
- 01:53 - Created session note.
- 01:53 - Linked related step [[02_Phases/Phase_01_walking_skeleton/Steps/Step_04_implement-deterministic-retrieval-and-fred-research-workflow|STEP-01-04 Implement Deterministic Retrieval and Fred Research Workflow]].
<!-- AGENT-END:session-execution-log -->

## Findings

- Record important facts learned during the session.
- Ingestion previously renewed its lease only incidentally at source-version and event transitions, leaving artifact ingestion and indexing exposed to stale recovery.
- `JobQueueRepo.renewLease` now uses PostgreSQL `NOW()` and fences by job ID, ingestion entity type, source ID, workspace ID, in-progress status, and exact attempt.
- Ingestion stale recovery now compares the database clock to a relative stale age, eliminating replica host-clock skew from ownership decisions.
- The worker races the entire claimed ingestion path against a bounded heartbeat. Typed ownership loss interrupts and safely no-ops; heartbeat infrastructure failures remain fatal to the poll loop.
- Review hardening extended the exact ingestion heartbeat fence to source-version creation: the same transaction now verifies the claimed job aggregate and the source-to-project workspace relationship before renewing `updated_at` and inserting the immutable `SourceVersion`.
- Focused evidence: 19/19 ownership unit tests and the serial PostgreSQL source-version ownership case pass; root typecheck, lint, dependency boundaries, and diff hygiene also pass.

## Context Handoff

- Use this as the single canonical prose section for prepared context, resume notes, and handoff summaries tied to the current effective context.
- Keep durable conclusions promoted into phase, bug, decision, or architecture notes when they outlive the session.
- Root should preserve the exact fenced renewal predicate and the database-relative stale age when combining concurrent remediation units.
- Root should run the complete repository and PostgreSQL gates once all concurrent workers release their slots.

## Changed Paths

<!-- AGENT-START:session-changed-paths -->
- None yet.
<!-- AGENT-END:session-changed-paths -->
- `apps/worker/src/config.ts`
- `apps/worker/src/config.test.ts`
- `apps/worker/src/jobs/ingest-source.ts`
- `apps/worker/src/jobs/ingest-source.test.ts`
- `apps/worker/src/main.ts` (ingestion configuration and wiring only)
- `apps/api/src/routes/sources.integration.test.ts`
- `packages/persistence/src/errors.ts`
- `packages/persistence/src/repositories/interfaces.ts`
- `packages/persistence/src/repositories/ownership.test.ts`
- `packages/persistence/src/repositories/ownership.integration.test.ts`
- `packages/persistence/src/repositories/job-event.test.ts`
- `packages/persistence/src/repositories/job-event.integration.test.ts`

## Validation Run

<!-- AGENT-START:session-validation-run -->
- Command: not run yet
- Result: not run
- Notes: 
<!-- AGENT-END:session-validation-run -->
- Focused ingestion/config/persistence unit filter: 29 passed, 0 failed.
- Ingestion worker suite after final narrowing fix: 16 passed, 0 failed, 65 assertions.
- PostgreSQL exact-lease ownership suite: 4 passed, 0 failed, including current-attempt renewal and stale-attempt rejection.
- PostgreSQL source ingestion plus stale-recovery suites: 4 passed, 0 failed.
- `apps/worker` TypeScript project: passed.
- `packages/persistence` TypeScript project: passed.
- ESLint on changed production files: 0 errors; repository configuration ignores test files and reported only ignored-file warnings.

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
- [ ] Continue [[02_Phases/Phase_01_walking_skeleton/Steps/Step_04_implement-deterministic-retrieval-and-fred-research-workflow|STEP-01-04 Implement Deterministic Retrieval and Fred Research Workflow]].
<!-- AGENT-END:session-follow-up-work -->

## Completion Summary

- State what finished, what remains, and whether handoff is clean.
- Completed the continuous ingestion lease heartbeat remediation with database-clock stale recovery, exact attempt/workspace/source fencing, bounded timing derivation, interruption-safe worker racing, and deterministic unit/PostgreSQL regression coverage.
- Existing atomic source-version and event transition lease touches remain intact.
- No research, retrieval, documentation-count, or root-test-scope code was changed by this unit.
- Handoff is clean; root orchestration owns combined-tree validation, git, and publication.
