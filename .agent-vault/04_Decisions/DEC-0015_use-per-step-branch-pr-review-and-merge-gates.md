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
