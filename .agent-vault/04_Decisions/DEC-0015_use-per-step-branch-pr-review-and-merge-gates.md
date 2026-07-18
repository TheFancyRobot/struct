---
note_type: decision
template_version: 2
contract_version: 1
title: Use Per-Step Branch PR Review and Merge Gates
decision_id: DEC-0015
status: accepted
decided_on: '2026-07-18'
owner: repository-delivery-workflow
created: '2026-07-18'
updated: '2026-07-18'
supersedes: []
superseded_by: []
related_notes:
  - '[[02_Phases/Phase_01_walking_skeleton/Phase|PHASE-01 Walking Skeleton]]'
  - '[[05_Sessions/2026-07-18-193554-implement-single-text-source-ingestion-and-artifact-storage-step-01-03-review-remediation|SESSION-2026-07-18-193554 step-01-03-review-remediation session for Implement Single Text Source Ingestion and Artifact Storage]]'
tags:
  - agent-vault
  - decision
---

# DEC-0015 - Use Per-Step Branch PR Review and Merge Gates

Use one note per durable choice. Record what was chosen, why, tradeoffs, and supersession history, and link back to the phase, bug, or architecture note that made the choice necessary. See [[07_Templates/Note_Contracts|Note Contracts]].

## Status

- Current status: proposed.
- Keep this section aligned with the `status` frontmatter value.
- Current status: accepted on 2026-07-18 by explicit user direction.

## Context

- Decision needed: Use Per-Step Branch PR Review and Merge Gates.
- Related notes: [[02_Phases/Phase_01_walking_skeleton/Phase|PHASE-01 Walking Skeleton]], [[05_Sessions/2026-07-18-193554-implement-single-text-source-ingestion-and-artifact-storage-step-01-03-review-remediation|SESSION-2026-07-18-193554 step-01-03-review-remediation session for Implement Single Text Source Ingestion and Artifact Storage]].

## Decision

- State the chosen direction and boundary clearly.
- Publish the completed STEP-01-03 worktree directly to `main` as the one-time baseline requested by the user.
- For every subsequent roadmap step, start from updated `main`, create a dedicated `agent/<step-id>-<slug>` branch, implement and validate only that step, push it, and open a ready-for-review PR into `main`.
- Wait for automated code-review bots and required checks. Address every unresolved actionable review thread and failing check, push fixes, and repeat until no actionable feedback remains and required checks pass.
- Merge the PR into `main`, update the local checkout and Agent Vault, then and only then begin the next roadmap step.
- The repository zero-defect advancement gate remains authoritative throughout this workflow.
- Add a phase-refinement gate: after the final step of a phase is reviewed and merged, refine the next planned phase before creating or implementing its first step branch. Refinement must align the phase objective, scope, step sequence, dependencies, execution briefs, validation plans, architecture links, decisions, and known risks with the repository state produced by the prior phase.
- Use visible in-session orchestration for all remaining steps and phases: one fresh subagent per step or bug, with the worker forbidden from all git commands and instructed to execute the target-rooted vault workflow. The root orchestrator alone owns branch creation, staging, commits, pushes, PRs, review retries, merges, and advancement.
- Default step retry limit: 2 fresh worker attempts after the initial attempt (3 total attempts). Stop the roadmap on an unrecovered failure or any confirmed defect that cannot be resolved within the gate.
- Continue without interactive design approvals because the user explicitly authorized unattended execution of all refined roadmap work; still obey every repository, vault, zero-defect, review, and release boundary.
- Stop immediately before the v1.0 release action and present release readiness for user control.

## Alternatives Considered

- List realistic alternatives and why they were not selected.

## Tradeoffs

- Describe costs, risks, complexity, and operational implications.
- Each step incurs branch, CI, bot-review, remediation, and merge latency.
- The stronger isolation and review trail reduce cross-step regressions and make rollback and audit boundaries explicit.

## Consequences

- Record what changes now and any required follow-up work.
- Never begin the next roadmap step while the prior step PR is open, has unresolved actionable review feedback, has failing required checks, or has not merged successfully.
- Record branch, PR, review remediation, validation, and merge evidence in the step session handoff.
- A phase is not ready to start merely because its predecessor merged. The next phase must have a recorded refinement session, updated phase/step notes, validated vault links, and an explicit readiness result before its first implementation branch is created.
- Phase refinement occurs once at the phase boundary; normal step handoffs inside an already-active refined phase continue through the per-step PR gate.
- Worker prompts stay short and target-rooted; workers use Agent Vault execution context and never stage, commit, switch branches, push, create PRs, or merge.
- The orchestrator verifies step `status` and mirrored `context_status` after every worker, runs independent validation, and only then performs git and GitHub actions.
- Every retry uses a brand-new subagent rather than resuming a failed worker.

## Related Notes

<!-- AGENT-START:decision-related-notes -->
- Phase: [[02_Phases/Phase_01_walking_skeleton/Phase|PHASE-01 Walking Skeleton]]
- Session: [[05_Sessions/2026-07-18-193554-implement-single-text-source-ingestion-and-artifact-storage-step-01-03-review-remediation|SESSION-2026-07-18-193554 step-01-03-review-remediation session for Implement Single Text Source Ingestion and Artifact Storage]]
<!-- AGENT-END:decision-related-notes -->

## Change Log

<!-- AGENT-START:decision-change-log -->
- 2026-07-18 - Created as `proposed`.
<!-- AGENT-END:decision-change-log -->
- 2026-07-18 - Accepted: user directed a one-time STEP-01-03 push to `main`, followed by one reviewed and merged PR per roadmap step.
- 2026-07-18 - Added the user-directed phase-refinement gate between successful completion of one phase and implementation of the next.
- 2026-07-18 - Added unattended fresh-subagent orchestration, root-only git/review control, a three-attempt retry policy, and the stop-before-v1.0-release boundary.
