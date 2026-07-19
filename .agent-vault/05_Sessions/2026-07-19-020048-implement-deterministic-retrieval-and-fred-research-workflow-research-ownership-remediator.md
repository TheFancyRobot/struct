---
note_type: session
template_version: 2
contract_version: 1
title: research-ownership-remediator session for Implement Deterministic Retrieval and Fred Research Workflow
session_id: SESSION-2026-07-19-020048
date: '2026-07-19'
status: completed
owner: research-ownership-remediator
branch: ''
phase: '[[02_Phases/Phase_01_walking_skeleton/Phase|Phase 01 walking skeleton]]'
context:
  context_id: SESSION-2026-07-19-020048
  status: active
  updated_at: '2026-07-19T02:00:48.151Z'
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

# research-ownership-remediator session for Implement Deterministic Retrieval and Fred Research Workflow

Use one note per meaningful work session. Record chronology, validation, and handoff state, but promote durable conclusions into phase, architecture, bug, or decision notes. See [[07_Templates/Note_Contracts|Note Contracts]].

## Objective

- Advance [[02_Phases/Phase_01_walking_skeleton/Steps/Step_04_implement-deterministic-retrieval-and-fred-research-workflow|STEP-01-04 Implement Deterministic Retrieval and Fred Research Workflow]].
- Leave a clean handoff if the work stops mid-step.

## Planned Scope

- Review [[02_Phases/Phase_01_walking_skeleton/Steps/Step_04_implement-deterministic-retrieval-and-fred-research-workflow|STEP-01-04 Implement Deterministic Retrieval and Fred Research Workflow]] before editing.
- Record changed paths and validation as the session progresses.

## Execution Log

<!-- AGENT-START:session-execution-log -->
- 02:00 - Created session note.
- 02:00 - Linked related step [[02_Phases/Phase_01_walking_skeleton/Steps/Step_04_implement-deterministic-retrieval-and-fred-research-workflow|STEP-01-04 Implement Deterministic Retrieval and Fred Research Workflow]].
<!-- AGENT-END:session-execution-log -->

## Findings

- Record important facts learned during the session.
- Research lease renewal already fenced job id, run/entity, workspace, status, and attempt, but append-in-progress omitted the attempt and terminal complete/fail omitted workspace and attempt.
- Registration authorized source versions but trusted inconsistent thread, run, job, payload, and initial-event links before writes.
- The generic unfenced `appendEvent` repository API had no callers and was removed to prevent bypassing claimed-job ownership.
- Adversarial review found that `postgres` returns JSONB selected through `sql.unsafe` as serialized JSON. The completion ownership gate incorrectly required an already-decoded object, so valid PostgreSQL completions failed with `ValidationError` and were terminal-failed by the worker.
- Completion now strictly normalizes either a serialized JSON object or an already-decoded object before comparing the exact persisted project ID and ordered source-version array. Malformed JSON, scalars, arrays, and mismatched source scopes remain rejected before terminal writes.

## Context Handoff

- Use this as the single canonical prose section for prepared context, resume notes, and handoff summaries tied to the current effective context.
- Keep durable conclusions promoted into phase, bug, decision, or architecture notes when they outlive the session.

## Changed Paths

<!-- AGENT-START:session-changed-paths -->
- None yet.
<!-- AGENT-END:session-changed-paths -->
- `packages/persistence/src/repositories/research-execution.ts`
- `packages/persistence/src/repositories/ownership.test.ts`
- `packages/persistence/src/repositories/ownership.integration.test.ts`
- `apps/worker/src/jobs/run-research.ts`
- `apps/worker/src/jobs/run-research.test.ts`
- `apps/worker/src/main.ts`
- `apps/api/src/routes/research.integration.test.ts`

## Validation Run

<!-- AGENT-START:session-validation-run -->
- Command: not run yet
- Result: not run
- Notes: 
<!-- AGENT-END:session-validation-run -->
- `bun test --max-concurrency 1 packages/persistence/src/repositories/ownership.test.ts apps/worker/src/jobs/run-research.test.ts apps/api/src/routes/research.test.ts` — 24 passed, 0 failed.
- `DATABASE_URL=postgres://struct:struct@localhost:5432/struct bun test --max-concurrency 1 packages/persistence/src/repositories/ownership.integration.test.ts` — 7 passed, 0 failed.
- `DATABASE_URL=postgres://struct:struct@localhost:5432/struct bun test --max-concurrency 1 apps/api/src/routes/research.integration.test.ts` — 18 passed, 0 failed.
- Persistence, API, and worker TypeScript project checks passed.
- Focused source ESLint passed with zero warnings.
- JSONB completion regression remediation: `bun test --max-concurrency 1 packages/persistence/src/repositories/ownership.test.ts` — 19 passed.
- Real PostgreSQL ownership/citation/rollback coverage: `DATABASE_URL=postgresql://struct:struct@localhost:5432/struct bun test --max-concurrency 1 packages/persistence/src/repositories/ownership.integration.test.ts` — 10 passed.
- Full real PostgreSQL research walking-slice coverage: `DATABASE_URL=postgresql://struct:struct@localhost:5432/struct bun test --max-concurrency 1 apps/api/src/routes/research.integration.test.ts` — 18 passed.
- Repository gates: `bun run lint` and `bun run typecheck` passed.

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
- [x] No research-ownership remediation remains. Root orchestrator should include these paths in its aggregate validation and publishing workflow.

## Completion Summary

- State what finished, what remains, and whether handoff is clean.
- Completed research ownership and aggregate hardening. Every active research mutation now carries and fences the exact claimed job; terminal and progress event metadata is validated and persisted from the owned aggregate; registration validates all cross-links before authorization or writes; completion validates citation/run consistency. Unit and real-PostgreSQL regressions are green. Handoff is clean.
