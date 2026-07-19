---
note_type: session
template_version: 2
contract_version: 1
title: step-02-05-worker session for Add Document Research UX and Citation Navigation
session_id: SESSION-2026-07-19-103415
date: '2026-07-19'
status: completed
owner: Codex
branch: agent/step-02-05-document-research-ux
phase: '[[02_Phases/Phase_02_document_research_and_hybrid_retrieval/Phase|Phase 02 document research and hybrid retrieval]]'
context:
  context_id: SESSION-2026-07-19-103415
  status: completed
  updated_at: '2026-07-19T10:46:00.000Z'
  current_focus:
    summary: Completed and validated [[02_Phases/Phase_02_document_research_and_hybrid_retrieval/Steps/Step_05_add-document-research-ux-and-citation-navigation|STEP-02-05 Add Document Research UX and Citation Navigation]].
    target: '[[02_Phases/Phase_02_document_research_and_hybrid_retrieval/Steps/Step_05_add-document-research-ux-and-citation-navigation|STEP-02-05 Add Document Research UX and Citation Navigation]]'
  resume_target:
    type: step
    target: '[[02_Phases/Phase_02_document_research_and_hybrid_retrieval/Steps/Step_05_add-document-research-ux-and-citation-navigation|STEP-02-05 Add Document Research UX and Citation Navigation]]'
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

# step-02-05-worker session for Add Document Research UX and Citation Navigation

Use one note per meaningful work session. Record chronology, validation, and handoff state, but promote durable conclusions into phase, architecture, bug, or decision notes. See [[07_Templates/Note_Contracts|Note Contracts]].

## Objective

- Advance [[02_Phases/Phase_02_document_research_and_hybrid_retrieval/Steps/Step_05_add-document-research-ux-and-citation-navigation|STEP-02-05 Add Document Research UX and Citation Navigation]].
- Leave a clean handoff if the work stops mid-step.

## Planned Scope

- Review [[02_Phases/Phase_02_document_research_and_hybrid_retrieval/Steps/Step_05_add-document-research-ux-and-citation-navigation|STEP-02-05 Add Document Research UX and Citation Navigation]] before editing.
- Record changed paths and validation as the session progresses.

## Execution Log

<!-- AGENT-START:session-execution-log -->
- 10:34 - Created session note.
- 10:34 - Linked related step [[02_Phases/Phase_02_document_research_and_hybrid_retrieval/Steps/Step_05_add-document-research-ux-and-citation-navigation|STEP-02-05 Add Document Research UX and Citation Navigation]].
<!-- AGENT-END:session-execution-log -->
- Loaded target-rooted STEP-02-05 execution brief, validation plan, parent phase, STEP-02-04 handoff, and relevant architecture.
- Applied the SolidJS skill: props remain reactive, asynchronous citation loading uses `createResource`, and visible state uses Solid control-flow components.
- Readiness gate passed: STEP-02-04 is completed and the current branch is prepared by the root orchestrator.
- Confirmed in-scope compatibility defect: the citation API only parses line locators while STEP-02-04 emits `document:` locators with immutable normalized-document character and byte offsets.

## Findings

- STEP-02-04 document citations use normalized-document character and UTF-8 byte offsets; citation previews must resolve against `documents.normalized_text`, not raw or indexed fallback text.
- Locator-aware projection preserves legacy line citations while document locators fail closed when the immutable normalized document is unavailable.
- Solid UI states remain on the existing SSE/replay and citation-viewer boundaries; no parallel event or state system was introduced.

## Context Handoff

- STEP-02-05 is completed and validated. Continue with STEP-02-06 only after this branch is reviewed and merged.
- The stable handoff is the existing Solid research stream/citation viewer plus locator-aware, tenant-scoped citation projection.

## Changed Paths

<!-- AGENT-START:session-changed-paths -->
- `apps/api/src/routes/citations.ts`
- `apps/api/src/routes/citations.test.ts`
- `apps/web/src/pages/ResearchPage.tsx`
- `apps/web/src/components/ResearchStream.tsx`
- `apps/web/src/components/CitationViewer.tsx`
- `apps/web/src/hooks/useSSE.test.ts`
- `apps/web/e2e/walking-skeleton.spec.ts`
- `apps/worker/src/jobs/run-research.test.ts`
- `packages/persistence/src/repositories/research-projections.ts`
- `packages/persistence/src/repositories/research-projections.integration.test.ts`
- STEP-02-05 and this session note.
<!-- AGENT-END:session-changed-paths -->

## Validation Run

<!-- AGENT-START:session-validation-run -->
- Final root gate: 377 PostgreSQL-enabled repository tests passed with 0 failures and 1,851 assertions across 59 files; 4/4 Bun-native browser tests passed.
- Full repository typecheck, zero-warning lint, dependency/import boundaries, web/API/worker builds, docs links, secrets scan, and Vault doctor passed.
- Exact citation regressions cover UTF-8 byte mismatch, oversized ranges, multiline and blank-line paragraph spans, locator-aware source selection, missing normalized-document fail-closed behavior, and cross-project denial.
<!-- AGENT-END:session-validation-run -->

## Bugs Encountered

<!-- AGENT-START:session-bugs-encountered -->
- Resolved: document citations emitted by STEP-02-04 were incompatible with the line-only citation API.
- Resolved during root review: preview completeness initially rejected valid blank-line paragraph separators.
- Resolved during root review: unconditional normalized-text fallback could resolve a document locator against the wrong content and alter line-locator behavior.
- Resolved during root validation: delayed browser test gate inferred `() => undefined` instead of `() => void`.
<!-- AGENT-END:session-bugs-encountered -->

## Decisions Made or Updated

<!-- AGENT-START:session-decisions-made-or-updated -->
- None.
<!-- AGENT-END:session-decisions-made-or-updated -->

## Follow-Up Work

<!-- AGENT-START:session-follow-up-work -->
- [x] Complete [[02_Phases/Phase_02_document_research_and_hybrid_retrieval/Steps/Step_05_add-document-research-ux-and-citation-navigation|STEP-02-05 Add Document Research UX and Citation Navigation]].
- [ ] After merge, execute [[02_Phases/Phase_02_document_research_and_hybrid_retrieval/Steps/Step_06_evaluate-retrieval-provenance-and-injection-resistance|STEP-02-06 Evaluate Retrieval Provenance and Injection Resistance]].
<!-- AGENT-END:session-follow-up-work -->

## Completion Summary

- Completed STEP-02-05: users can inspect explicit document-research progress/failure states and navigate a validated citation to exact immutable normalized source evidence.
- The handoff is clean. Remaining work is STEP-02-06 adversarial document evaluation after this PR is reviewed and merged.
