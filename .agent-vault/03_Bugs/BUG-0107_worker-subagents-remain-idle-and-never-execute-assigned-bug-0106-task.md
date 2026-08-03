---
note_type: bug
template_version: 2
contract_version: 1
title: Worker startup delay was misclassified as permanent idleness
bug_id: BUG-0107
status: fixed
severity: sev-2
category: integration
reported_on: '2026-08-01'
fixed_on: '2026-08-01'
owner: team-lead
created: '2026-08-01'
updated: '2026-08-03'
related_notes:
  - '[[02_Phases/Phase_11_v1_1_research_usability/Phase|PHASE-11 v1.1 Research Usability]]'
tags:
  - agent-vault
  - bug
---

# BUG-0107 - Worker startup delay was misclassified as permanent idleness

Use one note per bug. Capture reproduction, impact, root cause, workaround, and verification, then link back to the relevant phase, step, decision, or session. See [[07_Templates/Note_Contracts|Note Contracts]].

## Summary

- Worker subagents were reported as permanently idle before their 10–15 second startup window elapsed; the report was a premature classification, not a persistent worker-runtime failure.
- A disposable smoke worker executed its prompt after a 10–15 second startup delay, wrote `/tmp/struct-agent-team-smoke/worker-proof.txt` containing `worker prompt executed`, and completed its assigned task.
- Related notes: [[02_Phases/Phase_11_v1_1_research_usability/Phase|PHASE-11 v1.1 Research Usability]].

## Observed Behavior

- Three distinct workers (`investigation-attempt1`, `investigation-attempt2`, and `investigation-attempt3`) were spawned in fresh teams with a self-contained no-git assigned-task prompt.
- Each was inspected before the startup window elapsed and was incorrectly treated as idle because it had not yet run a command, updated its task, changed a file, or sent a report.
- The first two teams were shut down before retrying. The third was also shut down after the third-attempt limit was exhausted.

## Expected Behavior

- A fresh assigned worker should execute its prompt, update its task state, make the requested scoped changes, run validation, and report to the root orchestrator without using git.

## Reproduction Steps

1. Create a fresh team with a scoped no-git implementation task and record the worker start time.
2. Spawn a fresh worker with the task prompt, then inspect it before 10 seconds have elapsed.
3. Observe that it has not yet run a command or updated the task; do not classify this as failure.
4. Wait at least 15 seconds, then verify that the worker has begun executing the prompt. The disposable smoke worker created `/tmp/struct-agent-team-smoke/worker-proof.txt` with `worker prompt executed` and completed its task after this wait.

## Scope / Blast Radius

- During the misclassification window this appeared to block every roadmap bug and step, because project policy requires one fresh worker per unit and prohibits the root orchestrator from delegating implementation to itself; resolved now that worker execution after the startup delay is confirmed.

## Suspected Root Cause

- The task dispatcher might have a delayed worker-initialization phase; this was confirmed sufficiently to close the report after the smoke-worker execution.

## Confirmed Root Cause

- The earlier claim of a permanent runtime failure was premature classification during the worker startup delay. The worker runtime does accept creation and does execute the supplied task prompt, but execution begins only after a 10–15 second startup window.
- A disposable smoke worker executed its prompt after 10–15 seconds, wrote `/tmp/struct-agent-team-smoke/worker-proof.txt` containing `worker prompt executed`, and completed its assigned task. Repository code is not implicated.

## Workaround

- Allow at least a 10–15 second startup window after spawning a fresh worker before observing or classifying it as idle; the worker begins executing its prompt after this delay.

## Permanent Fix Plan

- Worker prompt delivery and execution in the agent-team runtime are confirmed working; no runtime fix is required.
- The orchestration procedure now waits for the observed startup window before classifying a worker as failed. No product-code change is required.

## Regression Coverage Needed

- An integration smoke test for team spawning and prompt delivery that asserts task update, command execution, file mutation in a disposable checkout, and message delivery.

## Related Notes

<!-- AGENT-START:bug-related-notes -->
- [[02_Phases/Phase_11_v1_1_research_usability/Phase|PHASE-11 v1.1 Research Usability]]
<!-- AGENT-END:bug-related-notes -->

## Timeline

<!-- AGENT-START:bug-timeline -->
- 2026-08-01 - Reported.
- 2026-08-01 - Exhausted three fresh-worker attempts while investigating a separate task; recorded an external orchestration blocker.
- 2026-08-01 - Disposable smoke worker executed its prompt after a 10–15 second startup delay, wrote `/tmp/struct-agent-team-smoke/worker-proof.txt` (`worker prompt executed`), and completed its task; corrected the premature permanent-runtime-failure classification and marked BUG-0107 fixed.
<!-- AGENT-END:bug-timeline -->
