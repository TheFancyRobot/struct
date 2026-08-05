---
note_type: bug
template_version: 2
contract_version: 1
title: Source-import browser gate fails to start its Playwright server
bug_id: BUG-0112
status: fixed
severity: sev-3
category: logic
reported_on: '2026-08-05'
fixed_on: '2026-08-05'
owner: root orchestrator
created: '2026-08-05'
updated: '2026-08-05'
related_notes: []
tags:
  - agent-vault
  - bug
---

# BUG-0112 - Source-import browser gate fails to start its Playwright server

Use one note per bug. Capture reproduction, impact, root cause, workaround, and verification, then link back to the relevant phase, step, decision, or session. See [[07_Templates/Note_Contracts|Note Contracts]].

## Summary

- Source-import browser gate fails to start its Playwright server.
- Related notes: none linked yet.

## Observed Behavior

- Describe what actually happens.
- During the v1 campaign's browser gate, the source-import suite could fail while starting its isolated web server with an opaque `ENOENT`/`Failed to connect` readiness failure.

## Expected Behavior

- Describe what should happen instead.
- The isolated browser server starts independently of the parent process `PATH`; if it cannot, the gate reports the server output that explains the failure.

## Reproduction Steps

1. List the exact setup state.
2. List the user or developer actions.
3. Record the observed result.
1. Run the source-import browser path from an environment whose `PATH` does not resolve `bun`.
2. Start the shared isolated app server.
3. Before the fix, its build/server child commands could fail with `ENOENT`, leaving the readiness fetch to report only a connection failure.

## Scope / Blast Radius

- List affected packages, commands, integrations, environments, or users.
- Affected the shared web E2E launcher and therefore any Playwright/Bun browser suite that starts it, most visibly the source-import gate in `bun run v1:evaluate`.

## Suspected Root Cause

- Record current theories and assumptions.
- Initially suspected either a missing Bun executable in the campaign environment or an overloaded server exceeding the isolated five-second probe. The PATH-independent reproduction confirmed the executable-resolution path.

## Confirmed Root Cause

- Record the proven cause and decisive evidence.
- `startAppServer` and its build helper invoked the literal `bun` command through `Bun.spawn`, which depended on inherited `PATH`. The server also discarded stdout/stderr and used an independent five-second polling loop, masking the actual process failure as a generic connection timeout.

## Workaround

- Describe any temporary mitigation and remaining risk.
- Before the permanent fix, preserving a `PATH` entry that resolves `bun` avoided the `ENOENT` path, but still left startup failures poorly diagnosable.

## Permanent Fix Plan

- Describe the intended durable fix.
- Invoke the current Bun runtime by absolute `process.execPath`, use the shared bounded readiness helper, and retain process output for diagnostics.

## Regression Coverage Needed

- List tests, fixtures, reproductions, alerts, or docs updates needed.
- Added a lifecycle regression that clears `PATH` and proves the isolated server still builds, starts, responds, and shuts down cleanly. The source-import browser spec remains the focused end-to-end check.

## Related Notes

<!-- AGENT-START:bug-related-notes -->
- None yet.
<!-- AGENT-END:bug-related-notes -->

## Timeline

<!-- AGENT-START:bug-timeline -->
- 2026-08-05 - Reported.
<!-- AGENT-END:bug-timeline -->
- 2026-08-05 - Fixed: E2E launcher uses `process.execPath`, waits through the shared readiness path, and captures server logs. Focused lifecycle and source-import browser tests passed (19 tests, 73 assertions); web typecheck and targeted ESLint passed.
- 2026-08-05 review remediation: bounded captured-log draining after readiness timeout and early process exit, so diagnostics cannot hang the E2E run; added never-resolving-log regressions.
