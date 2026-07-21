---
note_type: phase
template_version: 2
contract_version: 1
title: v1.3 Continuous Research
phase_id: PHASE-13
status: planned
owner: ''
created: '2026-07-17'
updated: '2026-07-17'
depends_on:
  - '[[02_Phases/Phase_12_v1_2_additional_sources/Phase|PHASE-12 v1.2 Additional Sources]]'
related_architecture:
  - '[[01_Architecture/System_Overview|System Overview]]'
  - '[[01_Architecture/Domain_Model|Domain Model]]'
  - '[[01_Architecture/Integration_Map|Integration Map]]'
  - '[[01_Architecture/Agent_Workflow|Agent Workflow]]'
related_decisions:
  - '[[04_Decisions/DEC-0006_make-source-versions-immutable-and-provenance-typed|DEC-0006 Make Source Versions Immutable and Provenance Typed]]'
  - '[[04_Decisions/DEC-0007_compose-a-product-job-journal-with-fred-checkpoints|DEC-0007 Compose a Product Job Journal with Fred Checkpoints]]'
related_bugs: []
tags:
  - agent-vault
  - phase
  - post-v1
---

# Phase 13 v1.3 Continuous Research

Use this note as the canonical bounded milestone. Detailed execution belongs in linked step companion notes; architecture and durable choices belong in their linked notes.

## Objective

- Detect source-version changes, refresh derived artifacts, rerun eligible research incrementally, and notify users with explicit staleness and cost controls.

## Why This Phase Exists

- Durable workspaces become more valuable when findings remain current, but automation must not silently spend money, overwrite evidence, or mask changed assumptions.

## Scope

- Add scheduled and event-driven change detection with connector-aware cursors and idempotent refresh.
- Compute impact graphs and incrementally rerun only invalidated plan branches under user-approved budgets.
- Add staleness policies, alerts, digests, suppression, audit history, operations, and user controls.

## Non-Goals

- Unbounded background agents or silent automatic publication.
- Mutating historical reports or citations when newer source versions arrive.

## Dependencies

- Depends on [[02_Phases/Phase_12_v1_2_additional_sources/Phase|PHASE-12 v1.2 Additional Sources]].

## Acceptance Criteria

- [ ] Change detection is idempotent, workspace-scoped, observable, and preserves old versions.
- [ ] Impact analysis identifies affected findings, citations, queries, and branches before rerun.
- [ ] Reruns honor approval, schedule, model/tool, cost, concurrency, and notification policies.
- [ ] Stale/current states, diffs, failures, suppression, recovery, migrations, and audit history are testable and documented.

## Delivery Strategy

- **Safe parallel work:** Change detection and notification policy work can proceed in parallel; incremental reruns depend on the impact graph.
- **Gate:** The phase closes only when all acceptance criteria have reproducible evidence and the relevant docs, migrations, security checks, telemetry, and evaluations are updated.
- **Boundary:** Post-v1 work must not be pulled forward in a way that weakens v1 completeness or its release gates.

## Linear Context

<!-- AGENT-START:phase-linear-context -->
- Previous phase: [[02_Phases/Phase_12_v1_2_additional_sources/Phase|PHASE-12 v1.2 Additional Sources]]
- Current phase status: planned
- Next phase: [[02_Phases/Phase_14_v1_4_collaboration_and_governance/Phase|PHASE-14 v1.4 Collaboration and Governance]]
<!-- AGENT-END:phase-linear-context -->

## Related Architecture

<!-- AGENT-START:phase-related-architecture -->
- [[01_Architecture/System_Overview|System Overview]]
- [[01_Architecture/Domain_Model|Domain Model]]
- [[01_Architecture/Integration_Map|Integration Map]]
- [[01_Architecture/Agent_Workflow|Agent Workflow]]
<!-- AGENT-END:phase-related-architecture -->

## Related Decisions

<!-- AGENT-START:phase-related-decisions -->
- [[04_Decisions/DEC-0006_make-source-versions-immutable-and-provenance-typed|DEC-0006 Make Source Versions Immutable and Provenance Typed]]
- [[04_Decisions/DEC-0007_compose-a-product-job-journal-with-fred-checkpoints|DEC-0007 Compose a Product Job Journal with Fred Checkpoints]]
<!-- AGENT-END:phase-related-decisions -->

## Related Bugs

<!-- AGENT-START:phase-related-bugs -->
- None yet.
<!-- AGENT-END:phase-related-bugs -->

## Steps

<!-- AGENT-START:phase-steps -->
- [ ] [[02_Phases/Phase_13_v1_3_continuous_research/Steps/Step_01_schedule-source-change-detection-and-refresh|STEP-13-01 Schedule Source Change Detection and Refresh]]
- [ ] [[02_Phases/Phase_13_v1_3_continuous_research/Steps/Step_02_rerun-incremental-research-from-version-changes|STEP-13-02 Rerun Incremental Research from Version Changes]]
- [ ] [[02_Phases/Phase_13_v1_3_continuous_research/Steps/Step_03_add-alerts-staleness-policies-and-operations|STEP-13-03 Add Alerts Staleness Policies and Operations]]
<!-- AGENT-END:phase-steps -->

## Notes

- Product requirements: authoritative repository document `docs/product-brief.md`.
- Human-readable roadmap: `docs/roadmap.md`; concise index: `docs/implementation-plan.md`.
- Assumption policy: reversible uncertainties use the documented default until spike evidence requires a decision update; no hidden architectural assumption is carried only in chat.
