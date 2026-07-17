# Execution Brief

## Exact Outcome

- Implement the smallest coherent slice for Saved Queries Views and Research Templates that advances v1.1 Research Usability while preserving evidence-backed UX improvements without lowering research rigor.

## Prerequisites

- Re-read [[02_Phases/Phase_10_v1_1_research_usability/Phase|Phase 10 v1 1 research usability]] and confirm the step still matches the current roadmap sequence.
- Confirm the handoff from [[02_Phases/Phase_10_v1_1_research_usability/Steps/Step_01_improve-research-search-navigation-and-command-ux|STEP-10-01 Improve Research Search Navigation and Command UX]] before widening scope.
- Keep deterministic work in typed Effect services, repositories, and tools; reserve Fred for agentic orchestration only.
- Treat the listed files as planned starting points; create only the smallest set needed to land the slice.

## Planned Starting Files

- These paths may not exist yet; use them as the first bounded implementation or design surface.
- `packages/domain/src/research-template.ts`
- `apps/api/src/routes/research-templates.ts`
- `apps/web/src/components/SavedQueriesView.tsx`
- `apps/web/src/components/ResearchTemplatePicker.tsx`

## Required Reading

- [[02_Phases/Phase_10_v1_1_research_usability/Phase|Phase 10 v1 1 research usability]]
- [[01_Architecture/System_Overview|System Overview]]
- [[01_Architecture/Agent_Workflow|Agent Workflow]]
- [[02_Phases/Phase_10_v1_1_research_usability/Steps/Step_01_improve-research-search-navigation-and-command-ux|STEP-10-01 Improve Research Search Navigation and Command UX]]
- `docs/product-brief.md` sections 17, 23, 27-29, and the v1.1 roadmap bullets in section 28.

## Smallest Bounded Checklist

- Define versioned, workspace-scoped schemas for saved queries, views, filters, and reusable research templates.
- Persist and migrate saved objects without embedding provider secrets, mutable latest-version assumptions, or unchecked tool authority.
- Add create, edit, apply, duplicate, archive, and export/import flows with authorization and compatibility validation.
- Test template-version upgrades, missing sources, stale fields, permission changes, accessibility, and rollback behind feature flags.

## Constraints and Non-Goals

- Usability work should surface existing research power more clearly, not hide provenance or deterministic boundaries.
- New navigation and template features must stay compatible with saved findings, reports, and follow-up research.
- Accessibility and user feedback loops are part of the slice definition, not a post-build cleanup step.

## Related Notes

- Step: [[02_Phases/Phase_10_v1_1_research_usability/Steps/Step_02_add-saved-queries-views-and-research-templates|STEP-10-02 Add Saved Queries Views and Research Templates]]
- Phase: [[02_Phases/Phase_10_v1_1_research_usability/Phase|Phase 10 v1 1 research usability]]
