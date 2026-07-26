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

- Importing a local directory containing a 162 MiB `canonical.jsonl` file via the browser source import UI returns HTTP 413 (Payload Too Large) before any ingestion begins. The file is silently rejected; no progress indicator, no partial result, no actionable error message reaches the user.

## Expected Behavior

- The browser should accept the `canonical.jsonl` file, upload it via bounded multipart staging, and the API should ingest it successfully. The approved product requirement is 256 MiB per file and per multipart request.

## Reproduction Steps

1. Start the local development stack (`apps/api` + `apps/web`).
2. Open the workspace in a browser, navigate to the global source library.
3. Click "Add Source" → select a local directory containing a single `canonical.jsonl` file of ~162 MiB.
4. Observe: the API returns HTTP 413 before ingestion. No source record is created.

## Scope / Blast Radius

- Affects any user importing large text sources (corpus files, JSONL dumps) via the browser source import UI.
- `apps/api` (config + import handler) and `apps/web` (source import UI) are both in scope.
- No data loss — the rejection happens before any durable state is written.

## Suspected Root Cause

- `MAX_TEXT_SOURCE_BYTES` default (1,048,576) is too small for real corpus files. The multipart batch body limit (`20 * maxBytes + 65,536`) compounds the problem.

## Confirmed Root Cause

- Record the proven cause and decisive evidence.
- `MAX_TEXT_SOURCE_BYTES` defaults to 1,048,576 bytes in `apps/api/src/config.ts`. Browser imports pass that ceiling to `decodeBrowserSourceImport`; the 162 MiB `canonical.jsonl` exceeds both the per-file limit and the bounded multipart batch body (`20 * maxBytes + 65,536`), so the API rejects it before ingestion with HTTP 413.

## Workaround

- Set `MAX_TEXT_SOURCE_BYTES=268435456` (256 MiB) in the environment before starting `apps/api`. This raises both the per-file ceiling and the multipart batch body limit (`20 * 256 MiB + 65,536`).
- Risk: the env override is undocumented and not persisted across deployments.

## Permanent Fix Plan

- Raise `MAX_TEXT_SOURCE_BYTES` default from 1,048,576 to 268,435,456 (256 MiB) in `apps/api/src/config.ts`.
- Verify the multipart batch body limit scales correctly (`20 * maxBytes + 65,536`).
- Document the limit in the source import UI and user-facing docs.

## Regression Coverage Needed

- Add an integration test in `apps/api` that uploads a file at or near the 256 MiB limit and asserts HTTP 200.
- Add a browser-level test (or manual verification) that imports a large local directory through the source import UI without HTTP 413.

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
