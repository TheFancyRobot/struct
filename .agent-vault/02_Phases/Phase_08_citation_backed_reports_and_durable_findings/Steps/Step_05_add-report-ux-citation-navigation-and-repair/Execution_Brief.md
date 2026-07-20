# Execution Brief

## Exact Outcome

- Produce the concrete contracts, artifacts, and bounded implementation/design surfaces for Report UX Citation Navigation and Repair that this step is responsible for before any broader follow-on work begins.

## Prerequisites

- Re-read [[02_Phases/Phase_08_citation_backed_reports_and_durable_findings/Phase|Phase 08 citation backed reports and durable findings]] and confirm the step still matches the current roadmap sequence.
- Confirm the handoff from [[02_Phases/Phase_08_citation_backed_reports_and_durable_findings/Steps/Step_04_build-export-and-share-bundles-with-source-snapshots|STEP-08-04 Build Export and Share Bundles with Source Snapshots]] before widening scope.
- Keep deterministic work in typed Effect services, repositories, and tools; reserve Fred for agentic orchestration only.
- Treat the listed files as planned starting points; create only the smallest set needed to land the slice.

## Planned Starting Files

- These paths may not exist yet; use them as the first bounded implementation or design surface.
- `apps/web/src/components/ReportEditor.tsx`
- `apps/web/src/components/ReportCitationPanel.tsx`
- `apps/web/src/components/CitationRepairDialog.tsx`
- `apps/api/src/routes/citations.ts`

## Required Reading

- [[02_Phases/Phase_08_citation_backed_reports_and_durable_findings/Phase|Phase 08 citation backed reports and durable findings]]
- [[01_Architecture/Domain_Model|Domain Model]]
- [[01_Architecture/Agent_Workflow|Agent Workflow]]
- [[02_Phases/Phase_08_citation_backed_reports_and_durable_findings/Steps/Step_04_build-export-and-share-bundles-with-source-snapshots|STEP-08-04 Build Export and Share Bundles with Source Snapshots]]
- `docs/product-brief.md` sections 9, 17-24, 26-27, and 29-31.

## Concrete Deliverables

- Implement the narrowest typed slice for Report UX Citation Navigation and Repair that is callable by the next step without broadening scope.
- Expose only the minimal API surface in `apps/api/src/routes/citations.ts` needed to exercise this step end to end.
- Use `apps/web/src/components/ReportEditor.tsx`, `apps/web/src/components/ReportCitationPanel.tsx`, `apps/web/src/components/CitationRepairDialog.tsx` to expose only the UI states required to inspect this step’s output and failures.

## Smallest Bounded Checklist

- First, implement the narrowest typed slice for Report UX Citation Navigation and Repair that is callable by the next step without broadening scope.
- Then, expose only the minimal API surface in `apps/api/src/routes/citations.ts` needed to exercise this step end to end.
- Next, use `apps/web/src/components/ReportEditor.tsx`, `apps/web/src/components/ReportCitationPanel.tsx`, `apps/web/src/components/CitationRepairDialog.tsx` to expose only the UI states required to inspect this step’s output and failures.
- Finish by leaving one observable typed path—test, route, worker flow, or UI state—that proves the slice is ready for the next dependent step.

## Constraints and Non-Goals

- Saved findings, reports, export bundles, and citation state must all remain anchored to immutable source versions.
- Editing UX should preserve or explicitly repair citation links rather than silently dropping provenance.
- Report regeneration must stay bounded and section-oriented instead of rerunning unrelated work.

## Related Notes

- Step: [[02_Phases/Phase_08_citation_backed_reports_and_durable_findings/Steps/Step_05_add-report-ux-citation-navigation-and-repair|STEP-08-05 Add Report UX Citation Navigation and Repair]]
- Phase: [[02_Phases/Phase_08_citation_backed_reports_and_durable_findings/Phase|Phase 08 citation backed reports and durable findings]]

## Refined Execution Boundary — 2026-07-20

- Complete the existing SolidJS report experience rather than building a second demo: report outline/editor, finding picker, claim-level status, evidence drawer, document/dataset/recursive/hybrid citation opening, publish/export controls, revision history, and explicit repair actions.
- Reuse `MixedSourceReport`, `CitationViewer`, citation API helpers/routes, application routing, and shared slate/blue light/dark tokens. Use Solid primitives and existing state patterns; do not introduce React compatibility, another component library, or page-local design system.
- Editing creates a new user revision. Repair is explicit and auditable: remove/replace a claim, select newly validated evidence, or regenerate only one section. Never silently retarget an immutable citation or hide contradiction/unsupported/stale/broken/unauthorized/incompatible states.
- Publish/export controls show the exact blocking reasons. Evidence navigation preserves report context and offers a reliable back path. Loading, empty, offline/API failure, conflict, cancellation, and successful-save states are first-class.
- Keep the UI fast and work-ready at common desktop widths while remaining usable on tablet/mobile. Use the SolidJS, frontend-design, and dashboard UI skills during implementation.
