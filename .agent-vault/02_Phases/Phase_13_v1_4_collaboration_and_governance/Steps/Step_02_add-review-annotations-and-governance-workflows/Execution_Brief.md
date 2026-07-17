# Execution Brief

## Exact Outcome

- Implement the smallest coherent slice for Review Annotations and Governance Workflows that advances v1.4 Collaboration and Governance while preserving multi-user governance without weakening workspace isolation.

## Prerequisites

- Re-read [[02_Phases/Phase_13_v1_4_collaboration_and_governance/Phase|Phase 13 v1 4 collaboration and governance]] and confirm the step still matches the current roadmap sequence.
- Confirm the handoff from [[02_Phases/Phase_13_v1_4_collaboration_and_governance/Steps/Step_01_implement-role-based-sharing-and-workspace-policies|STEP-13-01 Implement Role-Based Sharing and Workspace Policies]] before widening scope.
- Keep deterministic work in typed Effect services, repositories, and tools; reserve Fred for agentic orchestration only.
- Treat the listed files as planned starting points; create only the smallest set needed to land the slice.

## Planned Starting Files

- These paths may not exist yet; use them as the first bounded implementation or design surface.
- `packages/domain/src/review.ts`
- `apps/api/src/routes/reviews.ts`
- `apps/web/src/components/FindingReviewPanel.tsx`
- `packages/research-engine/src/governance-rules.ts`

## Required Reading

- [[02_Phases/Phase_13_v1_4_collaboration_and_governance/Phase|Phase 13 v1 4 collaboration and governance]]
- [[01_Architecture/System_Overview|System Overview]]
- [[01_Architecture/Domain_Model|Domain Model]]
- [[02_Phases/Phase_13_v1_4_collaboration_and_governance/Steps/Step_01_implement-role-based-sharing-and-workspace-policies|STEP-13-01 Implement Role-Based Sharing and Workspace Policies]]
- `docs/product-brief.md` sections 18-22, 28-29, and 31.

## Smallest Bounded Checklist

- Define versioned annotations, assignments, review requests, approvals, rejections, publication states, and authorship events.
- Attach review objects to immutable claim/evidence/report versions while keeping collaborative edits separate from generated evidence.
- Implement conflict-safe edit/review flows, permission checks, notifications, and visible provenance for every state transition.
- Test concurrent edits, stale reviews, revoked reviewers, superseded evidence, rejected publication, accessibility, and audit reconstruction.

## Constraints and Non-Goals

- Collaboration features must preserve workspace isolation, role clarity, and attributable audit history.
- Governance workflows should attach to findings, reports, and model policies without obscuring evidence provenance.
- Administrative controls need explicit retention, review, and escalation semantics before broadening access.

## Related Notes

- Step: [[02_Phases/Phase_13_v1_4_collaboration_and_governance/Steps/Step_02_add-review-annotations-and-governance-workflows|STEP-13-02 Add Review Annotations and Governance Workflows]]
- Phase: [[02_Phases/Phase_13_v1_4_collaboration_and_governance/Phase|Phase 13 v1 4 collaboration and governance]]
