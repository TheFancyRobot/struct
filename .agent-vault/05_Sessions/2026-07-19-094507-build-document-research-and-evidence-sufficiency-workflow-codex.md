---
note_type: session
template_version: 2
contract_version: 1
title: Codex session for Build Document Research and Evidence Sufficiency Workflow
session_id: SESSION-2026-07-19-094507
date: '2026-07-19'
status: completed
owner: Codex
branch: agent/step-02-04-document-research-workflow
phase: '[[02_Phases/Phase_02_document_research_and_hybrid_retrieval/Phase|Phase 02 document research and hybrid retrieval]]'
context:
  context_id: SESSION-2026-07-19-094507
  status: completed
  updated_at: '2026-07-19T09:45:07.797Z'
  current_focus:
    summary: Completed and validated STEP-02-04 document research and evidence sufficiency workflow.
    target: '[[02_Phases/Phase_02_document_research_and_hybrid_retrieval/Steps/Step_04_build-document-research-and-evidence-sufficiency-workflow|STEP-02-04 Build Document Research and Evidence Sufficiency Workflow]]'
  resume_target:
    type: step
    target: '[[02_Phases/Phase_02_document_research_and_hybrid_retrieval/Steps/Step_04_build-document-research-and-evidence-sufficiency-workflow|STEP-02-04 Build Document Research and Evidence Sufficiency Workflow]]'
    section: Context Handoff
  last_action:
    type: completed
related_bugs: []
related_decisions: []
created: '2026-07-19'
updated: '2026-07-19'
tags:
  - agent-vault
  - session
---

# Codex session for Build Document Research and Evidence Sufficiency Workflow

Use one note per meaningful work session. Record chronology, validation, and handoff state, but promote durable conclusions into phase, architecture, bug, or decision notes. See [[07_Templates/Note_Contracts|Note Contracts]].

## Objective

- Advance [[02_Phases/Phase_02_document_research_and_hybrid_retrieval/Steps/Step_04_build-document-research-and-evidence-sufficiency-workflow|STEP-02-04 Build Document Research and Evidence Sufficiency Workflow]].
- Leave a clean handoff if the work stops mid-step.

## Planned Scope

- Review [[02_Phases/Phase_02_document_research_and_hybrid_retrieval/Steps/Step_04_build-document-research-and-evidence-sufficiency-workflow|STEP-02-04 Build Document Research and Evidence Sufficiency Workflow]] before editing.
- Record changed paths and validation as the session progresses.

## Execution Log

<!-- AGENT-START:session-execution-log -->
- 09:45 - Created session note.
- 09:45 - Linked related step [[02_Phases/Phase_02_document_research_and_hybrid_retrieval/Steps/Step_04_build-document-research-and-evidence-sufficiency-workflow|STEP-02-04 Build Document Research and Evidence Sufficiency Workflow]].
<!-- AGENT-END:session-execution-log -->
- 2026-07-19: Started STEP-02-04 from merged STEP-02-03 (`main` at `e5eb8d0`) on fresh branch `agent/step-02-04-document-research-workflow`.
- Readiness gate passed: dependency complete, Phase 02 already refined/in progress, clean git tree, and no known confirmed defects.
- Core constraint: do not bypass Fred core. Fred owns orchestration and judgment; deterministic retrieval, authorization, citation validation, persistence, timeout, and failure behavior remain typed Effect services.
- 2026-07-19: Implemented the bounded seven-node document workflow and fixed self-review findings for complete chunk provenance, exact graph budgets, cancellation between every registration, preserved typed failures, concrete contradiction surfacing, and planner evidence-requirement propagation.
- 2026-07-19: Full repository validation passed with PostgreSQL and the maintained providerless core-Fred integration path.

## Findings

- Record important facts learned during the session.
- Fred core supports the maintained providerless function-only walking path through `createFred().workflows.define/run`; Struct uses that real core path in integration coverage and does not replace orchestration with a product-local executor.
- Fred wraps node failures through nested `cause` values, so the adapter must unwrap only recognized typed domain failures before the worker can persist exact safe failure tags.
- Document evidence must retain `chunkingVersion` and `ordinal` in addition to IDs and locators so a retrieved context remains inspectable against rebuild identity.

## Context Handoff

- STEP-02-04 is complete and ready for root review/publication. The next target after merge is STEP-02-05; it can consume the typed document context and validated workflow result without changing Fred, retrieval, or evidence-gate contracts.

## Changed Paths

<!-- AGENT-START:session-changed-paths -->
- `packages/domain/src/typed-errors.ts`
- `packages/retrieval/src/build-context.ts`
- `packages/retrieval/src/index.ts`
- `packages/retrieval/test/build-context.test.ts`
- `packages/research-engine/src/evidence-sufficiency.ts`
- `packages/research-engine/src/index.ts`
- `packages/research-engine/test/evidence-sufficiency.test.ts`
- `packages/fred-workflows/src/graphs/document-research.ts`
- `packages/fred-workflows/src/adapters/fred-runtime.ts`
- `packages/fred-workflows/src/index.ts`
- `packages/fred-workflows/package.json`
- `packages/fred-workflows/test/document-research.test.ts`
- `apps/worker/src/jobs/run-research.test.ts`
- `.agent-vault/01_Architecture/Agent_Workflow.md`
- Canonical STEP-02-04 step, companion, and session notes.
<!-- AGENT-END:session-changed-paths -->

## Validation Run

<!-- AGENT-START:session-validation-run -->
- Result: PASS.
- `DATABASE_URL=postgres://struct:struct@localhost:5432/struct bun run test` — final exact-worktree root rerun: 370 passed, 0 failed, 1,830 assertions across 59 files.
- `bun test --timeout 60000 --max-concurrency 1 ./apps/web/e2e` — 1 passed, 0 failed.
- `bun run typecheck` — passed with zero errors.
- `bun run lint` — passed with zero warnings/errors.
- `bun run lint:imports` — 84 modules / 182 dependencies, zero dependency or boundary violations.
- `bun run build` — web, API, and worker passed.
- `bun run docs:lint`; `bun run secrets:scan`; `docker compose config --quiet` — passed; 36 Markdown files and 791 repository paths checked.
- Focused affected-package suite — 62 passed, 8 PostgreSQL tests skipped in that isolated command; all PostgreSQL tests executed and passed in the full repository run.
- Real providerless core-Fred workflow, provider failure, typed node failures, deadlines, cancellation, late registration, prompt-injection labeling, sufficiency, contradiction, citation rejection, and durable failure-event regressions all passed.
<!-- AGENT-END:session-validation-run -->

## Bugs Encountered

<!-- AGENT-START:session-bugs-encountered -->
- Resolved during self-review: document context initially omitted `chunkingVersion` and `ordinal`; both are now preserved and covered.
- Resolved during self-review: the declared workflow budget was six steps for a seven-node graph; the contract is now seven and tested against node count.
- Resolved during self-review: late agent registration could continue after cancellation; every awaited registration now has an abort checkpoint and regression coverage.
- Resolved during self-review: typed Fred node failures were collapsed to a generic workflow failure; recognized insufficiency, contradiction, and citation failures now retain exact durable tags.
- Resolved during self-review: the planner's evidence requirement did not reach the critic; it is now part of the typed critic input and tested.
- Resolved during root review: the final workflow-result schema reused the generic answer contract and did not itself require a citation; the document result now requires at least one citation and rejects an ungrounded completed Fred payload.
- Resolved during independent review: `Effect.runPromise` wrapped typed sufficiency failures in `FiberFailure`; the function node now materializes `Either` and throws the exact tagged failure, with direct node-path coverage.
- Resolved during independent review: final citations were accepted from any retrieved chunk instead of only critic-approved evidence; validation now restricts citations to `assessment.citedEvidence` intersected with the retrieved context, with an A/B grounding regression.
- Resolved during independent follow-up: a Promise-returning citation-validation dependency could still wrap typed failures in `FiberFailure`; the graph now accepts the deterministic validation Effect directly, materializes `Either`, and throws the exact tagged failure with direct validate-node coverage.
- Resolved during root follow-up: the hybrid context dependency had the same Promise-wrapping risk; it now accepts the retrieval Effect directly and preserves `RetrievalQueryError` through the Fred tool and adapter, with a boundary regression.
- Resolved during independent review: two new node-path tests used prohibited `as never` assertions; the structural Fred contexts now typecheck directly without hiding contract mismatches.
<!-- AGENT-END:session-bugs-encountered -->

## Decisions Made or Updated

<!-- AGENT-START:session-decisions-made-or-updated -->
- None.
<!-- AGENT-END:session-decisions-made-or-updated -->

## Follow-Up Work

<!-- AGENT-START:session-follow-up-work -->
- [ ] Root orchestrator independently reviews and publishes [[02_Phases/Phase_02_document_research_and_hybrid_retrieval/Steps/Step_04_build-document-research-and-evidence-sufficiency-workflow|STEP-02-04 Build Document Research and Evidence Sufficiency Workflow]].
<!-- AGENT-END:session-follow-up-work -->

## Completion Summary

- STEP-02-04 is implemented and fully validated. The handoff is clean for root self-review/publication: bounded core-Fred planning/critique/synthesis, one typed hybrid retrieval context, fail-closed evidence and citation gates, exact durable failure tags, and no known confirmed defects. Root retains all git/PR work.
