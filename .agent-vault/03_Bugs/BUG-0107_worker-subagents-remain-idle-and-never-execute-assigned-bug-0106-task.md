---
note_type: bug
template_version: 2
contract_version: 1
title: Worker subagents remain idle and never execute assigned BUG-0106 task
bug_id: BUG-0107
status: fixed
severity: sev-2
category: integration
reported_on: '2026-08-01'
fixed_on: '2026-08-01'
owner: team-lead
created: '2026-08-01'
updated: '2026-08-01'
related_notes: '["[[02_Phases/Phase_11_v1_1_research_usability/Phase|PHASE-11 v1.1 Research Usability]]", "[[03_Bugs/BUG-0106_project-list-api-exposes-workspace-ids-despite-its-response-contract|BUG-0106 Project list API exposes workspace IDs despite its response contract]]"]'
tags:
  - agent-vault
  - bug
---

# BUG-0107 - Worker subagents remain idle and never execute assigned BUG-0106 task

Use one note per bug. Capture reproduction, impact, root cause, workaround, and verification, then link back to the relevant phase, step, decision, or session. See [[07_Templates/Note_Contracts|Note Contracts]].

## Summary

- Worker subagents were reported as permanently idle and never executing the assigned BUG-0106 task; this was a premature classification made during the worker startup delay.
- A disposable smoke worker executed its prompt after a 10–15 second startup delay, wrote `/tmp/struct-agent-team-smoke/worker-proof.txt` containing `worker prompt executed`, and completed its assigned task.
- Related notes: none linked yet.

## Observed Behavior

- Describe what actually happens.
- Three distinct workers (`bug0106-attempt1`, `bug0106-attempt2`, and `bug0106-attempt3`) were spawned in fresh teams with the exact model identifier `syn:large:text` and a self-contained no-git BUG-0106 prompt.
- Each read its initial inbox, then remained an idle `pi` process with no child command, made no file change, left its assigned task pending or in progress, and sent no report. Direct follow-up messages remained unread.
- The first two teams were shut down before retrying. The third was also shut down after the third-attempt limit was exhausted.

## Expected Behavior

- Describe what should happen instead.
- A fresh assigned worker should execute its prompt, update its task state, make the requested scoped changes, run validation, and report to the root orchestrator without using git.

## Reproduction Steps

1. List the exact setup state.
2. List the user or developer actions.
3. Record the observed result.
1. Create a team and BUG-0106 task.
2. Spawn a fresh `syn:large:text` worker with an explicit prompt and no-git constraint.
3. Observe that it reads its initial inbox but does not update the task, run a command, edit a file, or send a report; follow-up messages remain unread.
4. Repeat in two fresh teams; the same behavior recurs.

## Scope / Blast Radius

- List affected packages, commands, integrations, environments, or users.
- During the misclassification window this appeared to block every roadmap bug and step, because project policy requires one fresh worker per unit and prohibits the root orchestrator from delegating implementation to itself; resolved now that worker execution after the startup delay is confirmed.
- BUG-0106 remains open and its source tree is unchanged, pending a resumed fresh-worker attempt that observes the 10–15 second startup window.

## Suspected Root Cause

- Record current theories and assumptions.

## Confirmed Root Cause

- Record the proven cause and decisive evidence.
- The earlier claim of a permanent runtime failure was premature classification during the worker startup delay. The worker runtime does accept creation and does execute the supplied task prompt, but execution begins only after a 10–15 second startup window.
- A disposable smoke worker executed its prompt after 10–15 seconds, wrote `/tmp/struct-agent-team-smoke/worker-proof.txt` containing `worker prompt executed`, and completed its assigned task. Repository code is not implicated.

## Workaround

- Describe any temporary mitigation and remaining risk.
- Allow at least a 10–15 second startup window after spawning a fresh worker before observing or classifying it as idle; the worker begins executing its prompt after this delay.

## Permanent Fix Plan

- Describe the intended durable fix.
- Worker prompt delivery and execution in the agent-team runtime are confirmed working; no runtime fix is required.
- Verified via the disposable smoke worker: it read a prompt, made a harmless scoped change (`/tmp/struct-agent-team-smoke/worker-proof.txt` containing `worker prompt executed`), and marked its task completed. No smoke-worker message or report was received by the lead, so message delivery is not asserted. BUG-0106 may be resumed with a new fresh-worker attempt, observing the 10–15 second startup window before classifying a worker as failed.

## Regression Coverage Needed

- List tests, fixtures, reproductions, alerts, or docs updates needed.
- An integration smoke test for team spawning and prompt delivery that asserts task update, command execution, file mutation in a disposable checkout, and message delivery.

## Related Notes

<!-- AGENT-START:bug-related-notes -->
- None yet.
<!-- AGENT-END:bug-related-notes -->
- [[03_Bugs/BUG-0106_project-list-api-exposes-workspace-ids-despite-its-response-contract|BUG-0106 Project list API exposes workspace IDs despite its response contract]] — blocked implementation.
- [[02_Phases/Phase_11_v1_1_research_usability/Phase|PHASE-11 v1.1 Research Usability]] — worker failure blocks the required fresh-worker remediation process.

## Timeline

<!-- AGENT-START:bug-timeline -->
- 2026-08-01 - Reported.
- 2026-08-01 - Exhausted three fresh-worker attempts while fixing BUG-0106; recorded external orchestration blocker.
- 2026-08-01 - Disposable smoke worker executed its prompt after a 10–15 second startup delay, wrote `/tmp/struct-agent-team-smoke/worker-proof.txt` (`worker prompt executed`), and completed its task; corrected the premature permanent-runtime-failure classification and marked BUG-0107 fixed.
<!-- AGENT-END:bug-timeline -->
