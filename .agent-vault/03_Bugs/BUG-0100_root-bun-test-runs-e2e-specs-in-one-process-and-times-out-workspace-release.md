---
note_type: bug
template_version: 2
contract_version: 1
title: Root bun test runs e2e specs in one process and times out workspace release
bug_id: BUG-0100
status: invalid
severity: sev-3
category: test
reported_on: '2026-07-31'
fixed_on: ''
owner: audit
created: '2026-07-31'
updated: '2026-07-31'
related_notes:
  - '[[02_Phases/Phase_10B_brand_implementation/Phase|PHASE-10B Brand Implementation]]'
tags:
  - agent-vault
  - bug
---

# BUG-0100 - Root bun test runs e2e specs in one process and times out workspace release

Use one note per bug. Capture reproduction, impact, root cause, workaround, and verification, then link back to the relevant phase, step, decision, or session. See [[07_Templates/Note_Contracts|Note Contracts]].

## Summary

- Root bun test runs e2e specs in one process and times out workspace release.
- Related notes: [[02_Phases/Phase_10B_brand_implementation/Phase|PHASE-10B Brand Implementation]].

## Observed Behavior

- An audit ran raw `bun test`, which intentionally bypasses the repository test script and discovers E2E files in one process; the workspace-release test timed out.
- The supported root command is `bun run test`, which excludes E2E files; E2E uses `bun run test:e2e` with isolated processes.

## Expected Behavior

- No repository defect: documented test scripts must be invoked through Bun's package-script runner.

## Reproduction Steps

1. Run raw `bun test` from the repository root.
2. Observe that it bypasses the package script and includes E2E files directly.

## Scope / Blast Radius

- No production or supported validation gate is affected.

## Suspected Root Cause

- The audit invoked the Bun test runner instead of the repository's `test` script.

## Confirmed Root Cause

- `package.json` defines `test` as `bun test ... --path-ignore-patterns='**/e2e/**'`; raw `bun test` does not apply that script.

## Workaround

- Use `bun run test` and `bun run test:e2e`.

## Permanent Fix Plan

- No code change required.

## Regression Coverage Needed

- Verify `bun run build && bun run test && bun run test:e2e` exits zero.

## Related Notes

<!-- AGENT-START:bug-related-notes -->
- [[02_Phases/Phase_10B_brand_implementation/Phase|PHASE-10B Brand Implementation]]
<!-- AGENT-END:bug-related-notes -->

## Timeline

<!-- AGENT-START:bug-timeline -->
- 2026-07-31 - Reported.
<!-- AGENT-END:bug-timeline -->
