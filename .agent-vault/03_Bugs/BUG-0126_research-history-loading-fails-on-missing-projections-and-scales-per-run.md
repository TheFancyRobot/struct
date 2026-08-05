---
note_type: bug
template_version: 2
contract_version: 1
title: Research history loading fails on missing projections and scales per run
bug_id: BUG-0126
status: fixed
severity: sev-3
category: logic
reported_on: '2026-08-05'
fixed_on: '2026-08-05'
owner: Codex
created: '2026-08-05'
updated: '2026-08-05'
related_notes: '- ''[[02_Phases/Phase_10_v1_usable_research_workspace/Steps/Step_04_deliver-source-grounded-conversation|STEP-10-04 Deliver Source Grounded Conversation]]'''
tags:
  - agent-vault
  - bug
---

# BUG-0126 - Research history loading fails on missing projections and scales per run

Use one note per bug. Capture reproduction, impact, root cause, workaround, and verification, then link back to the relevant phase, step, decision, or session. See [[07_Templates/Note_Contracts|Note Contracts]].

## Summary

- Research history loading fails on missing projections and scales per run.
- Related notes: none linked yet.
- Fixed: the latest 100 history runs are loaded once, completed projections are fetched in one scoped batch, and a missing projection leaves its completed run’s metadata and status visible.

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
- The history route fetched every completed projection sequentially; a missing result row was treated as a service failure, so one incomplete projection rejected the whole response.

## Workaround

- Describe any temporary mitigation and remaining risk.

## Permanent Fix Plan

- Describe the intended durable fix.

## Regression Coverage Needed

- List tests, fixtures, reproductions, alerts, or docs updates needed.
- Focused route coverage retains ordered metadata for a completed run without a projection. Repository coverage proves both requested run IDs use one scoped `ANY(uuid[])` query.

## Related Notes

<!-- AGENT-START:bug-related-notes -->
- None yet.
<!-- AGENT-END:bug-related-notes -->

## Timeline

<!-- AGENT-START:bug-timeline -->
- 2026-08-05 - Reported.
<!-- AGENT-END:bug-timeline -->
- 2026-08-05 - Fixed: bounded history to 100 runs, batched completed projections, and retained metadata-only completed runs when a projection is absent. Verified with focused tests and `bun run typecheck`.
