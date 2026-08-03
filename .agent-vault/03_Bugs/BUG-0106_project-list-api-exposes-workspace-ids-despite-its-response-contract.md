---
note_type: bug
template_version: 2
contract_version: 1
title: Project list API exposes workspace IDs despite its response contract
bug_id: BUG-0106
status: fixed
severity: sev-3
category: logic
reported_on: '2026-08-01'
fixed_on: '2026-08-03'
owner: ''
created: '2026-08-01'
updated: '2026-08-03'
related_notes:
  - '[[02_Phases/Phase_11_v1_1_research_usability/Phase|PHASE-11 v1.1 Research Usability]]'
tags:
  - agent-vault
  - bug
---

# BUG-0106 - Project list API exposes workspace IDs despite its response contract

Use one note per bug. Capture reproduction, impact, root cause, workaround, and verification, then link back to the relevant phase, step, decision, or session. See [[07_Templates/Note_Contracts|Note Contracts]].

## Summary

- Project list API exposes workspace IDs despite its response contract.
- Related note: [[02_Phases/Phase_11_v1_1_research_usability/Phase|PHASE-11 v1.1 Research Usability]].

## Observed Behavior

- Before the 2026-08-03 fix, `summarize()` in `apps/api/src/routes/projects.ts` included persistence-only `workspaceId` in responses from `GET /api/projects`, `POST /api/projects`, and `GET /api/projects/:id`.

## Expected Behavior

- Public project responses contain only `id`, `name`, `createdAt`, and `updatedAt`; they never expose `workspaceId`.

## Reproduction Steps

1. Use an authenticated workspace identity and a project belonging to that workspace.
2. Request `GET /api/projects`, `POST /api/projects`, or `GET /api/projects/:id`.
3. Before the fix, inspect the JSON response: it includes `workspaceId`.

## Scope / Blast Radius

- `apps/api` project list, create, and detail endpoints and any API consumer receiving their project-summary JSON.
- The persistence model and workspace authorization checks remain unaffected; only the public response projection changed.

## Suspected Root Cause

- Before confirmation, the likely cause was a shared serializer projecting persistence fields into the public API shape without an explicit response-field allowlist.

## Confirmed Root Cause

- Record the proven cause and decisive evidence.
- `summarize()` copied the persistence-only `workspaceId` into every public `ProjectSummary` response. `ProjectSummary` intentionally makes that field optional, and the existing list contract assertion proved the public response must omit it.

## Workaround

- Describe any temporary mitigation and remaining risk.
- Fixed on 2026-08-03. No workaround remains necessary.

## Verification

- `bun test apps/api/src/routes/projects.test.ts` — 8 pass, 0 fail.
- `bun test packages/domain/src/project-lifecycle.test.ts` — 6 pass, 0 fail.
- `bun run typecheck` — passed.
- `vault_validate doctor` — passed with 0 errors and 0 warnings.

## Permanent Fix Plan

- Describe the intended durable fix.
- Updated the shared `summarize()` serializer to emit only public project fields (`id`, `name`, `createdAt`, and `updatedAt`), so list, create, and detail responses follow one contract.

## Regression Coverage Needed

- List tests, fixtures, reproductions, alerts, or docs updates needed.
- Retained the list-response assertion that excludes `workspaceId` and added exact public-response assertions for project creation and single-project reads.

## Related Notes

<!-- AGENT-START:bug-related-notes -->
- [[02_Phases/Phase_11_v1_1_research_usability/Phase|PHASE-11 v1.1 Research Usability]]
<!-- AGENT-END:bug-related-notes -->

## Timeline

<!-- AGENT-START:bug-timeline -->
- 2026-08-01 - Reported.
- 2026-08-03 - Fixed by restricting the shared serializer to the public project-response fields; focused API and domain tests, typecheck, and vault validation passed.
<!-- AGENT-END:bug-timeline -->
