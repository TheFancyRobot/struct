---
note_type: bug
template_version: 2
contract_version: 1
title: Conversation history review feedback leaves reusable chat incomplete
bug_id: BUG-0125
status: fixed
severity: sev-3
category: logic
reported_on: '2026-08-05'
fixed_on: '2026-08-05'
owner: Codex
created: '2026-08-05'
updated: '2026-08-05'
related_notes: |2-

    - '[[02_Phases/Phase_10_v1_usable_research_workspace/Steps/Step_04_deliver-source-grounded-conversation|STEP-10-04 Deliver Source Grounded Conversation]]'
tags:
  - agent-vault
  - bug
---

# BUG-0125 - Conversation history review feedback leaves reusable chat incomplete

Use one note per bug. Capture reproduction, impact, root cause, workaround, and verification, then link back to the relevant phase, step, decision, or session. See [[07_Templates/Note_Contracts|Note Contracts]].

## Summary

- Completed conversation runs now return their persisted answer and citations, including dataset citations, through the project-scoped history endpoint.
- The response is identity-scoped and explicitly non-storable.

## Observed Behavior

- A completed run with a dataset citation reached `JSON.stringify` with a `bigint` `createdAt`, causing the history request to fail instead of returning the thread.
- The authenticated history response did not set `Cache-Control: no-store`.
- Before the initial fix, the client only received run metadata and rendered a completed-status placeholder; repeated conversation panels also shared a heading ID.

## Expected Behavior

- History returns each completed run's persisted answer, document citations, and dataset citations as JSON-safe values.
- The browser and intermediaries do not store identity-scoped conversation history.
- Each rendered conversation panel has its own accessible heading ID.

## Reproduction Steps

1. Complete a research run that links at least one dataset citation.
2. Authenticate and request `GET /api/projects/:projectId/research/:threadId`.
3. Before the fix, the server throws while serializing `DatasetCitation.createdAt`; without a dataset citation, the response still omitted `Cache-Control: no-store`.

## Scope / Blast Radius

- `apps/api/src/main.ts` project-scoped research-thread history response.
- `apps/api/src/routes/research-history.ts` JSON serialization and cache policy.
- `apps/web` conversation history consumers of completed answers and citations.

## Suspected Root Cause

- The completed projection carries domain `bigint` timestamps, while the HTTP boundary serializes arbitrary values with `JSON.stringify`.

## Confirmed Root Cause

- The thread-history endpoint attached the completed persistence projection directly to its JSON response. `DatasetCitation.createdAt` is decoded as `bigint`, which `JSON.stringify` rejects. The endpoint also used the default JSON helper with no cache directive.
- The endpoint now schema-encodes completed dataset citations before serialization and returns `Cache-Control: no-store`. The prior fix already attaches the scoped projection, decodes it in the client, and uses instance-safe Solid heading IDs.

## Workaround

- No safe client-side workaround existed: the server failed before returning a completed history item containing dataset evidence.

## Permanent Fix Plan

- Keep the persistence projection typed internally, encode domain values only at the HTTP boundary, and retain the no-store response policy for this authenticated endpoint.

## Regression Coverage Needed

- Rendered component coverage verifies persisted answer/citation output, absence of the completed-status placeholder, and distinct heading IDs.
- `apps/api/src/routes/research-history.test.ts` verifies a completed dataset citation serializes safely and the response has `Cache-Control: no-store`.

## Related Notes

<!-- AGENT-START:bug-related-notes -->
- [[02_Phases/Phase_10_v1_usable_research_workspace/Steps/Step_04_deliver-source-grounded-conversation|STEP-10-04 Deliver Source Grounded Conversation]]
<!-- AGENT-END:bug-related-notes -->

## Timeline

<!-- AGENT-START:bug-timeline -->
- 2026-08-05 - Reported.
<!-- AGENT-END:bug-timeline -->
- 2026-08-05 - Fixed: completed thread history now returns and renders persisted answers and citations; heading IDs are instance-safe. Verified with `bun run typecheck` and focused web tests (17 passing).
- 2026-08-05 - Fixed review findings: completed dataset citations are schema-encoded before JSON serialization and history replies set `Cache-Control: no-store`. Verified with `bun test ./apps/api/src/routes/research-history.test.ts` and `bun run typecheck`.
- 2026-08-05 - PR #161 review found that the identity-scoped `GET /api/projects/:projectId/research/:threadId` history response could pass `DatasetCitation.createdAt` as a bigint to `JSON.stringify`, and lacked `Cache-Control: no-store`. Fixed by schema-encoding completed dataset citations before the HTTP boundary and returning the history response with `Cache-Control: no-store`; focused regression coverage verifies both.
