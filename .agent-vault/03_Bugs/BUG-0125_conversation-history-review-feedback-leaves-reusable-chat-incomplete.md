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

- Conversation history review feedback leaves reusable chat incomplete.
- Related notes: none linked yet.

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
- The thread-history endpoint returned only `ResearchRun` metadata. `ConversationHistory` therefore rendered a status placeholder even though `ResearchProjectionRepo.findCompleted` already persisted the answer and citations. Its fixed heading ID was also shared across component instances.

- The endpoint now attaches the existing scoped completed projection to completed runs. The client decodes that result, and the component renders it with a unique Solid ID per instance.

## Workaround

- Describe any temporary mitigation and remaining risk.

## Permanent Fix Plan

- Describe the intended durable fix.

## Regression Coverage Needed

- List tests, fixtures, reproductions, alerts, or docs updates needed.
- Rendered component coverage verifies persisted answer/citation output, absence of the completed-status placeholder, and distinct heading IDs. API decoding coverage verifies the persisted result contract.

## Related Notes

<!-- AGENT-START:bug-related-notes -->
- None yet.
<!-- AGENT-END:bug-related-notes -->

## Timeline

<!-- AGENT-START:bug-timeline -->
- 2026-08-05 - Reported.
<!-- AGENT-END:bug-timeline -->
- 2026-08-05 - Fixed: completed thread history now returns and renders persisted answers and citations; heading IDs are instance-safe. Verified with `bun run typecheck` and focused web tests (17 passing).
