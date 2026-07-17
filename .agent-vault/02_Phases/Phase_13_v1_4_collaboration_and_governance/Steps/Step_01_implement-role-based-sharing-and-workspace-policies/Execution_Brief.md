# Execution Brief

## Exact Outcome

- Implement the smallest coherent slice for Role-Based Sharing and Workspace Policies that advances v1.4 Collaboration and Governance while preserving multi-user governance without weakening workspace isolation.

## Prerequisites

- Re-read [[02_Phases/Phase_13_v1_4_collaboration_and_governance/Phase|Phase 13 v1 4 collaboration and governance]] and confirm the step still matches the current roadmap sequence.
- Confirm the handoff from [[02_Phases/Phase_12_v1_3_continuous_research/Steps/Step_03_add-alerts-staleness-policies-and-operations|STEP-12-03 Add Alerts Staleness Policies and Operations]] before widening scope.
- Keep deterministic work in typed Effect services, repositories, and tools; reserve Fred for agentic orchestration only.
- Treat the listed files as planned starting points; create only the smallest set needed to land the slice.

## Planned Starting Files

- These paths may not exist yet; use them as the first bounded implementation or design surface.
- `packages/domain/src/roles.ts`
- `apps/api/src/auth/policies.ts`
- `apps/api/src/routes/workspace-members.ts`
- `apps/web/src/components/WorkspaceMembers.tsx`

## Required Reading

- [[02_Phases/Phase_13_v1_4_collaboration_and_governance/Phase|Phase 13 v1 4 collaboration and governance]]
- [[01_Architecture/System_Overview|System Overview]]
- [[01_Architecture/Domain_Model|Domain Model]]
- [[02_Phases/Phase_12_v1_3_continuous_research/Steps/Step_03_add-alerts-staleness-policies-and-operations|STEP-12-03 Add Alerts Staleness Policies and Operations]]
- `docs/product-brief.md` sections 18-22, 28-29, and 31.

## Smallest Bounded Checklist

- Define organization, membership, role, permission, sharing, service-identity, and policy schemas with deny-by-default semantics.
- Enforce authorization in API queries/commands, repositories, retrieval, Fred tools, jobs, events, citations, artifacts, and exports.
- Add invitation, role-change, revocation, offboarding, and shared-link lifecycles without copying evidence across workspaces.
- Run cross-tenant, object-level authorization, confused-deputy, cache, SSE, background-job, and migration tests.

## Constraints and Non-Goals

- Collaboration features must preserve workspace isolation, role clarity, and attributable audit history.
- Governance workflows should attach to findings, reports, and model policies without obscuring evidence provenance.
- Administrative controls need explicit retention, review, and escalation semantics before broadening access.

## Related Notes

- Step: [[02_Phases/Phase_13_v1_4_collaboration_and_governance/Steps/Step_01_implement-role-based-sharing-and-workspace-policies|STEP-13-01 Implement Role-Based Sharing and Workspace Policies]]
- Phase: [[02_Phases/Phase_13_v1_4_collaboration_and_governance/Phase|Phase 13 v1 4 collaboration and governance]]
