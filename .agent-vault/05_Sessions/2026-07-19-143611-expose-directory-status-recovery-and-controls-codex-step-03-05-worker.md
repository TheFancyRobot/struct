---
note_type: session
template_version: 2
contract_version: 1
title: Codex STEP-03-05 worker session for Expose Directory Status Recovery and Controls
session_id: SESSION-2026-07-19-143611
date: '2026-07-19'
status: in_progress
owner: Codex STEP-03-05 worker
branch: agent/step-03-05-directory-controls
phase: '[[02_Phases/Phase_03_durable_directory_ingestion_and_source_refresh/Phase|Phase 03 durable directory ingestion and source refresh]]'
context:
  context_id: SESSION-2026-07-19-143611
  status: completed
  updated_at: '2026-07-19T14:36:11.224Z'
  current_focus:
    summary: Advance [[02_Phases/Phase_03_durable_directory_ingestion_and_source_refresh/Steps/Step_05_expose-directory-status-recovery-and-controls|STEP-03-05 Expose Directory Status Recovery and Controls]].
    target: '[[02_Phases/Phase_03_durable_directory_ingestion_and_source_refresh/Steps/Step_05_expose-directory-status-recovery-and-controls|STEP-03-05 Expose Directory Status Recovery and Controls]]'
  resume_target:
    type: step
    target: '[[02_Phases/Phase_03_durable_directory_ingestion_and_source_refresh/Steps/Step_05_expose-directory-status-recovery-and-controls|STEP-03-05 Expose Directory Status Recovery and Controls]]'
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

# Codex STEP-03-05 worker session for Expose Directory Status Recovery and Controls

Use one note per meaningful work session. Record chronology, validation, and handoff state, but promote durable conclusions into phase, architecture, bug, or decision notes. See [[07_Templates/Note_Contracts|Note Contracts]].

## Objective

- Advance [[02_Phases/Phase_03_durable_directory_ingestion_and_source_refresh/Steps/Step_05_expose-directory-status-recovery-and-controls|STEP-03-05 Expose Directory Status Recovery and Controls]].
- Leave a clean handoff if the work stops mid-step.

## Planned Scope

- Review [[02_Phases/Phase_03_durable_directory_ingestion_and_source_refresh/Steps/Step_05_expose-directory-status-recovery-and-controls|STEP-03-05 Expose Directory Status Recovery and Controls]] before editing.
- Record changed paths and validation as the session progresses.

## Execution Log

<!-- AGENT-START:session-execution-log -->
- 14:36 - Created session note.
- 14:36 - Linked related step [[02_Phases/Phase_03_durable_directory_ingestion_and_source_refresh/Steps/Step_05_expose-directory-status-recovery-and-controls|STEP-03-05 Expose Directory Status Recovery and Controls]].
- Implemented shared typed directory status/count/failure/event contracts and invariants.
- Added migration 0009 and an Effect.Service repository for atomic registration, scoped status, command idempotency, valid transitions, and cursor event reads.
- Added minimal Bun API registration/status/control/SSE routes and server wiring.
- Added fine-grained SolidJS directory browser, status, controls, and SSE control panel with no polling or second state framework.
- Self-review fixed premature snapshot insertion, missing pre-snapshot root scope, branded decode erosion, JSONB-string failure tags, a lost terminal completion event, FK orphan risk, and historical migration fixture drift.
- Root independent review found and fixed two HTTP-boundary defects before publication: malformed status scopes now return 400 instead of 503, and missing registration scope is distinguished from database failure so infrastructure faults return 503 rather than 404.
- Added PostgreSQL regression coverage for missing workspace/project registration scope.
<!-- AGENT-END:session-execution-log -->

## Findings

- Record important facts learned during the session.
- Planned snapshot identity must be allocated at registration but the immutable snapshot row remains owned by the worker refresh commit.
- Directory job scope therefore links directly to the registered root before a snapshot row exists.
- Completion requires its own persisted terminal event; otherwise a client that consumed the last checkpoint before completion can remain stuck in running state.
- Existing JSONB work results may be encoded as JSON strings, so the failure projection supports both string and object storage shapes.
- Bun tests require a test-only Solid Babel transform to render actual TSX components; production remains on the existing Vite Solid plugin.

## Context Handoff

- Use this as the single canonical prose section for prepared context, resume notes, and handoff summaries tied to the current effective context.
- Keep durable conclusions promoted into phase, bug, decision, or architecture notes when they outlive the session.

## Changed Paths

<!-- AGENT-START:session-changed-paths -->
- `package.json`, `bun.lock`, `bunfig.toml`
- `packages/domain/src/directory-controls.ts`, `directory-controls.test.ts`, `index.ts`
- `packages/persistence/src/migrations/0009_directory_controls.sql`, `0009_directory_controls.down.sql`, `manifest.ts`, `runner.test.ts`
- `packages/persistence/src/migrations/event-journal-commit-order.integration.test.ts`, `document-chunks.integration.test.ts`, `upgrade.integration.test.ts`
- `packages/persistence/src/repositories/directory-controls.ts`, `ingestion-jobs.ts`, `ingestion-jobs.integration.test.ts`, `index.ts`; `packages/persistence/src/index.ts`
- `apps/api/src/main.ts`; `apps/api/src/routes/directories.ts`, `directories.test.ts`, `ingestion-jobs.ts`, `ingestion-jobs.integration.test.ts`, `directory-events.ts`, `directory-events.test.ts`
- `apps/web/src/api/directories.ts`; `apps/web/src/components/DirectoryBrowser.tsx`, `IngestionJobStatus.tsx`, `SourceControls.tsx`, `DirectoryControlPanel.tsx`, `directory-controls.test.tsx`; `apps/web/test/solid-test-preload.ts`; `apps/web/src/vite-env.d.ts`
- `docs/directory-refresh.md`
- This session, the STEP-03-05 note, and its implementation/outcome companions.
<!-- AGENT-END:session-changed-paths -->

## Validation Run

<!-- AGENT-START:session-validation-run -->
- `bun run typecheck` — passed.
- `bun run lint` — passed with zero warnings.
- `bun run test` — 378 passed, 126 expected DB skips, 0 failed, 1487 assertions.
- `DATABASE_URL=postgres://struct:struct@localhost:5432/struct bun run test:integration` — 84 passed, 0 failed, 627 assertions.
- `bun run lint:imports` — dependency-cruiser and boundary checks passed.
- `bun run build` — Solid/Vite web, Bun API, and Bun worker builds passed.
- `bun run docs:lint` — 38 Markdown files validated.
- `bun run secrets:scan` — 857 repository paths, zero findings.
- Migration 0009 up/down/up — passed against PostgreSQL.
- Targeted Solid/API/domain/migration suite — 14 passed; targeted directory PostgreSQL suites — 4 passed, 39 assertions.
- Root authoritative validation after review remediation: `bun run test` — 379 passed, 126 expected database skips, 0 failed, 1492 assertions.
- Root authoritative validation: PostgreSQL `bun run test:integration` — 84 passed, 0 failed, 627 assertions.
- Root authoritative validation: typecheck, zero-warning lint, dependency boundaries, production builds, docs lint, and secrets scan all passed.
<!-- AGENT-END:session-validation-run -->

## Bugs Encountered

<!-- AGENT-START:session-bugs-encountered -->
- All implementation defects found during self-review were fixed and regression-tested. No confirmed defect remains open.
<!-- AGENT-END:session-bugs-encountered -->

## Decisions Made or Updated

<!-- AGENT-START:session-decisions-made-or-updated -->
- None.
<!-- AGENT-END:session-decisions-made-or-updated -->

## Follow-Up Work

<!-- AGENT-START:session-follow-up-work -->
- [x] STEP-03-05 implementation and worker validation complete.
- [ ] Root orchestrator independently reviews the diff, publishes the step PR, remediates automated review feedback, and merges before advancing.
<!-- AGENT-END:session-follow-up-work -->

## Completion Summary

- State what finished, what remains, and whether handoff is clean.
- STEP-03-05 is implemented and fully validated with a clean worker handoff.
- The slice provides one typed path from scoped directory registration through persisted status, recovery controls, cursor SSE replay, and fine-grained SolidJS presentation.
- No worker git command was run; root retains all branch, commit, push, PR, and merge ownership.
