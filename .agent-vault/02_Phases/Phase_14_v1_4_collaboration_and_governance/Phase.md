---
note_type: phase
template_version: 2
contract_version: 1
title: v1.4 Collaboration and Governance
phase_id: PHASE-14
status: planned
owner: ''
created: '2026-07-17'
updated: '2026-07-17'
depends_on:
  - '[[02_Phases/Phase_13_v1_3_continuous_research/Phase|PHASE-13 v1.3 Continuous Research]]'
related_architecture:
  - '[[01_Architecture/System_Overview|System Overview]]'
  - '[[01_Architecture/Domain_Model|Domain Model]]'
  - '[[01_Architecture/Integration_Map|Integration Map]]'
  - '[[01_Architecture/Agent_Workflow|Agent Workflow]]'
related_decisions:
  - '[[04_Decisions/DEC-0006_make-source-versions-immutable-and-provenance-typed|DEC-0006 Make Source Versions Immutable and Provenance Typed]]'
  - '[[04_Decisions/DEC-0009_sandbox-filesystem-roots-and-allowlist-read-only-sql|DEC-0009 Sandbox Filesystem Roots and Allowlist Read-Only SQL]]'
related_bugs: []
tags:
  - agent-vault
  - phase
  - post-v1
---

# Phase 14 v1.4 Collaboration and Governance

Use this note as the canonical bounded milestone. Detailed execution belongs in linked step companion notes; architecture and durable choices belong in their linked notes.

## Objective

- Support governed multi-user research with role-based access, review workflows, annotations, retention, and audit controls across every evidence and export path.

## Why This Phase Exists

- Collaboration adds authorization and lifecycle complexity that should build on a mature single-workspace audit model rather than being retrofitted into v1.

## Scope

- Implement organization/workspace roles, membership, sharing, service identities, and policy enforcement.
- Add annotations, assignments, review/approval, publication, and conflict-safe authorship workflows.
- Enforce retention, legal hold, deletion, audit export, administrator controls, and governance documentation.

## Non-Goals

- Cross-tenant data sharing without explicit policy.
- Replacing immutable generated evidence with mutable collaborative text.

## Dependencies

- Depends on [[02_Phases/Phase_13_v1_3_continuous_research/Phase|PHASE-13 v1.3 Continuous Research]].

## Acceptance Criteria

- [ ] Authorization is deny-by-default and enforced consistently in API, tools, jobs, retrieval, citations, events, exports, and UI.
- [ ] Review and annotation history preserves authorship, timestamps, evidence versions, and conflict resolution.
- [ ] Retention, hold, deletion, audit export, offboarding, and incident scenarios pass end-to-end tests.
- [ ] Governance controls have migration, rollback, observability, security, accessibility, and administrator documentation.

## Delivery Strategy

- **Safe parallel work:** Policy-engine work and review UX may proceed in parallel against authorization fixtures; governance release waits for whole-system enforcement tests.
- **Gate:** The phase closes only when all acceptance criteria have reproducible evidence and the relevant docs, migrations, security checks, telemetry, and evaluations are updated.
- **Boundary:** Post-v1 work must not be pulled forward in a way that weakens v1 completeness or its release gates.

## Linear Context

<!-- AGENT-START:phase-linear-context -->
- Previous phase: [[02_Phases/Phase_13_v1_3_continuous_research/Phase|PHASE-13 v1.3 Continuous Research]]
- Current phase status: planned
- Next phase: [[02_Phases/Phase_15_v1_5_advanced_research/Phase|PHASE-15 v1.5 Advanced Research]]
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
- [[04_Decisions/DEC-0009_sandbox-filesystem-roots-and-allowlist-read-only-sql|DEC-0009 Sandbox Filesystem Roots and Allowlist Read-Only SQL]]
<!-- AGENT-END:phase-related-decisions -->

## Related Bugs

<!-- AGENT-START:phase-related-bugs -->
- None yet.
<!-- AGENT-END:phase-related-bugs -->

## Steps

<!-- AGENT-START:phase-steps -->
- [ ] [[02_Phases/Phase_14_v1_4_collaboration_and_governance/Steps/Step_01_implement-role-based-sharing-and-workspace-policies|STEP-14-01 Implement Role-Based Sharing and Workspace Policies]]
- [ ] [[02_Phases/Phase_14_v1_4_collaboration_and_governance/Steps/Step_02_add-review-annotations-and-governance-workflows|STEP-14-02 Add Review Annotations and Governance Workflows]]
- [ ] [[02_Phases/Phase_14_v1_4_collaboration_and_governance/Steps/Step_03_enforce-audit-retention-and-administrative-controls|STEP-14-03 Enforce Audit Retention and Administrative Controls]]
<!-- AGENT-END:phase-steps -->

## Notes

- Product requirements: authoritative repository document `docs/product-brief.md`.
- Human-readable roadmap: `docs/roadmap.md`; concise index: `docs/implementation-plan.md`.
- Assumption policy: reversible uncertainties use the documented default until spike evidence requires a decision update; no hidden architectural assumption is carried only in chat.
