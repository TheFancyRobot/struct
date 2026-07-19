---
note_type: session
template_version: 2
contract_version: 1
title: step-01-04-ingestion-provenance-metadata-remediation session for Implement Deterministic Retrieval and Fred Research Workflow
session_id: SESSION-2026-07-19-030510
date: '2026-07-19'
status: completed
owner: step-01-04-ingestion-provenance-metadata-remediation
branch: ''
phase: '[[02_Phases/Phase_01_walking_skeleton/Phase|Phase 01 walking skeleton]]'
context:
  context_id: SESSION-2026-07-19-030510
  status: active
  updated_at: '2026-07-19T03:05:10.727Z'
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

# step-01-04-ingestion-provenance-metadata-remediation session for Implement Deterministic Retrieval and Fred Research Workflow

Use one note per meaningful work session. Record chronology, validation, and handoff state, but promote durable conclusions into phase, architecture, bug, or decision notes. See [[07_Templates/Note_Contracts|Note Contracts]].

## Objective

- Advance [[02_Phases/Phase_01_walking_skeleton/Steps/Step_04_implement-deterministic-retrieval-and-fred-research-workflow|STEP-01-04 Implement Deterministic Retrieval and Fred Research Workflow]].
- Leave a clean handoff if the work stops mid-step.

## Planned Scope

- Review [[02_Phases/Phase_01_walking_skeleton/Steps/Step_04_implement-deterministic-retrieval-and-fred-research-workflow|STEP-01-04 Implement Deterministic Retrieval and Fred Research Workflow]] before editing.
- Record changed paths and validation as the session progresses.

## Execution Log

<!-- AGENT-START:session-execution-log -->
- 03:05 - Created session note.
- 03:05 - Linked related step [[02_Phases/Phase_01_walking_skeleton/Steps/Step_04_implement-deterministic-retrieval-and-fred-research-workflow|STEP-01-04 Implement Deterministic Retrieval and Fred Research Workflow]].
<!-- AGENT-END:session-execution-log -->
- 03:05 - Confirmed that `file-processed` persisted caller-controlled `rawRef` provenance and that ingestion transitions did not validate journal IDs or timestamp bounds.
- 03:16 - Replaced the progress payload contract with exact manifest/content/source-version/byte-length inputs; persisted payloads are rebuilt from the locked `SourceVersion` and job, with `normalizedRef` derived from the durable content hash and no journaled raw ref.
- 03:24 - Added canonical lowercase UUID, zero cursor, and nonnegative safe-bigint `createdAt` validation before opening a SQL transaction.
- 03:31 - Incorporated review findings requiring ownership-derived `jobId`/`attempt` on every claimed and stale-exhaustion ingestion payload, plus explicit retryability semantics.
- 03:40 - Reconciled worker, API, ownership, recovery, unit, and PostgreSQL fixtures; completed focused and static validation.

## Findings

- Record important facts learned during the session.
- The durable model authorizes a manifest artifact ref and normalized content hash through `SourceVersion`; it does not independently authorize a raw artifact ref. Persisting caller `rawRef` was therefore an unprovable provenance claim.
- `file-processed` now persists `sourceVersionId`, `manifestRef`, `contentHash`, derived `normalizedRef`, job-derived `byteLength`, and ownership-derived `jobId`/`attempt`.
- Completion and failure payloads also derive `jobId`/`attempt` from the locked row. Failure payloads include exact boolean `retryable`; pending requires a retryable failure with remaining budget, while terminal failure permits a nonretryable failure immediately or a retryable failure only after exhaustion.
- Malformed/noncanonical IDs, nonzero cursors, non-bigint/negative/unsafe timestamps, extra raw provenance, and malformed payloads fail with typed `IngestionEventValidationError` before transaction SQL.

## Context Handoff

- Use this as the single canonical prose section for prepared context, resume notes, and handoff summaries tied to the current effective context.
- Keep durable conclusions promoted into phase, bug, decision, or architecture notes when they outlive the session.

## Changed Paths

<!-- AGENT-START:session-changed-paths -->
- None yet.
<!-- AGENT-END:session-changed-paths -->
- `packages/persistence/src/repositories/interfaces.ts`
- `packages/persistence/src/repositories/ingestion-event-contract.test.ts`
- `packages/persistence/src/repositories/ingestion-event-contract.integration.test.ts`
- `packages/persistence/src/repositories/ownership.test.ts`
- `packages/persistence/src/repositories/ownership.integration.test.ts`
- `packages/persistence/src/repositories/job-event.integration.test.ts`
- `apps/worker/src/jobs/ingest-source.ts`
- `apps/worker/src/jobs/ingest-source.test.ts`
- `apps/worker/src/jobs/ingest-source.integration.test.ts`
- `apps/api/src/routes/sources.integration.test.ts`
- `docs/architecture.md`

## Validation Run

<!-- AGENT-START:session-validation-run -->
- Command: not run yet
- Result: not run
- Notes: 
<!-- AGENT-END:session-validation-run -->
- PASS: focused Bun unit gate — 44 tests, 422 assertions (`ingestion-event-contract`, ownership, ingestion worker).
- PASS: serial real-PostgreSQL gate — 19 tests, 254 assertions (`ingestion-event-contract`, worker retryability, ownership, stale recovery, sources API integration).
- PASS: `bun run typecheck`.
- PASS: `bun run lint`.
- PASS: `bun run lint:imports` — 48 modules / 94 dependencies, zero dependency or boundary violations.
- PASS: `git diff --check`.

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
- BUG-0006 ingestion provenance/metadata remediation is implemented and focused validation is complete.
- Journal payload provenance is now fully reconstructable from owned durable state, raw refs are excluded, attempt identity is explicit, retryability is exact, and malformed journal metadata fails before SQL.
- Root orchestration retains the repository-wide zero-defect and PR publication gates.
