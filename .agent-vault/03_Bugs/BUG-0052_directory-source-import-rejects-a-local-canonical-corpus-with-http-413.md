---
note_type: bug
template_version: 2
contract_version: 1
title: Directory source import rejects a local canonical corpus with HTTP 413
bug_id: BUG-0052
status: new
severity: sev-3
category: logic
reported_on: '2026-07-26'
fixed_on: ''
owner: ''
created: '2026-07-26'
updated: '2026-07-26'
related_notes:
  - '[[02_Phases/Phase_10_v1_usable_research_workspace/Steps/Step_09_make-source-registration-workspace-scoped|STEP-10-09 Make Source Registration Workspace Scoped]]'
tags:
  - agent-vault
  - bug
---

# BUG-0052 - Directory source import rejects a local canonical corpus with HTTP 413

Use one note per bug. Capture reproduction, impact, root cause, workaround, and verification, then link back to the relevant phase, step, decision, or session. See [[07_Templates/Note_Contracts|Note Contracts]].

## Summary

- Directory source import rejects a local canonical corpus with HTTP 413.
- Related notes: [[02_Phases/Phase_10_v1_usable_research_workspace/Steps/Step_09_make-source-registration-workspace-scoped|STEP-10-09 Make Source Registration Workspace Scoped]].

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
- `MAX_TEXT_SOURCE_BYTES` defaults to 1,048,576 bytes in `apps/api/src/config.ts`. Browser imports pass that ceiling to `decodeBrowserSourceImport`; the 162 MiB `canonical.jsonl` exceeds both the per-file limit and the bounded multipart batch body (`20 * maxBytes + 65,536`), so the API rejects it before ingestion with HTTP 413.

## Workaround

- Describe any temporary mitigation and remaining risk.

## Permanent Fix Plan

- Describe the intended durable fix.

## Regression Coverage Needed

- List tests, fixtures, reproductions, alerts, or docs updates needed.

## Related Notes

<!-- AGENT-START:bug-related-notes -->
- Phase: [[02_Phases/Phase_10_v1_usable_research_workspace/Phase|Phase 10 v1 usable research workspace]]
- Step: [[02_Phases/Phase_10_v1_usable_research_workspace/Steps/Step_09_make-source-registration-workspace-scoped|STEP-10-09 Make Source Registration Workspace Scoped]]
<!-- AGENT-END:bug-related-notes -->

## Timeline

<!-- AGENT-START:bug-timeline -->
- 2026-07-26 - Reported.
- 2026-07-26 — Product requirement accepted: large browser source files are non-negotiable. Approved target: 256 MiB per file and per multipart request; implementation intentionally deferred.
<!-- AGENT-END:bug-timeline -->
