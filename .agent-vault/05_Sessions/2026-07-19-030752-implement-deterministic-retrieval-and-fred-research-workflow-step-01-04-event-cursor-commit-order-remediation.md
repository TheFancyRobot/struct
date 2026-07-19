---
note_type: session
template_version: 2
contract_version: 1
title: step-01-04-event-cursor-commit-order-remediation session for Implement Deterministic Retrieval and Fred Research Workflow
session_id: SESSION-2026-07-19-030752
date: '2026-07-19'
status: completed
owner: step-01-04-event-cursor-commit-order-remediation
branch: ''
phase: '[[02_Phases/Phase_01_walking_skeleton/Phase|Phase 01 walking skeleton]]'
context:
  context_id: SESSION-2026-07-19-030752
  status: completed
  updated_at: '2026-07-19T03:22:00.000Z'
  current_focus:
    summary: Advance [[02_Phases/Phase_01_walking_skeleton/Steps/Step_04_implement-deterministic-retrieval-and-fred-research-workflow|STEP-01-04 Implement Deterministic Retrieval and Fred Research Workflow]].
    target: '[[02_Phases/Phase_01_walking_skeleton/Steps/Step_04_implement-deterministic-retrieval-and-fred-research-workflow|STEP-01-04 Implement Deterministic Retrieval and Fred Research Workflow]]'
  resume_target:
    type: step
    target: '[[02_Phases/Phase_01_walking_skeleton/Steps/Step_04_implement-deterministic-retrieval-and-fred-research-workflow|STEP-01-04 Implement Deterministic Retrieval and Fred Research Workflow]]'
    section: Context Handoff
  last_action:
    type: saved
related_bugs:
  - '[[03_Bugs/BUG-0007_event-journal-cursors-can-commit-out-of-replay-order|BUG-0007 Event journal cursors can commit out of replay order]]'
related_decisions: []
created: '2026-07-19'
updated: '2026-07-19'
tags:
  - agent-vault
  - session
---

# step-01-04-event-cursor-commit-order-remediation session for Implement Deterministic Retrieval and Fred Research Workflow

Use one note per meaningful work session. Record chronology, validation, and handoff state, but promote durable conclusions into phase, architecture, bug, or decision notes. See [[07_Templates/Note_Contracts|Note Contracts]].

## Objective

- Advance [[02_Phases/Phase_01_walking_skeleton/Steps/Step_04_implement-deterministic-retrieval-and-fred-research-workflow|STEP-01-04 Implement Deterministic Retrieval and Fred Research Workflow]].
- Leave a clean handoff if the work stops mid-step.

## Planned Scope

- Review [[02_Phases/Phase_01_walking_skeleton/Steps/Step_04_implement-deterministic-retrieval-and-fred-research-workflow|STEP-01-04 Implement Deterministic Retrieval and Fred Research Workflow]] before editing.
- Record changed paths and validation as the session progresses.

## Execution Log

<!-- AGENT-START:session-execution-log -->
- 03:07 - Created session note.
- 03:07 - Linked related step [[02_Phases/Phase_01_walking_skeleton/Steps/Step_04_implement-deterministic-retrieval-and-fred-research-workflow|STEP-01-04 Implement Deterministic Retrieval and Fred Research Workflow]].
<!-- AGENT-END:session-execution-log -->
- 03:09 - Added reversible migration `0004_event_journal_commit_order`, replacing the `BIGSERIAL` default with a trigger that holds a relation-scoped advisory transaction lock before sequence allocation.
- 03:12 - Added deterministic two-connection PostgreSQL coverage for the legacy late-lower-cursor replay loss, protected commit ordering, rollback gaps, concurrent inserts, explicit-cursor override, and down/up restoration.
- 03:17 - Aligned architecture, research replay, spike handoff, local-development, Code Map, implementation notes, and BUG-0007.
- 03:22 - Completed the full maintained Bun/PostgreSQL and static validation gates.

## Findings

- PostgreSQL sequence allocation is non-transactional and cannot itself serve as a replay checkpoint order.
- A table-bound `BEFORE INSERT` trigger can enforce the invariant for every caller: acquire a transaction advisory lock keyed by relation OID, allocate from the existing owned sequence, and retain the lock through commit/rollback.
- PostgreSQL releases the transaction lock only as the transaction resolves, so the next allocator cannot proceed before the prior insert is commit-visible or rolled back. Rolled-back allocations remain harmless gaps.
- The legacy defect is deterministically observable under the down migration; the forward migration blocks connection B until connection A resolves and preserves `WHERE cursor > checkpoint` replay.

## Context Handoff

- Use this as the single canonical prose section for prepared context, resume notes, and handoff summaries tied to the current effective context.
- Keep durable conclusions promoted into phase, bug, decision, or architecture notes when they outlive the session.

## Changed Paths

<!-- AGENT-START:session-changed-paths -->
<!-- AGENT-END:session-changed-paths -->
- `packages/persistence/src/migrations/0004_event_journal_commit_order.sql`
- `packages/persistence/src/migrations/0004_event_journal_commit_order.down.sql`
- `packages/persistence/src/migrations/manifest.ts`
- `packages/persistence/src/migrations/runner.test.ts`
- `packages/persistence/src/migrations/upgrade.integration.test.ts`
- `packages/persistence/src/migrations/event-journal-commit-order.integration.test.ts`
- `docs/architecture.md`
- `docs/research-execution-model.md`
- `docs/spikes/live-events-cancellation-and-checkpoint-recovery.md`
- `docs/local-development.md`
- `.agent-vault/01_Architecture/Code_Map.md`
- `.agent-vault/03_Bugs/BUG-0007_event-journal-cursors-can-commit-out-of-replay-order.md`
- `.agent-vault/02_Phases/Phase_01_walking_skeleton/Steps/Step_04_implement-deterministic-retrieval-and-fred-research-workflow/Implementation_Notes.md`
- `.agent-vault/05_Sessions/2026-07-19-030752-implement-deterministic-retrieval-and-fred-research-workflow-step-01-04-event-cursor-commit-order-remediation.md`

## Validation Run

<!-- AGENT-START:session-validation-run -->
<!-- AGENT-END:session-validation-run -->
- `DATABASE_URL=postgresql://struct:struct@localhost:5432/struct bun test --max-concurrency 1 ./apps ./packages` — PASS, 259 tests across 39 files, 1,428 assertions.
- Focused migration suite — PASS, 11 tests including existing upgrade, runner inventory, deterministic legacy reproduction, protected concurrency, rollback, and round trip.
- `bun run typecheck` — PASS.
- `bun run lint` — PASS.
- `bun run lint:imports` — PASS, 48 modules / 94 dependencies, zero violations.
- `bun run build` — PASS for web, API, and worker.
- `docker compose config --quiet` — PASS.
- Deployed schema inspection — migration tracked, allocator trigger installed, cursor default absent.
- Trailing-whitespace scan of changed BUG-0007 paths — PASS after session completion.

## Bugs Encountered

<!-- AGENT-START:session-bugs-encountered -->
<!-- AGENT-END:session-bugs-encountered -->
- [[03_Bugs/BUG-0007_event-journal-cursors-can-commit-out-of-replay-order|BUG-0007]] fixed and verified.
- The first full gate exposed a stale ingestion integration fixture after concurrent exact-payload-contract hardening; the owning remediation updated the fixture, and the repeated full gate passed 259/259.

## Decisions Made or Updated

<!-- AGENT-START:session-decisions-made-or-updated -->
- None.
<!-- AGENT-END:session-decisions-made-or-updated -->

## Follow-Up Work

<!-- AGENT-START:session-follow-up-work -->
<!-- AGENT-END:session-follow-up-work -->
- [x] No BUG-0007 implementation work remains. Root orchestration owns independent review, git publication, PR feedback, and merge.

## Completion Summary

- BUG-0007 is fixed locally with a reversible, upgrade-safe PostgreSQL allocator that makes event cursor order agree with commit visibility for every insert path. Deterministic real-DB regression coverage proves both the legacy loss and the protected behavior. Documentation and durable Vault context are aligned; validation is clean and the handoff is ready for root-owned review/publication.
