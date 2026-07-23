---
note_type: session
template_version: 2
contract_version: 1
title: BUG-0013 source-import remediation session
session_id: SESSION-2026-07-23-131531
date: '2026-07-23'
status: completed
owner: OpenAI Codex GPT-5.6-sol (fallback; required GPT-5.4 unavailable)
branch: fix/BUG-0013-source-import
phase: '[[02_Phases/Phase_10_v1_usable_research_workspace/Phase|Phase 10 v1 usable research workspace]]'
context:
  context_id: SESSION-2026-07-23-131531
  status: completed
  updated_at: '2026-07-23T13:15:31.211Z'
  current_focus:
    summary: Remediate BUG-0013 source catalog and non-blocking import, using STEP-10-03 as technical reference only.
    target: '[[03_Bugs/BUG-0013_v1-ui-lacks-core-research-workflows|BUG-0013 v1 UI lacks core research workflows]]'
  resume_target:
    type: step
    target: '[[02_Phases/Phase_10_v1_usable_research_workspace/Steps/Step_03_deliver-source-catalog-and-non-blocking-import|STEP-10-03 Deliver Source Catalog and Non Blocking Import]]'
    section: Context Handoff
  last_action:
    type: completed
related_bugs:
  - '[[03_Bugs/BUG-0013_v1-ui-lacks-core-research-workflows|BUG-0013 v1 UI lacks core research workflows]]'
related_decisions: []
created: '2026-07-23'
updated: '2026-07-23'
tags:
  - agent-vault
  - session
---

# BUG-0013 source-import remediation session

Use one note per meaningful work session. Record chronology, validation, and handoff state, but promote durable conclusions into phase, architecture, bug, or decision notes. See [[07_Templates/Note_Contracts|Note Contracts]].

## Objective

- Remediate [[03_Bugs/BUG-0013_v1-ui-lacks-core-research-workflows|BUG-0013]] with the source catalog and non-blocking import unit, using STEP-10-03 as technical reference only.
- Keep PHASE-10 and every STEP-10-* roadmap note planned while BUG-0013 remains confirmed.

## Planned Scope

- Review [[02_Phases/Phase_10_v1_usable_research_workspace/Steps/Step_03_deliver-source-catalog-and-non-blocking-import|STEP-10-03 Deliver Source Catalog and Non Blocking Import]] before editing.
- Record changed paths and validation as the session progresses.
- Reuse current source, directory, dataset, worker, and SSE patterns; add no speculative infrastructure or dependencies.
- Implement and validate the smallest cohesive browser-to-worker remediation slice without changing roadmap statuses.

## Execution Log

<!-- AGENT-START:session-execution-log -->
- 13:15 - Created session note.
- 13:15 - Linked related step [[02_Phases/Phase_10_v1_usable_research_workspace/Steps/Step_03_deliver-source-catalog-and-non-blocking-import|STEP-10-03 Deliver Source Catalog and Non Blocking Import]].
<!-- AGENT-END:session-execution-log -->
- Implemented the BUG-0013 source catalog/import/activity remediation slice while leaving PHASE-10 and STEP-10-03 planned.
- Reused the existing atomic source registration, job queue, ingestion worker, immutable source-version, event-journal, and Solid SSE contracts.
- Added bounded native multipart parsing with backpressured byte counting, file/folder/paste imports, project catalog hydration, cursor-based activity replay, and owned retry/cancel controls.
- Added the project Sources route, persistent in-page background activity tray, ready-version catalog rows, multi-file fallback, and base-path-aware API calls.
- Updated the direct API setup example from legacy base64 JSON to browser-compatible multipart paste.

## Findings

- Record important facts learned during the session.
- Authoritative catalog readiness is `ready` only when an immutable source version exists; a ready version remains usable while a newer/current job is pending, running, failed, or cancelled.
- The browser boundary supports the existing document allowlist for files, multi-file selection, safe folder-relative paths, and named text/Markdown paste. Per-file default is `MAX_TEXT_SOURCE_BYTES=1048576`; one request is capped at 20 files plus bounded multipart overhead.
- Source activity hydrates with the catalog cursor before subscribing. SSE events carry durable journal cursor, event identity, source ID, type, and timestamp; the client refetches the authoritative projection and `useSSE` deduplicates/reconnects from its last cursor.
- Retry and cancel are scoped through workspace, project, source, and job ownership. Terminal/foreign/non-actionable jobs return the same not-found response.
- Structured dataset materialization and durable batch idempotency remain outside this bounded slice; BUG-0013 remains confirmed.

## Context Handoff

- Use this as the single canonical prose section for prepared context, resume notes, and handoff summaries tied to the current effective context.
- Keep durable conclusions promoted into phase, bug, decision, or architecture notes when they outlive the session.
- This session completed one independently tracked BUG-0013 remediation slice; it did not activate or complete PHASE-10 or STEP-10-03.
- Root should independently inspect the source catalog SQL projection, bounded multipart boundary, job control race semantics, browser route, and validation evidence before publishing.
- BUG-0013 remains `confirmed`. The catalog/import/activity slice is ready for review, but the broader browser research journey and later remediation units remain release blockers.

## Changed Paths

<!-- AGENT-START:session-changed-paths -->
- See the bounded changed-path list below.
<!-- AGENT-END:session-changed-paths -->
- `.agent-vault/00_Home/Active_Context.md`
- `.agent-vault/02_Phases/Phase_10_v1_usable_research_workspace/Steps/Step_03_deliver-source-catalog-and-non-blocking-import.md`
- `.agent-vault/05_Sessions/2026-07-23-131531-deliver-source-catalog-and-non-blocking-import-openai-codex-gpt-5-4.md`
- `apps/api/src/main.ts`
- `apps/api/src/auth-boundary.test.ts`
- `apps/api/src/routes/browser-source-import.ts`
- `apps/api/src/routes/browser-source-import.test.ts`
- `apps/api/src/routes/source-catalog.ts`
- `apps/api/src/routes/source-catalog.test.ts`
- `apps/api/src/routes/sources.ts`
- `apps/api/src/routes/sources.test.ts`
- `apps/web/src/api/sources.ts`
- `apps/web/src/components/BackgroundActivityTray.tsx`
- `apps/web/src/components/SourceCatalogList.tsx`
- `apps/web/src/components/SourceImportPanel.tsx`
- `apps/web/src/components/source-import-panel.test.tsx`
- `apps/web/src/components/workspace/WorkspaceShell.tsx`
- `apps/web/src/pages/SourcesPage.tsx`
- `apps/web/src/index.tsx`
- `apps/web/e2e/source-import.spec.ts`
- `packages/domain/src/index.ts`
- `packages/domain/src/source-catalog.ts`
- `packages/domain/src/source-catalog.test.ts`
- `packages/domain/src/source-uploads.ts`
- `packages/persistence/src/index.ts`
- `packages/persistence/src/repositories/index.ts`
- `packages/persistence/src/repositories/source-catalog.ts`
- `packages/persistence/src/repositories/source-catalog.integration.test.ts`
- `packages/persistence/src/repositories/source-registration.ts`
- `docs/setup.md`
- `docs/frontend-architecture.md`
- `.agent-vault/03_Bugs/BUG-0013_v1-ui-lacks-core-research-workflows.md`

## Validation Run

<!-- AGENT-START:session-validation-run -->
- Result: worker validation passed; root validation pending before publication.
<!-- AGENT-END:session-validation-run -->
- `bun test --timeout 30000 --max-concurrency 1 packages/domain/src/source-catalog.test.ts packages/persistence/src/repositories/source-catalog.integration.test.ts apps/api/src/routes/browser-source-import.test.ts apps/api/src/routes/source-catalog.test.ts apps/api/src/routes/sources.test.ts` — passed (focused domain/API/persistence coverage).
- `bun test --preload ./apps/web/test/solid-test-preload.ts --max-concurrency 1 apps/web/src/components/source-import-panel.test.tsx apps/web/src/components/workspace/workspace-shell.test.tsx` — passed, 3 tests.
- `bun run typecheck` — passed.
- `bun run lint` — passed with no warnings.
- `bun run build` — passed for web, API, and worker.
- `bun run lint:imports` — passed with no dependency or boundary violations.
- `bun run test` — passed repository suite.
- `bun run --filter @struct/web build && bun test --timeout 60000 --max-concurrency 1 apps/web/e2e/source-import.spec.ts` — passed, 1 browser test.
- `bun run docs:lint` — passed, 62 Markdown files.
- `bun run secrets:scan` — passed, 1,286 repository paths and zero secrets.
- Agent Vault doctor — clean: 244 notes, zero errors or warnings.
- Root verification (2026-07-23): focused source import/catalog tests, browser E2E, `bun run typecheck`, `bun run lint`, `bun run lint:imports`, `bun run test` (947 pass, 3 expected skips), `bun run build`, `bun run docs:lint`, `bun run secrets:scan`, `bun install --frozen-lockfile`, `git diff --check`, and Agent Vault doctor all passed.

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
- [ ] Continue BUG-0013 remediation; STEP-10-03 remains a planned technical reference.
<!-- AGENT-END:session-follow-up-work -->
- [ ] Root independently verifies the diff and planned roadmap statuses before publication.
- [ ] Continue BUG-0013 with the next bounded browser workflow remediation unit after this slice is reviewed and merged.
- [ ] Add structured-dataset import/materialization and durable batch idempotency only in an explicitly assigned follow-up slice.

## Completion Summary

- State what finished, what remains, and whether handoff is clean.
- Completed the bounded BUG-0013 source catalog, browser file/folder/paste import, and durable activity remediation slice.
- All focused and repository validation passed; no implementation blocker or known regression remains in this slice.
- Handoff is clean. BUG-0013 remains confirmed and all Phase 10 roadmap notes remain planned.
