---
note_type: bug
template_version: 2
contract_version: 1
title: v1 UI lacks core research workflows
bug_id: BUG-0013
status: confirmed
severity: sev-1
category: logic
reported_on: '2026-07-21'
fixed_on: ''
owner: Codex
created: '2026-07-21'
updated: '2026-07-22'
related_notes:
  - '[[02_Phases/Phase_10_v1_usable_research_workspace/Phase|PHASE-10 v1 Usable Research Workspace]]'
  - '[[02_Phases/Phase_10_v1_usable_research_workspace/Steps/Step_01_establish-workspace-and-project-lifecycle|STEP-10-01 Establish Workspace and Project Lifecycle]]'
  - '[[02_Phases/Phase_10_v1_usable_research_workspace/Steps/Step_08_gate-v1-on-the-complete-browser-journey|STEP-10-08 Gate v1 on the Complete Browser Journey]]'
  - '[[02_Phases/Phase_09_v1_production_hardening_and_release/Phase|PHASE-09 v1 Production Hardening and Release]]'
  - '[[02_Phases/Phase_02_document_research_and_hybrid_retrieval/Phase|PHASE-02 Document Research and Hybrid Retrieval]]'
  - '[[02_Phases/Phase_03_durable_directory_ingestion_and_source_refresh/Phase|PHASE-03 Durable Directory Ingestion and Source Refresh]]'
  - '[[02_Phases/Phase_04_structured_datasets_and_deterministic_sql/Phase|PHASE-04 Structured Datasets and Deterministic SQL]]'
  - '[[02_Phases/Phase_05_typed_research_planning_and_bounded_execution/Phase|PHASE-05 Typed Research Planning and Bounded Execution]]'
  - '[[02_Phases/Phase_08_citation_backed_reports_and_durable_findings/Phase|PHASE-08 Citation-Backed Reports and Durable Findings]]'
  - '[[02_Phases/Phase_11_v1_1_research_usability/Phase|PHASE-11 v1.1 Research Usability]]'
  - '[[01_Architecture/System_Overview|System Overview]]'
  - '[[01_Architecture/Integration_Map|Integration Map]]'
  - '[[02_Phases/Phase_09_v1_production_hardening_and_release/Steps/Step_06_publish-v1-documentation-accessibility-and-release-checklist|STEP-09-06 Publish v1 Documentation Accessibility and Release Checklist]]'
tags:
  - agent-vault
  - bug
---

# BUG-0013 - v1 UI lacks core research workflows

Use one note per bug. Capture reproduction, impact, root cause, workaround, and verification, then link back to the relevant phase, step, decision, or session. See [[07_Templates/Note_Contracts|Note Contracts]].

## Summary

- v1 UI lacks core research workflows.
- Related notes: [[02_Phases/Phase_09_v1_production_hardening_and_release/Steps/Step_06_publish-v1-documentation-accessibility-and-release-checklist|STEP-09-06 Publish v1 Documentation Accessibility and Release Checklist]].

## Observed Behavior

- The root route renders a hard-coded `mixedSourceDemoFixture('complete')` research result.
- Playwright finds no chat composer, upload/import action, or note-creation control.
- The only notebook navigation control is disabled and requires project identifiers that the UI cannot create or select.
- API routes exist for text-source registration, directory registration, and research execution, but the root user journey does not expose them.

## Expected Behavior

- A new user can create or select a project, add supported sources, inspect ingestion, ask a source-grounded question, follow progress, inspect citations, and save a finding or note entirely through the UI.

## Reproduction Steps

1. Start `apps/web` and open the root route.
2. Attempt to add a document, create a note, or ask a question about the displayed sources.
3. Observe that none of those actions are available; only a static example report and theme toggle are interactive.

## Scope / Blast Radius

- Blocks every first-run and returning-user research workflow in `apps/web`.
- Invalidates the v1 product objectives for project creation, source ingestion, research conversation, and saved work.

## Suspected Root Cause

- Phase acceptance focused on backend contracts, deterministic evaluators, accessibility, and rendering an existing report state without validating a complete browser-driven user journey from an empty workspace.

## Confirmed Root Cause

- `HomePage.tsx` directly renders the static mixed-source demo fixture.
- `App.tsx` disables notebook navigation and provides no project/source/research creation affordances.
- Playwright inspection of the running root route reports zero textareas and no relevant buttons or links.
- The product brief explicitly assigns source management and research conversation to `apps/web`, so this is a missing v1 workflow rather than optional v1.1 polish.

## Workaround

- Backend API calls can exercise portions of the system manually, but this is not a user-facing workaround and does not make the application releasable.

## Permanent Fix Plan

- Reopen the v1 release gate and implement one coherent workspace shell covering project selection/creation, source import and ingestion status, document-grounded chat, citation navigation, and saved notes/findings.
- Replace the root demo fixture with persisted API-backed state and make all primary workflows discoverable without hand-constructed URLs or IDs.
- Use the approved Phase 10 packets in explicit STEP-10-01 through STEP-10-08 technical order as independently tracked BUG-0013 remediation units; do not activate PHASE-10 or any `STEP-10-*` roadmap step while this confirmed defect is open. The approved design and implementation plan under `docs/superpowers/` remain the product and delivery source of truth.

## Regression Coverage Needed

- Playwright first-run test: create project, add document, wait for ingestion, ask a question, open a citation, and save a note/finding.
- Playwright returning-user test: reopen a project and continue the conversation.
- Empty, loading, failure, retry, and offline states for every primary workflow.
- Release checklist must require the complete browser journey, not component rendering alone.

## Related Notes

<!-- AGENT-START:bug-related-notes -->
- Architecture: [[01_Architecture/System_Overview|System Overview]], [[01_Architecture/Integration_Map|Integration Map]]
- Functional phases: [[02_Phases/Phase_02_document_research_and_hybrid_retrieval/Phase|PHASE-02 Document Research and Hybrid Retrieval]], [[02_Phases/Phase_03_durable_directory_ingestion_and_source_refresh/Phase|PHASE-03 Durable Directory Ingestion and Source Refresh]], [[02_Phases/Phase_04_structured_datasets_and_deterministic_sql/Phase|PHASE-04 Structured Datasets and Deterministic SQL]], [[02_Phases/Phase_05_typed_research_planning_and_bounded_execution/Phase|PHASE-05 Typed Research Planning and Bounded Execution]], [[02_Phases/Phase_08_citation_backed_reports_and_durable_findings/Phase|PHASE-08 Citation-Backed Reports and Durable Findings]]
- Release phase: [[02_Phases/Phase_09_v1_production_hardening_and_release/Phase|PHASE-09 v1 Production Hardening and Release]]
- Deferred usability phase: [[02_Phases/Phase_11_v1_1_research_usability/Phase|PHASE-11 v1.1 Research Usability]]
- Step: [[02_Phases/Phase_09_v1_production_hardening_and_release/Steps/Step_06_publish-v1-documentation-accessibility-and-release-checklist|STEP-09-06 Publish v1 Documentation Accessibility and Release Checklist]]
<!-- AGENT-END:bug-related-notes -->
- Remediation phase: [[02_Phases/Phase_10_v1_usable_research_workspace/Phase|PHASE-10 v1 Usable Research Workspace]]
- First executable step: [[02_Phases/Phase_10_v1_usable_research_workspace/Steps/Step_01_establish-workspace-and-project-lifecycle|STEP-10-01 Establish Workspace and Project Lifecycle]]
- Release gate: [[02_Phases/Phase_10_v1_usable_research_workspace/Steps/Step_08_gate-v1-on-the-complete-browser-journey|STEP-10-08 Gate v1 on the Complete Browser Journey]]

## Timeline

<!-- AGENT-START:bug-timeline -->
- 2026-07-21 - Reported.
- 2026-07-21 - Confirmed with Playwright and code inspection; v1 release is blocked.
<!-- AGENT-END:bug-timeline -->
- 2026-07-21 - Approved design converted into PHASE-10 with eight sequenced executable steps; implementation intentionally not started during vault-plan.
- 2026-07-21 - BUG-0013 project-lifecycle remediation unit implemented: typed project list/create/read contracts, workspace-scoped persistence + idempotency + case-folded uniqueness, authenticated `/api/projects` routes, canonical `/projects/:projectId` browser flow, cached last-project reopen, and focused regression coverage (`packages/domain/src/project-lifecycle.test.ts`, `packages/persistence/src/repositories/projects.integration.test.ts`, `apps/api/src/routes/projects*.test.ts`, `apps/web/src/api/projects.test.ts`, `apps/web/src/components/project-switcher.test.tsx`, `apps/web/e2e/project-lifecycle.spec.ts`). Focused validation passed; standalone legacy browser suites (`notebook-report`, `mixed-source-report`, `walking-skeleton`, `recursive-analysis`) also passed, but aggregated `bun run --filter @struct/web test` still failed in the shared multi-file Playwright invocation and needs separate harness follow-up before the repository can claim a fully green browser suite.
- 2026-07-22 - Regression follow-up in the BUG-0013 remediation tree repaired the `@struct/web` browser suite without changing BUG-0013 status: `apps/web/vite.config.test.ts` now restores `process.env.BASE_PATH` so `/struct` does not leak into later E2E builds, `apps/web/e2e/support/app-server.ts` now uses per-run dist roots, `apps/web/e2e/mixed-source-report.spec.ts` and `apps/web/e2e/recursive-analysis.spec.ts` no longer share ports with other suites, and `apps/web/e2e/project-lifecycle.spec.ts` now targets the unique level-1 project heading after the new project summary card introduced a second matching heading. Validation passed for focused browser specs (`notebook-report`, `mixed-source-report`, `walking-skeleton`, `project-lifecycle`, `recursive-analysis`) and the full `bun run --filter @struct/web test` suite (73 pass, 0 fail). BUG-0013 remains confirmed; this remediation repaired suite regressions around the new project-lifecycle slice rather than closing the product bug.
- 2026-07-22 - Independent root review blocked the project-lifecycle remediation unit: browser idempotency keys are regenerated instead of persisted/reused across retry/reload; the idempotency migration duplicates its primary-key uniqueness while repository replay recognizes only the named index; and project-load unavailability clears valid cached state or lacks a retryable error view. These violate the recorded validation contract. The three-attempt worker limit is exhausted, so remediation is stopped pending a new unit/plan.
- 2026-07-22 - Independent remediation unit 2 fixed the three blocked project-lifecycle regressions without changing BUG-0013 status: browser project creation now persists one pending idempotency key in session storage and reuses it across repeated submit/retry/reload until success or a definite name conflict clears it; project create conflict handling now replays same-key races after transaction rollback without relying on a specific idempotency index name, and migration `0018_project_lifecycle` now uses only the composite primary key for idempotency uniqueness; root/project project-lifecycle views now preserve a valid cached last-project id across temporary list/read outages and render explicit retry actions instead of clearing cache or stalling in a false loading/not-found state.
  - Changed paths: `apps/web/src/pages/ProjectPage.tsx`, `apps/web/src/pages/project-create-state.ts`, `apps/web/src/pages/project-create-state.test.ts`, `apps/web/src/components/ProjectSwitcher.tsx`, `apps/web/src/components/project-switcher.test.tsx`, `apps/web/e2e/project-lifecycle.spec.ts`, `packages/persistence/src/repositories/interfaces.ts`, `packages/persistence/src/repositories/projects.test.ts`, `packages/persistence/src/repositories/projects.integration.test.ts`, `packages/persistence/src/migrations/0018_project_lifecycle.sql`, `packages/persistence/src/migrations/0018_project_lifecycle.down.sql`, `packages/persistence/src/migrations/project-lifecycle.test.ts`.
  - Validation: `bun test packages/persistence/src/migrations/project-lifecycle.test.ts packages/persistence/src/repositories/projects.test.ts apps/api/src/routes/projects.test.ts`; `bun test --preload ./apps/web/test/solid-test-preload.ts apps/web/src/api/projects.test.ts apps/web/src/components/project-switcher.test.tsx apps/web/src/pages/project-create-state.test.ts apps/web/e2e/project-lifecycle.spec.ts`; `bun --bun tsc --noEmit --project apps/web/tsconfig.json && bun --bun tsc --noEmit --project packages/persistence/tsconfig.json && bun --bun tsc --noEmit --project apps/api/tsconfig.json`.
  - Remaining validation note: `packages/persistence/src/repositories/projects.integration.test.ts` now includes a concurrent same-key replay regression, but the local environment did not expose `DATABASE_URL`, so that integration test remained skipped in this worker session.
- 2026-07-22 - Independent remediation unit 2 final pass repaired project-route cache coherence without changing BUG-0013 status: `apps/web/src/pages/ProjectPage.tsx` now writes `struct:last-project-id` reactively only after the loaded project id matches the current route, so project-switch navigation plus browser Back/Forward keeps the cache aligned with the successfully loaded project, retryable read outages preserve the last known good id, and direct read outages no longer cache an unverified route id.
  - Changed paths: `apps/web/src/pages/ProjectPage.tsx`, `apps/web/e2e/project-lifecycle.spec.ts`.
  - Validation: `bun test --preload ./apps/web/test/solid-test-preload.ts apps/web/e2e/project-lifecycle.spec.ts` (6 pass, 0 fail); `bun run --filter @struct/web test` (80 pass, 0 fail); `bun --bun tsc --noEmit --project apps/web/tsconfig.json` (`TYPECHECK_OK`).
  - Status note: BUG-0013 remains confirmed; PHASE-10 and STEP-10-01 remain inactive until the complete browser journey is fixed and independently closed.
- 2026-07-22 - Root full-suite validation after remediation unit 2 found one remaining confirmed blocker: `packages/persistence/src/migrations/runner.test.ts` hard-codes the previous `0017` down-migration SQL while treating the manifest tail as generic, so new latest migration `0018_project_lifecycle` makes `Migration Runner > runMigrationsDown > reverts the last applied migration` fail. Evidence: `bun run test` produced 927 pass, 3 skip, 1 fail. Focused project-lifecycle domain, persistence integration (including concurrent same-key replay), API, Solid, and Playwright checks passed; typecheck, lint exit status, import boundaries, and vault doctor passed after generated E2E artifacts were removed. The unit's three fresh-worker attempts are exhausted, so the branch remains uncommitted and unpublished pending a newly authorized remediation unit for this test-contract defect. BUG-0013 remains confirmed; PHASE-10 and STEP-10-01 remain inactive.
- 2026-07-22 - Authorized migration-runner remediation unit repaired the stale latest-down-migration test contract without changing BUG-0013 status: `packages/persistence/src/migrations/runner.test.ts` now loads the current manifest tail's `downPath` SQL and asserts that exact down migration ran before the tracking-row delete, instead of hard-coding the prior `0017_durable_artifact_snapshots` down-SQL shape while the manifest tail advances.
  - Root cause evidence: focused reproduction with `bun test packages/persistence/src/migrations/runner.test.ts` failed only in `Migration Runner > runMigrationsDown > reverts the last applied migration` because the runner executed `0018_project_lifecycle.down.sql` while the assertion still expected `DROP TABLE IF EXISTS finding_snapshots ... reject_durable_artifact_snapshot_mutation` from `0017`.
  - Validation: `bun test packages/persistence/src/migrations/runner.test.ts` (6 pass, 0 fail); `bun --bun tsc --noEmit --project packages/persistence/tsconfig.json` (exit 0, no output).
- 2026-07-22 - Root independently verified remediation unit 3 and the complete project-lifecycle branch gates: focused migration runner (6 pass), full non-E2E repository suite (928 pass, 3 intentional skips, 0 fail), browser E2E suite (28 pass, 0 fail), typecheck, build, lint (0 errors; one known Babel parser false-positive warning for the type-only `typeDomain` import), import/boundary checks, and `git diff --check` all exited successfully. The stale migration-runner blocker is resolved; BUG-0013 remains confirmed for the unimplemented later workflow units and PHASE-10 remains inactive.
- 2026-07-22 — Fresh PR #61 review confirmed three project-lifecycle defects that block merge: `ProjectSwitcher` renders the first-project empty state while the initial project list is still loading; malformed list cursors reach repository decoding and are misreported as `503 ProjectListUnavailable`; malformed JSON create bodies are also misreported as `503 ProjectCreateUnavailable` instead of bounded `400` request errors. Root independently verified all three against the current source. A new fresh-worker remediation unit is required; BUG-0013 remains confirmed and Phase 10 remains inactive.
- 2026-07-22 - Independent remediation unit 4 repaired the three root-reviewed PR #61 project-lifecycle defects without changing BUG-0013 status: `ProjectSwitcher` now uses an explicit `projectListState` contract with an accessible loading state so `/` and `/projects/:projectId` do not render first-project empty copy before the initial `fetchProjects` settlement; the project-list cursor contract is now canonical and bounded at the API boundary and reused by persistence cursor helpers so malformed `GET /api/projects?cursor=...` requests are rejected as `400 InvalidProjectListRequest` before repository access; malformed JSON `POST /api/projects` bodies now map parse failure to `400 InvalidProjectCreateRequest`.
  - Red: `bun test apps/api/src/routes/projects.test.ts` (5 pass, 2 fail: malformed cursor still called `listByWorkspaceId`; malformed create JSON returned `503` instead of `400`); `bun test --preload ./apps/web/test/solid-test-preload.ts apps/web/src/components/project-switcher.test.tsx` (3 pass, 1 fail: loading-state regression rendered first-project copy); `bun test --timeout 120000 apps/web/e2e/project-lifecycle.spec.ts` (6 pass, 2 fail: delayed-success home/project flows never surfaced the loading state before settlement).
  - Changed paths: `packages/domain/src/project-lifecycle.ts`, `packages/domain/src/project-lifecycle.test.ts`, `packages/persistence/src/repositories/interfaces.ts`, `apps/api/src/routes/projects.ts`, `apps/api/src/routes/projects.test.ts`, `apps/web/src/components/ProjectSwitcher.tsx`, `apps/web/src/components/project-switcher.test.tsx`, `apps/web/src/pages/ProjectPage.tsx`, `apps/web/e2e/project-lifecycle.spec.ts`.
  - Validation: `bun test packages/domain/src/project-lifecycle.test.ts packages/persistence/src/repositories/projects.test.ts apps/api/src/routes/projects.test.ts` (14 pass, 0 fail); `bun test --preload ./apps/web/test/solid-test-preload.ts apps/web/src/components/project-switcher.test.tsx` (4 pass, 0 fail); `bun test --timeout 120000 apps/web/e2e/project-lifecycle.spec.ts` (8 pass, 0 fail); `bun --bun tsc --noEmit --project packages/domain/tsconfig.json && bun --bun tsc --noEmit --project packages/persistence/tsconfig.json && bun --bun tsc --noEmit --project apps/api/tsconfig.json && bun --bun tsc --noEmit --project apps/web/tsconfig.json && echo TYPECHECK_OK` (`TYPECHECK_OK`).
  - Status note: BUG-0013 remains confirmed, STEP-10-01 remains inactive, and no additional confirmed defect was discovered in this worker session beyond the three remediated PR #61 findings.
- 2026-07-22 — During PR #61 validation, [[03_Bugs/BUG-0014_e2e-build-artifacts-break-canonical-lint-gate|BUG-0014 E2E build artifacts break canonical lint gate]] was confirmed and remediated with deterministic per-server bundle cleanup plus Git/ESLint safety ignores. BUG-0013 remains confirmed for later workflow slices; Phase 10 remains inactive.
- 2026-07-22 — PR #61 Codex inline review comment `3627640258` confirmed a remaining cache-safety defect: when a direct deleted/malformed/unauthorized project route is not found, `ProjectPage` unconditionally removes `struct:last-project-id`, even if it points to a different valid last-known-good project. Comments `3627640262` (malformed JSON classification) and `3627640264` (E2E artifact cleanup) are already remediated locally. Merge remains blocked pending a fresh test-first fix and root verification of the cache finding.
- 2026-07-22 — Expanded canonical validation found `docs/setup.md` linking to a nonexistent double-hyphen release-procedure anchor. Root corrected it to the docs-lint slug `#release-procedure-intentionally-not-executed`; `bun run docs:lint` now validates all 62 Markdown files. Full typecheck and secret scan also pass.
- 2026-07-22 - PR #61 inline finding `3627640258` remediated without changing BUG-0013 status: `apps/web/src/pages/ProjectPage.tsx` now removes `struct:last-project-id` only when the stored id matches the conclusively missing route id, preserving unrelated valid last-known-good project caches during direct not-found project visits; `apps/web/e2e/project-lifecycle.spec.ts` adds a browser regression that seeds cached Alpha, opens direct missing Beta, and confirms cache remains Alpha while the existing stale-cache clearing case still passes.
  - Red: `bun test --timeout 120000 apps/web/e2e/project-lifecycle.spec.ts` failed in `project lifecycle browser path > preserves an unrelated cached last project when a direct project route is not found` with `Expected: "5b0e8400-e29b-41d4-a716-446655440010" Received: null`.
  - Green: `bun test --timeout 120000 apps/web/e2e/project-lifecycle.spec.ts` (9 pass, 0 fail); `bun run --filter @struct/web test` (86 pass, 0 fail); `bun --bun tsc --noEmit --project apps/web/tsconfig.json && echo TYPECHECK_OK` (`TYPECHECK_OK`); `bun --bun eslint apps/web/src/pages/ProjectPage.tsx apps/web/e2e/project-lifecycle.spec.ts && echo LINT_OK` (`LINT_OK`).
  - Status note: no additional confirmed defect found in this worker session; BUG-0013 remains confirmed for later workflow slices and PHASE-10 stays inactive.
