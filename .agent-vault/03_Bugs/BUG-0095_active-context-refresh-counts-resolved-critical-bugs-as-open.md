---
note_type: bug
template_version: 2
contract_version: 1
title: Active Context refresh counts resolved critical bugs as open
bug_id: BUG-0095
status: new
severity: sev-3
category: logic
reported_on: '2026-07-31'
fixed_on: ''
owner: agent-vault upstream
created: '2026-07-31'
updated: '2026-07-31'
related_notes:
  - '[[02_Phases/Phase_10B_brand_implementation/Phase|PHASE-10B Brand Implementation]]'
tags:
  - agent-vault
  - bug
---

# BUG-0095 - Active Context refresh counts resolved critical bugs as open

Use one note per bug. Capture reproduction, impact, root cause, workaround, and verification, then link back to the relevant phase, step, decision, or session. See [[07_Templates/Note_Contracts|Note Contracts]].

## Summary

- Active Context refresh counts resolved critical bugs as open.
- Related notes: [[02_Phases/Phase_10B_brand_implementation/Phase|PHASE-10B Brand Implementation]].

## Observed Behavior

- `vault_refresh active_context` rewrites the critical-bug rollup to include sev-1/sev-2 records that are `fixed` or `invalid`.

## Expected Behavior

- The generated rollup must count only records in the vault's open bug lifecycle and list the same records.

## Reproduction Steps

1. Keep a fixed or invalid sev-1/sev-2 bug record in the vault.
2. Run `vault_refresh active_context`.
3. Observe that the generated open-critical count and list include the resolved record.

## Scope / Blast Radius

- Upstream `@fancyrobot/agent-vault` generation only; Struct application code and data are unaffected.

## Suspected Root Cause

- The generator uses a negative `status !== closed` filter rather than an allowlist of open statuses.

## Confirmed Root Cause

- Runtime source inspection found both Active Context rollups filter only `closed`, allowing `fixed` and `invalid` records into the open-critical view.

## Workaround

- Maintain Struct's canonical generated block manually and do not run `vault_refresh active_context` until upstream repairs the predicate.

## Permanent Fix Plan

- Upstream should filter the rollup by its documented open statuses and add a resolved-critical-bug regression case.

## Regression Coverage Needed

- An upstream generator test with `new`, `fixed`, `invalid`, and `closed` sev-1/sev-2 records; only open records may appear in the count or list.

## Related Notes

<!-- AGENT-START:bug-related-notes -->
- [[02_Phases/Phase_10B_brand_implementation/Phase|PHASE-10B Brand Implementation]]
<!-- AGENT-END:bug-related-notes -->

## Timeline

<!-- AGENT-START:bug-timeline -->
- 2026-07-31 - Reported.
<!-- AGENT-END:bug-timeline -->
