---
note_type: session
template_version: 2
contract_version: 1
title: step-01-04-implementor session for Implement Deterministic Retrieval and Fred Research Workflow
session_id: SESSION-2026-07-18-201147
date: '2026-07-18'
status: completed
owner: step-01-04-implementor
branch: agent/step-01-04-deterministic-retrieval-fred-workflow
phase: '[[02_Phases/Phase_01_walking_skeleton/Phase|Phase 01 walking skeleton]]'
context:
  context_id: SESSION-2026-07-18-201147
  status: completed
  updated_at: '2026-07-18T20:44:13.000Z'
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
created: '2026-07-18'
updated: '2026-07-18'
tags:
  - agent-vault
  - session
context_status: completed
summary: 'STEP-01-04 implementation and PR #1 review findings are remediated locally, including bounded PostgreSQL-aware evidence that preserves distant required terms and late long-line matches with exact locators; full repository, PostgreSQL, migration, provider, and strict Vault gates pass with zero known confirmed defects.'
---

# step-01-04-implementor session for Implement Deterministic Retrieval and Fred Research Workflow

Use one note per meaningful work session. Record chronology, validation, and handoff state, but promote durable conclusions into phase, architecture, bug, or decision notes. See [[07_Templates/Note_Contracts|Note Contracts]].

## Objective

- Advance [[02_Phases/Phase_01_walking_skeleton/Steps/Step_04_implement-deterministic-retrieval-and-fred-research-workflow|STEP-01-04 Implement Deterministic Retrieval and Fred Research Workflow]].
- Leave a clean handoff if the work stops mid-step.

## Planned Scope

- Review [[02_Phases/Phase_01_walking_skeleton/Steps/Step_04_implement-deterministic-retrieval-and-fred-research-workflow|STEP-01-04 Implement Deterministic Retrieval and Fred Research Workflow]] before editing.
- Record changed paths and validation as the session progresses.

## Execution Log

<!-- AGENT-START:session-execution-log -->
- 20:11 - Created session note.
- 20:11 - Linked related step [[02_Phases/Phase_01_walking_skeleton/Steps/Step_04_implement-deterministic-retrieval-and-fred-research-workflow|STEP-01-04 Implement Deterministic Retrieval and Fred Research Workflow]].
- 20:44 - Completed implementation, repository/database validation, durable notes, context mirrors, and Vault integrity checks.
<!-- AGENT-END:session-execution-log -->
- 2026-07-18 retry 2 — Root verification found Node-driven Vitest could not collect `packages/fred-workflows/test/walking-skeleton.test.ts` because Fred 2.0.0's root bundle eagerly imports optional `bun:sqlite` adapters.
- Replaced product runtime value imports with type-only imports, deferred `createFred()` loading to the default Bun client factory, and returned native Fred workflow IR without eagerly loading Fred runtime code. The injected-client test boundary is now Node-compatible while the production worker remains Bun-owned.
- A concurrent Node/Bun gate run exposed hard-coded API/worker entrypoint smoke ports. Replaced them with OS-assigned ephemeral ports and proved both complete suites can run concurrently without collision.
- No git command was run; branch, commit, PR, review, and merge remain owned by the root orchestrator.
- 20:46 - Root orchestrator rejected attempt 1 after independently reproducing a Node Vitest `bun:` ESM loader failure; started fresh attempt 2 under the retry policy.
- 20:53 - Fresh retry fixed lazy Fred runtime loading and concurrent test port allocation. Root orchestrator independently reran root, real-database, migration, provider-load, and Vault gates successfully.
- 2026-07-18 retry 3 hygiene audit — Removed generated `tsconfig.tsbuildinfo` files from `packages/retrieval`, `packages/research-engine`, and `packages/fred-workflows`, and added the repository-level `*.tsbuildinfo` ignore rule. A bounded generated/cache-artifact scan found no other STEP-01-04 hygiene defect; the unrelated DuckDB spike build-info file already had spike-local ignore coverage and is now also covered at the root.
- No git command was run; the root orchestrator retains exclusive branch, staging, commit, push, PR, review, and merge control.
- 2026-07-18: Root orchestrator pushed the completed STEP-01-04 branch and opened ready-for-review PR [#1](https://github.com/TheFancyRobot/struct/pull/1) into `main`. Awaiting configured checks and code-review bots before merge.
- 2026-07-18 PR #1 review remediation completed without git or GitHub mutations. Root orchestrator retains publication, review-thread replies/resolution, automated re-review, and merge.
- 2026-07-18 PR #1 second review-remediation pass addressed the five unresolved threads: bounded worker-test shutdown escalation (`PRRT_kwDOTcucmc6SBiu9`); root-enforced Fred elapsed budget across optional factory execution paths (`PRRT_kwDOTcucmc6SBiu_`); document-level PostgreSQL FTS preservation and relevant-line fallback for terms/phrases spanning newlines (`PRRT_kwDOTcucmc6SBivA`, `PRRT_kwDOTcucmc6SBi8B`); and README alignment with startup Fred provider preflight (`PRRT_kwDOTcucmc6SBi8D`).
- The worker smoke helper now escalates SIGTERM to SIGKILL after a bounded two-second grace period. The Fred runtime wraps every workflow factory path in the configured `maxElapsedMs` budget and still releases the client. Retrieval retains document-level matches with a left-lateral locator lookup, preferring an exact line and otherwise anchoring the first line containing any normalized query lexeme.
- No git or GitHub command was run; the root orchestrator retains exclusive publication, thread resolution, re-review, and merge control.
- 2026-07-18 PR #1 third review-remediation pass addressed unresolved thread `PRRT_kwDOTcucmc6SBmEV`: ingestion and research polling now apply the configured spaced schedule independently before the loops are combined concurrently. A long-running poll in either queue no longer delays the other queue, while a loop failure still propagates and interrupts its sibling.
- Added deterministic Effect TestClock regressions for both long-running directions plus failure propagation/sibling interruption. No git or GitHub command was run; the root orchestrator retains exclusive publication, thread resolution, re-review, and merge control.
- 2026-07-18 PR #1 fourth review-remediation pass — Replaced first-match-line-only evidence slicing with one deterministic PostgreSQL-aware evidence representation per ranked source document. PostgreSQL now returns highlighted lexical match positions; nearby matches retain the existing contiguous line passage, while distant matches assemble ordered source ranges and long-line matches use exact 1-based character ranges. Tenant/project/source-version predicates, rank ordering, document limits, and exact citation validation remain unchanged.
- Added focused unit and real-PostgreSQL regressions proving terms more than six lines apart both remain in the same bounded evidence row and a match beyond character 1200 remains present with an exact source locator. No git or GitHub command was run; root orchestration retains all publication and thread-resolution work.
- 2026-07-18 PR #1 fifth review-remediation pass — Moved durable `retrieval-completed` persistence to a required typed callback at the Fred `searchText` node boundary. The search node awaits the callback immediately after deterministic retrieval succeeds and before evidence sufficiency, synthesis, or citation validation; retrieval failures cannot invoke it.
- `processOneResearchJob` now supplies the callback and owns the sanitized event payload, while `apps/worker` bridges the Effect callback into `runFredWalkingSkeleton`. `ResearchExecutionRepo.appendEvent` remains the sole persistence owner, and terminal completion/failure transactions remain unchanged.
- No git or GitHub command was run; root orchestration retains exclusive publication, review-thread resolution, re-review, and merge control.

## Findings

- Record important facts learned during the session.
- 2026-07-18 PR #1 review remediation verified all 22 unresolved inline findings. Valid findings were corrected across tenant ownership, transactional research finalization, PostgreSQL match anchoring, Fred input typing/interruption, API error categories, startup readiness, legacy ingestion compatibility, test isolation, runtime dependencies, documentation, and Vault handoff state.
- Fred 2.0.0's Promise `workflows.run` API exposes no AbortSignal. Production execution now uses Fred's exported Effect-native workflow executor under `Effect.timeoutFail`, so expiry interrupts the workflow fiber rather than merely abandoning a Promise; the injected Promise-client path remains test-only compatibility.
- Qodo reported reviews paused and CodeRabbit's docstring-coverage warning was not one of the 22 inline actionable threads; neither represents a repository defect or implementable STEP-01-04 code finding.
- PR #1 fourth-pass finding resolved: a six-line slice anchored at only the first matching line could omit another required PostgreSQL FTS term when matches were distant, and truncating the first 1200 characters of a long matched line could omit the actual hit while overstating the line locator.
- The compatible fix is one evidence row per ranked document, preserving the request limit and deterministic `(rank DESC, sourceVersionId ASC)` ordering. A contiguous passage remains `lines:start-end`; noncontiguous passages use ordered semicolon-delimited line/character ranges whose sequence matches the excerpt segments separated by an omission marker.
- PostgreSQL `ts_headline` supplies stem-aware match offsets. The application verifies marker-stripped text exactly equals the immutable source line, bounds the assembled excerpt to 1200 characters, and fails with `RetrievalQueryError` rather than emitting an inaccurate locator when match positions cannot be represented.
- Existing citation grounding remains exact: no schema expansion was required, and citations continue to validate against the retrieved source-version/locator pair.
- PR #1 fifth-pass finding resolved: appending `retrieval-completed` only after the full Fred workflow returned delayed the milestone behind synthesis and erased it when synthesis or validation failed.
- The compatible boundary is a required `onRetrievalCompleted(evidence)` callback in `WalkingSkeletonGraphDependencies`. It is awaited after `searchText` resolves but before `requireEvidence`, so a successful zero-result retrieval records `evidenceCount: 0`, while a thrown retrieval records no completion milestone.
- Event ordering and sanitization remain worker-owned (`evidenceCount` and immutable source-version IDs only). The append completes before downstream work advances, the existing append-only journal assigns ordering, and research completion/failure transaction ownership is unchanged.

## Context Handoff

- Use this as the single canonical prose section for prepared context, resume notes, and handoff summaries tied to the current effective context.
- Keep durable conclusions promoted into phase, bug, decision, or architecture notes when they outlive the session.
- Delivery workflow addition: once Phase 01 completes and merges, Phase 02 must be refined and vault-validated before its first step branch is created. The same gate applies at every later phase boundary. Phase 01 is already active and its step notes are refined, so STEP-01-04 continues under the existing phase context after design approval.
- Orchestration mode is now authoritative: STEP-01-04 and every later unit runs in a fresh subagent with no git access; the root orchestrator owns validation, retries (3 total fresh attempts), branch/PR/review/merge operations, and phase advancement. No interactive approval pauses. Stop immediately before v1.0 release.
- STEP-01-04 implementation is complete with no known confirmed defects. Repository, real-database, provider-load, documentation, security-scan, and Vault gates passed.
- Root orchestrator owns all Git inspection, branch publication, review remediation, and merge work. This worker ran no Git command.
- The existing live SSE placeholder is an explicit later-phase follow-up; this step durably records observable research progress in `event_journal`.

## Changed Paths

<!-- AGENT-START:session-changed-paths -->
- Domain schemas/errors; persistence migration/repositories; `packages/retrieval`, `packages/research-engine`, and `packages/fred-workflows`; API research route; worker research job/runtime wiring; ingestion indexing; unit/integration tests; workspace manifests/lockfile; README, environment example, and architecture/local-development/repository-contract documentation.
- Step implementation/outcome notes and architecture summaries were updated in Agent Vault.
<!-- AGENT-END:session-changed-paths -->
- PR #1 second remediation: `apps/worker/src/entrypoint.test.ts`; `packages/fred-workflows/src/adapters/fred-runtime.ts`; `packages/fred-workflows/test/walking-skeleton.test.ts`; `packages/retrieval/src/search-text.ts`; `packages/retrieval/test/search-text.test.ts`; `apps/api/src/routes/research.integration.test.ts`; `README.md`.
- PR #1 third remediation: `apps/worker/src/main.ts`; new focused scheduling boundary `apps/worker/src/polling.ts`; deterministic regression coverage `apps/worker/src/polling.test.ts`; this session note; generated code graph/index context from Vault refresh.
- `packages/retrieval/src/search-text.ts` — PostgreSQL-highlighted match collection, bounded contiguous/composite evidence assembly, exact line/character locators, and typed fail-closed evidence errors.
- `packages/retrieval/test/search-text.test.ts` — focused distant-term and late-long-line regressions plus PostgreSQL headline contract coverage.
- `apps/api/src/routes/research.integration.test.ts` — real-PostgreSQL fixtures and citation-grounding regressions for distant terms and late long-line matches.
- `.agent-vault/05_Sessions/2026-07-18-201147-implement-deterministic-retrieval-and-fred-research-workflow-step-01-04-implementor.md` — fourth PR remediation handoff, findings, validation, and changed-path evidence.
- `packages/fred-workflows/src/graphs/walking-skeleton.ts` — required typed retrieval-completion callback awaited at the successful search boundary.
- `packages/fred-workflows/test/walking-skeleton.test.ts` — successful empty retrieval and failed retrieval callback-boundary regressions.
- `apps/worker/src/jobs/run-research.ts` — worker-owned durable milestone callback and removal of the delayed post-workflow append.
- `apps/worker/src/jobs/run-research.test.ts` — blocked-synthesis visibility and retained-on-failure regression.
- `apps/worker/src/main.ts` — Effect-to-Promise callback bridge through `runFredWalkingSkeleton`.
- `apps/api/src/routes/research.integration.test.ts` — real-PostgreSQL in-progress visibility, final ordering, and zero-result milestone coverage.
- `.agent-vault/05_Sessions/2026-07-18-201147-implement-deterministic-retrieval-and-fred-research-workflow-step-01-04-implementor.md` and generated Vault context/code graph — fifth remediation handoff and refreshed symbol map.

## Validation Run

<!-- AGENT-START:session-validation-run -->
- Command set: `bun install --frozen-lockfile`; root typecheck/lint/import-boundary/build/test/secrets/docs gates; `docker compose config --quiet`; PostgreSQL migration up/down/up; provider package import smoke from `packages/fred-workflows`; real database integration suite.
- Result: PASS. Full unit suite: 138 passed, 17 database-only skipped, 0 failed (605 assertions). Real PostgreSQL integration: 11 passed, 0 failed.
- Notes: grounded completion, exact citations, insufficient evidence, stale recovery, scope isolation, durable job/run terminal state, and ordered research event families are covered.
<!-- AGENT-END:session-validation-run -->
- Retry-2 focused boundary gates: `npx vitest run packages/fred-workflows/test/walking-skeleton.test.ts --reporter=verbose` (2 passed), `bun test packages/fred-workflows/test/walking-skeleton.test.ts` (2 passed), and `bun run --filter @struct/fred-workflows typecheck` passed.
- Retry-2 complete root gates: `bun install --frozen-lockfile`; `bun run typecheck`; `bun run lint`; `bun run lint:imports`; `bun run build`; `npx vitest run` (97 passed, 11 database-only skipped); `bun test` (138 passed, 17 database-only skipped); `bun run secrets:scan`; `bun run docs:lint`; `docker compose config --quiet`; and provider-package Bun import smoke all passed.
- Test-isolation proof: complete Node Vitest and raw Bun suites passed when launched concurrently after replacing fixed smoke ports with ephemeral ports.
- PostgreSQL gates: migration `up/down/up` passed; the focused repository/source-ingestion/research integration suite passed 11/11 under both Node Vitest and raw Bun.
- Vault generated context/code graph was refreshed and strict validation completed with zero errors and zero warnings.
- Result: PASS. STEP-01-04 is completed with mirrored `context_status: completed` and zero known confirmed defects.
- Root-orchestrator verification: frozen install, typecheck, lint, import boundaries, Node Vitest (97 pass / 11 DB-only skipped), raw Bun (138 pass / 17 DB-only skipped), build, canonical secrets/docs scripts, Compose config, real-DB Node suite (108/108), real-DB raw Bun suite (149/149), migration down/up, Fred provider load, and Vault doctor all passed.
- Retry-3 hygiene gates passed: root `typecheck`, ESLint, dependency/import boundaries, build, Node Vitest (97 passed, 11 database-only skipped), raw Bun (138 passed, 17 database-only skipped), canonical secrets/docs scripts, `docker compose config --quiet`, and Fred/Fred OpenAI package-load smoke from `packages/fred-workflows`.
- Final post-validation filesystem audit confirmed the three STEP-01-04 `tsconfig.tsbuildinfo` files are absent, `*.tsbuildinfo` is ignored repository-wide, and no related cache artifact remains. STEP-01-04 and its mirrored context remain completed with zero known confirmed defects.
- PR review remediation focused gates: root TypeScript compilation passed; 26 focused Node Vitest tests covering retrieval, research-engine, Fred workflow, API registration, ingestion, and research jobs passed after interface corrections. Full repository, real-PostgreSQL, migration, build, and strict Vault gates follow in this handoff.
- Final PR-remediation gates PASS: frozen Bun install; root typecheck; zero-warning ESLint; dependency/import boundaries; build; Node Vitest 103 passed / 12 database-only skipped; raw Bun 144 passed / 18 database-only skipped; readiness-driven worker smoke under Node and Bun; canonical secrets/docs scripts; Compose validation; migration down/up; Fred provider preflight; real-PostgreSQL Node 12/12 and raw Bun 12/12; refreshed code graph (54 files, 572 symbols); refreshed authoritative context/indexes; and Vault doctor/all checks with 0 errors and 0 warnings.
- Regression coverage proves tenant ownership is derived from immutable source relationships, excerpts use PostgreSQL match-line metadata including stem-only matches, legacy ingestion payloads remain processable, Fred input and empty-evidence failures remain typed, production Fred timeout uses Effect-native fiber interruption, startup validates provider config before readiness, polling is concurrent, API client/infrastructure failures stay distinct, and stale recovery cannot race terminal completion or leave split state.
- PR #1 second remediation gates PASS: root typecheck; zero-warning ESLint; dependency/import boundaries; focused Node tests (10/10); real-PostgreSQL cross-line term and phrase regressions under Node and Bun (5/5 each); full Node Vitest with PostgreSQL (117/117); full raw Bun with PostgreSQL (158/158); production build; Compose validation; canonical secrets/docs scripts; migration down/up; and post-migration real-database regression (5/5).
- Regression coverage proves an injected Fred factory hook that ignores `maxElapsedMs` is still timed out by the product runtime and releases the Fred client; PostgreSQL `websearch_to_tsquery` document matches survive when required terms or a quoted phrase cross newline boundaries; returned excerpts begin at the first relevant lexeme line.
- PR #1 third remediation gates PASS: focused worker typecheck; focused Node Vitest 3/3 and raw Bun 3/3; root typecheck; zero-warning repository ESLint; dependency/import boundaries; full Node Vitest without PostgreSQL 106 passed / 14 skipped; full raw Bun without PostgreSQL 147 passed / 20 skipped; production build; canonical secrets/docs scripts; Compose validation; migration down/up; full real-PostgreSQL Node 120/120 and raw Bun 161/161; Fred provider package-load smoke.
- Regression coverage proves a blocked research poll does not delay the next ingestion interval, a blocked ingestion poll does not delay the next research interval, and either poll's failure remains fatal to the combined worker loop while interrupting its sibling.
- PR #1 fourth remediation gates PASS: focused retrieval/research Node Vitest 8/8; focused real-PostgreSQL Node and raw Bun 15/15; root TypeScript compilation; zero-warning ESLint; dependency/import boundaries; full Node Vitest with PostgreSQL 124/124; full raw Bun with PostgreSQL 165/165; production build; frozen install with no changes; Compose validation; canonical secrets/docs scripts; migration down/up; post-migration real-PostgreSQL Node and Bun 7/7 each; Fred/Fred OpenAI provider package-load smoke.
- Regression evidence proves a document match with required terms on lines 2 and 10 returns one bounded row containing both terms with locator `lines:2-2;lines:10-10`; a long-line match after character 1200 is centered in the excerpt, maps exactly through `line:1,chars:start-end`, stays within 1200 characters, and passes exact citation validation without grounding mismatch.
- PR #1 fifth remediation gates PASS: focused Fred/worker Node Vitest 9/9; focused real-PostgreSQL Node and raw Bun 8/8 each before and after migration round-trip; root TypeScript compilation; zero-warning ESLint; dependency/import boundaries; full Node Vitest with PostgreSQL 127/127; full raw Bun with PostgreSQL 168/168; production build; frozen install with no changes; Compose validation; canonical secrets/docs scripts; migration down/up; Fred/Fred Effect/Fred OpenAI provider imports.
- Regression coverage proves `retrieval-completed` is durably visible while synthesis is blocked, remains ordered before `research-failed` when synthesis later fails, records a successful zero-result retrieval before evidence insufficiency, and is absent when deterministic retrieval itself throws.

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
- [x] Complete [[02_Phases/Phase_01_walking_skeleton/Steps/Step_04_implement-deterministic-retrieval-and-fred-research-workflow|STEP-01-04 Implement Deterministic Retrieval and Fred Research Workflow]] implementation and local review remediation.
<!-- AGENT-END:session-follow-up-work -->
- [ ] Root orchestrator publishes this remediation to PR #1, resolves or replies to all verified threads with evidence, waits for automated re-review, and merges only after the zero-defect gate passes.
- [ ] After merge, advance to [[02_Phases/Phase_01_walking_skeleton/Steps/Step_05_stream-persisted-progress-and-render-navigable-citation|STEP-01-05 Stream Persisted Progress and Render Navigable Citation]].

## Completion Summary

- STEP-01-04 implementation and all 22 PR #1 inline review findings were addressed locally with regression coverage. The root orchestrator retains publication, thread resolution/replies, automated re-review, and merge ownership.
