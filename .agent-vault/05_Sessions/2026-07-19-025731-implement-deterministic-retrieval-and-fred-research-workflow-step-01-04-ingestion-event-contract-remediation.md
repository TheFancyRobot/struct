---
note_type: session
template_version: 2
contract_version: 1
title: step-01-04-ingestion-event-contract-remediation session for Implement Deterministic Retrieval and Fred Research Workflow
session_id: SESSION-2026-07-19-025731
date: '2026-07-19'
status: completed
owner: step-01-04-ingestion-event-contract-remediation
branch: ''
phase: '[[02_Phases/Phase_01_walking_skeleton/Phase|Phase 01 walking skeleton]]'
context:
  context_id: SESSION-2026-07-19-025731
  status: active
  updated_at: '2026-07-19T02:57:31.175Z'
  current_focus:
    summary: Advance [[02_Phases/Phase_01_walking_skeleton/Steps/Step_04_implement-deterministic-retrieval-and-fred-research-workflow|STEP-01-04 Implement Deterministic Retrieval and Fred Research Workflow]].
    target: '[[02_Phases/Phase_01_walking_skeleton/Steps/Step_04_implement-deterministic-retrieval-and-fred-research-workflow|STEP-01-04 Implement Deterministic Retrieval and Fred Research Workflow]]'
  resume_target:
    type: step
    target: '[[02_Phases/Phase_01_walking_skeleton/Steps/Step_04_implement-deterministic-retrieval-and-fred-research-workflow|STEP-01-04 Implement Deterministic Retrieval and Fred Research Workflow]]'
    section: Context Handoff
  last_action:
    type: saved
related_bugs: '[[03_Bugs/BUG-0006_job-transitions-persist-unvalidated-cross-domain-journal-payloads|BUG-0006 Job transitions persist unvalidated cross-domain journal payloads]]'
related_decisions: []
created: '2026-07-19'
updated: '2026-07-19'
tags:
  - agent-vault
  - session
---

# step-01-04-ingestion-event-contract-remediation session for Implement Deterministic Retrieval and Fred Research Workflow

Use one note per meaningful work session. Record chronology, validation, and handoff state, but promote durable conclusions into phase, architecture, bug, or decision notes. See [[07_Templates/Note_Contracts|Note Contracts]].

## Objective

- Advance [[02_Phases/Phase_01_walking_skeleton/Steps/Step_04_implement-deterministic-retrieval-and-fred-research-workflow|STEP-01-04 Implement Deterministic Retrieval and Fred Research Workflow]].
- Leave a clean handoff if the work stops mid-step.

## Planned Scope

- Review [[02_Phases/Phase_01_walking_skeleton/Steps/Step_04_implement-deterministic-retrieval-and-fred-research-workflow|STEP-01-04 Implement Deterministic Retrieval and Fred Research Workflow]] before editing.
- Record changed paths and validation as the session progresses.

## Execution Log

<!-- AGENT-START:session-execution-log -->
- 02:57 - Created session note.
- 02:57 - Linked related step [[02_Phases/Phase_01_walking_skeleton/Steps/Step_04_implement-deterministic-retrieval-and-fred-research-workflow|STEP-01-04 Implement Deterministic Retrieval and Fred Research Workflow]].
<!-- AGENT-END:session-execution-log -->
- 02:57 - Loaded BUG-0006, STEP-01-04, the Vault operating contract, and Effect service/error conventions.
- 03:01 - Added strict ingestion append/complete/pending/fail event validation and ownership-derived persistence.
- 03:07 - Added exhaustive unit and serial PostgreSQL contract matrices, then reconciled legacy permissive fixtures.
- 03:10 - Completed focused, integration, full maintained-host test, and static validation.

## Findings

- Record important facts learned during the session.
- The repository previously checked lease aggregate scope but accepted arbitrary transition payload keys and linkage.
- PostgreSQL JSONB values may arrive as serialized strings through the configured client, so authoritative job payload validation must safely decode either representation.
- The owned job provides the authoritative byte length; the owned immutable SourceVersion provides source identity, manifest reference, and content hash. The normalized artifact reference is deterministically derivable from the content hash.

## Context Handoff

- Use this as the single canonical prose section for prepared context, resume notes, and handoff summaries tied to the current effective context.
- Keep durable conclusions promoted into phase, bug, decision, or architecture notes when they outlive the session.

## Changed Paths

<!-- AGENT-START:session-changed-paths -->
- None yet.
<!-- AGENT-END:session-changed-paths -->
- `packages/persistence/src/errors.ts`
- `packages/persistence/src/index.ts`
- `packages/persistence/src/repositories/interfaces.ts`
- `packages/persistence/src/repositories/ingestion-event-contract.test.ts`
- `packages/persistence/src/repositories/ingestion-event-contract.integration.test.ts`
- `packages/persistence/src/repositories/ownership.test.ts`
- `packages/persistence/src/repositories/ownership.integration.test.ts`
- `apps/api/src/routes/sources.integration.test.ts`
- `apps/worker/src/jobs/ingest-source.ts`
- `apps/worker/src/jobs/ingest-source.test.ts`

## Validation Run

<!-- AGENT-START:session-validation-run -->
- Command: not run yet
- Result: not run
- Notes: 
<!-- AGENT-END:session-validation-run -->
- `DATABASE_URL=postgresql://struct:struct@localhost:5432/struct bun test --max-concurrency 1 ./apps ./packages` — 249 passed, 0 failed, 1226 assertions across 37 files.
- Focused ingestion/persistence/API matrix — 57 passed, 0 failed, 493 assertions across 6 files.
- Dedicated contract unit matrix — 3 passed, 0 failed, 59 assertions after malformed UUID coverage.
- Dedicated serial PostgreSQL contract matrix — 3 passed, 0 failed, 46 assertions.
- `bun run lint`, `bun run typecheck`, `bun run lint:imports`, and `git diff --check` passed before a concurrent research-execution edit introduced unrelated call-arity errors; root orchestration was notified to reconcile and rerun the global gate.
- Final combined concurrent-state rerun: `DATABASE_URL=postgresql://struct:struct@localhost:5432/struct bun test --max-concurrency 1 ./apps ./packages` — 250 passed, 0 failed, 1236 assertions across 37 files.
- Final combined `bun run typecheck`, `bun run lint`, `bun run lint:imports`, and `git diff --check` — all passed.

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
- [x] BUG-0006 ingestion transition remediation is implemented and focused validation is complete.
- [ ] Root orchestrator must rerun the exact combined repository gate after concurrent research-event remediation settles, then independently review and publish.

## Completion Summary

- State what finished, what remains, and whether handoff is clean.
- Hardened all four ingestion job transition contracts with typed pre-write validation, exact lease/source/workspace/attempt fencing, authoritative provenance reconstruction, sanitized failures, and atomic rejection.
- Added exhaustive unit and real PostgreSQL regression coverage for forged type, cursor, fields, linkage, retry semantics, rollback, and valid controls.
- The remediation handoff is clean; only the root-owned combined concurrent-change gate and publication remain.
