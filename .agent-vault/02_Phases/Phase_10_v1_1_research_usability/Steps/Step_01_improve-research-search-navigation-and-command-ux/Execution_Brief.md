# Execution Brief

## Exact Outcome

- Implement the smallest coherent slice for Research Search Navigation and Command UX that advances v1.1 Research Usability while preserving evidence-backed UX improvements without lowering research rigor.

## Prerequisites

- Re-read [[02_Phases/Phase_10_v1_1_research_usability/Phase|Phase 10 v1 1 research usability]] and confirm the step still matches the current roadmap sequence.
- Confirm the handoff from [[02_Phases/Phase_09_v1_production_hardening_and_release/Steps/Step_06_publish-v1-documentation-accessibility-and-release-checklist|STEP-09-06 Publish v1 Documentation Accessibility and Release Checklist]] before widening scope.
- Keep deterministic work in typed Effect services, repositories, and tools; reserve Fred for agentic orchestration only.
- Treat the listed files as planned starting points; create only the smallest set needed to land the slice.

## Planned Starting Files

- These paths may not exist yet; use them as the first bounded implementation or design surface.
- `apps/web/src/components/GlobalSearch.tsx`
- `apps/web/src/components/CommandPalette.tsx`
- `apps/web/src/components/ResearchNavigation.tsx`
- `apps/api/src/routes/search.ts`

## Required Reading

- [[02_Phases/Phase_10_v1_1_research_usability/Phase|Phase 10 v1 1 research usability]]
- [[01_Architecture/System_Overview|System Overview]]
- [[01_Architecture/Agent_Workflow|Agent Workflow]]
- [[02_Phases/Phase_09_v1_production_hardening_and_release/Steps/Step_06_publish-v1-documentation-accessibility-and-release-checklist|STEP-09-06 Publish v1 Documentation Accessibility and Release Checklist]]
- `docs/product-brief.md` sections 17, 23, 27-29, and the v1.1 roadmap bullets in section 28.

## Smallest Bounded Checklist

- Define workspace-scoped search result and command schemas covering projects, sources, runs, findings, reports, and citations.
- Implement keyboard-accessible global search, command palette, and research navigation against authorized typed API queries.
- Preserve source-version, citation-state, and run-status context in every result instead of collapsing records into generic text hits.
- Instrument query latency, empty/error states, keyboard flows, and accessibility behavior with component and browser tests.

## Constraints and Non-Goals

- Usability work should surface existing research power more clearly, not hide provenance or deterministic boundaries.
- New navigation and template features must stay compatible with saved findings, reports, and follow-up research.
- Accessibility and user feedback loops are part of the slice definition, not a post-build cleanup step.

## Related Notes

- Step: [[02_Phases/Phase_10_v1_1_research_usability/Steps/Step_01_improve-research-search-navigation-and-command-ux|STEP-10-01 Improve Research Search Navigation and Command UX]]
- Phase: [[02_Phases/Phase_10_v1_1_research_usability/Phase|Phase 10 v1 1 research usability]]
