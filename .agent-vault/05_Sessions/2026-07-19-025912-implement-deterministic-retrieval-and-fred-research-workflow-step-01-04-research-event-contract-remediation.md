---
note_type: session
template_version: 2
contract_version: 1
title: step-01-04-research-event-contract-remediation session for Implement Deterministic Retrieval and Fred Research Workflow
session_id: SESSION-2026-07-19-025912
date: '2026-07-19'
status: completed
owner: step-01-04-research-event-contract-remediation
branch: ''
phase: '[[02_Phases/Phase_01_walking_skeleton/Phase|Phase 01 walking skeleton]]'
context:
  context_id: SESSION-2026-07-19-025912
  status: active
  updated_at: '2026-07-19T02:59:12.879Z'
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

# step-01-04-research-event-contract-remediation session for Implement Deterministic Retrieval and Fred Research Workflow

Use one note per meaningful work session. Record chronology, validation, and handoff state, but promote durable conclusions into phase, architecture, bug, or decision notes. See [[07_Templates/Note_Contracts|Note Contracts]].

## Objective

- Advance [[02_Phases/Phase_01_walking_skeleton/Steps/Step_04_implement-deterministic-retrieval-and-fred-research-workflow|STEP-01-04 Implement Deterministic Retrieval and Fred Research Workflow]].
- Leave a clean handoff if the work stops mid-step.

## Planned Scope

- Review [[02_Phases/Phase_01_walking_skeleton/Steps/Step_04_implement-deterministic-retrieval-and-fred-research-workflow|STEP-01-04 Implement Deterministic Retrieval and Fred Research Workflow]] before editing.
- Record changed paths and validation as the session progresses.

## Execution Log

<!-- AGENT-START:session-execution-log -->
- 02:59 - Created session note.
- 02:59 - Linked related step [[02_Phases/Phase_01_walking_skeleton/Steps/Step_04_implement-deterministic-retrieval-and-fred-research-workflow|STEP-01-04 Implement Deterministic Retrieval and Fred Research Workflow]].
<!-- AGENT-END:session-execution-log -->

## Findings

- Record important facts learned during the session.
- Research ownership predicates were exact, but journal type, cursor, and payload remained caller-controlled.
- A later completion could also accept a `citations-validated` event from an older retry because journal payloads lacked attempt identity.
- The worker's failure tag conversion could pass an arbitrary or oversized `_tag` into terminal persistence.

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
- `packages/persistence/src/repositories/research-event-contract.integration.test.ts`
- `apps/worker/src/jobs/run-research.ts`
- `apps/worker/src/jobs/run-research.test.ts`
- `03_Bugs/BUG-0006_job-transitions-persist-unvalidated-cross-domain-journal-payloads.md`
- This session note.

## Validation Run

<!-- AGENT-START:session-validation-run -->
- Command: not run yet
- Result: not run
- Notes: 
<!-- AGENT-END:session-validation-run -->
- `bun run typecheck` — pass.
- `bun run lint` — pass.
- `bun run lint:imports` — pass (48 modules, 94 dependencies; no boundary violations).
- `bun test apps/worker/src/jobs/run-research.test.ts packages/persistence/src/repositories/ownership.test.ts` — 32 pass, 0 fail, 251 assertions.
- `DATABASE_URL=postgresql://struct:struct@localhost:5432/struct bun test --max-concurrency 1 packages/persistence/src/repositories/research-event-contract.integration.test.ts apps/api/src/routes/research.integration.test.ts` — 20 pass, 0 fail, 127 assertions.
- `ownership.integration.test.ts` — all research cases pass; two unrelated ingestion fixture failures remained during concurrent ingestion remediation.
- `git diff --check` — pass.

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
- Root orchestrator should rerun the complete serial PostgreSQL persistence suite after the concurrent ingestion event-contract worker finishes its fixture reconciliation.
- Include this unit in the independent zero-defect review before publishing the STEP-01-04 remediation commit.

## Completion Summary

- State what finished, what remains, and whether handoff is clean.
- Hardened research append, complete, fail, registration, and stale-recovery event contracts.
- Enforced zero caller cursor, exact event-specific keys and types, evidence/citation bounds, registered source membership, current-attempt citation-validation linkage, sanitized failure payloads, and ownership-derived persisted job/run/workspace linkage.
- Added worker-side failure-tag normalization and exhaustive unit plus real PostgreSQL regression coverage.
- BUG-0006 is marked resolved for the completed research and ingestion remediations.
