---
note_type: bug
template_version: 2
contract_version: 1
title: Workspace source attachments do not enqueue text indexing
bug_id: BUG-0048
status: fixed
severity: sev-2
category: logic
reported_on: '2026-07-26'
fixed_on: '2026-07-26'
owner: Codex
created: '2026-07-26'
updated: '2026-07-26'
related_notes:
  - '[[02_Phases/Phase_10_v1_usable_research_workspace/Steps/Step_09_make-source-registration-workspace-scoped|STEP-10-09 Make Source Registration Workspace Scoped]]'
tags:
  - agent-vault
  - bug
---

# BUG-0048 - Workspace source attachments do not enqueue text indexing

Use one note per bug. Capture reproduction, impact, root cause, workaround, and verification, then link back to the relevant phase, step, decision, or session. See [[07_Templates/Note_Contracts|Note Contracts]].

## Summary

- Workspace source attachments do not enqueue text indexing.
- Related notes: [[02_Phases/Phase_10_v1_usable_research_workspace/Steps/Step_09_make-source-registration-workspace-scoped|STEP-10-09 Make Source Registration Workspace Scoped]].
- Workspace-library documents are ingested without a project-scoped text index. Attaching an existing source previously updated only `project_sources`, leaving retrieval readiness unsatisfied.
- Fixed by atomically queuing existing source versions during attachment and by deriving future version jobs from `project_sources`.
- Also corrected the persistence source-row decoder to accept the intentional nullable `project_id` workspace scope.

## Observed Behavior

- Describe what actually happens.

## Expected Behavior

- Describe what should happen instead.

## Reproduction Steps

1. List the exact setup state.
2. List the user or developer actions.
3. Record the observed result.

## Scope / Blast Radius

- List affected packages, commands, integrations, environments, or users.

## Suspected Root Cause

- Record current theories and assumptions.

## Confirmed Root Cause

- Record the proven cause and decisive evidence.
- `SourceCatalogRepo.setAttached` only changed `project_sources`; no durable reindex work existed for already-ingested workspace sources.
- The former `enqueue_source_text_reindex()` trigger derived scope from `sources.project_id`, which is intentionally null for workspace-library sources.
- `decodeSourceRow` still rejected the now-valid nullable `project_id`, rolling back workspace-only registrations.

## Workaround

- Describe any temporary mitigation and remaining risk.

## Permanent Fix Plan

- Describe the intended durable fix.

## Regression Coverage Needed

- List tests, fixtures, reproductions, alerts, or docs updates needed.
- Implemented: `bun test apps/api/src/routes/sources.integration.test.ts` exercises workspace-only registration, ingestion, attachment, worker reindex, and successful text retrieval.
- Implemented: `bun test packages/persistence/src/repositories/decode.test.ts` covers nullable source project decoding.

## Related Notes

<!-- AGENT-START:bug-related-notes -->
- Phase: [[02_Phases/Phase_10_v1_usable_research_workspace/Phase|Phase 10 v1 usable research workspace]]
- Step: [[02_Phases/Phase_10_v1_usable_research_workspace/Steps/Step_09_make-source-registration-workspace-scoped|STEP-10-09 Make Source Registration Workspace Scoped]]
<!-- AGENT-END:bug-related-notes -->

## Timeline

<!-- AGENT-START:bug-timeline -->
- 2026-07-26 - Reported.
<!-- AGENT-END:bug-timeline -->
