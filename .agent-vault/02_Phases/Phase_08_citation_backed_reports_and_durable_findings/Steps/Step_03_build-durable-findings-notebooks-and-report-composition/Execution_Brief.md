# Execution Brief

## Exact Outcome

- Produce the concrete contracts, artifacts, and bounded implementation/design surfaces for Durable Findings Notebooks and Report Composition that this step is responsible for before any broader follow-on work begins.

## Prerequisites

- Re-read [[02_Phases/Phase_08_citation_backed_reports_and_durable_findings/Phase|Phase 08 citation backed reports and durable findings]] and confirm the step still matches the current roadmap sequence.
- Confirm the handoff from [[02_Phases/Phase_08_citation_backed_reports_and_durable_findings/Steps/Step_02_implement-citation-validation-and-provenance-graph|STEP-08-02 Implement Citation Validation and Provenance Graph]] before widening scope.
- Keep deterministic work in typed Effect services, repositories, and tools; reserve Fred for agentic orchestration only.
- Treat the listed files as planned starting points; create only the smallest set needed to land the slice.

## Planned Starting Files

- These paths may not exist yet; use them as the first bounded implementation or design surface.
- `apps/api/src/routes/findings.ts`
- `apps/api/src/routes/reports.ts`
- `apps/web/src/components/NotebookView.tsx`
- `packages/research-engine/src/compose-report.ts`
- `packages/persistence/src/repositories/reports.ts`

## Required Reading

- [[02_Phases/Phase_08_citation_backed_reports_and_durable_findings/Phase|Phase 08 citation backed reports and durable findings]]
- [[01_Architecture/Domain_Model|Domain Model]]
- [[01_Architecture/Agent_Workflow|Agent Workflow]]
- [[02_Phases/Phase_08_citation_backed_reports_and_durable_findings/Steps/Step_02_implement-citation-validation-and-provenance-graph|STEP-08-02 Implement Citation Validation and Provenance Graph]]
- `docs/product-brief.md` sections 9, 17-24, 26-27, and 29-31.

## Concrete Deliverables

- Implement the narrowest typed slice for Durable Findings Notebooks and Report Composition that is callable by the next step without broadening scope.
- Add repository boundaries in `packages/persistence/src/repositories/reports.ts` that translate between storage records and typed domain objects.
- Capture the orchestration or synthesis rules in `packages/research-engine/src/compose-report.ts` without moving deterministic work out of services/tools.
- Expose only the minimal API surface in `apps/api/src/routes/findings.ts`, `apps/api/src/routes/reports.ts` needed to exercise this step end to end.

## Smallest Bounded Checklist

- First, implement the narrowest typed slice for Durable Findings Notebooks and Report Composition that is callable by the next step without broadening scope.
- Then, add repository boundaries in `packages/persistence/src/repositories/reports.ts` that translate between storage records and typed domain objects.
- Next, capture the orchestration or synthesis rules in `packages/research-engine/src/compose-report.ts` without moving deterministic work out of services/tools.
- Finish by leaving one observable typed path—test, route, worker flow, or UI state—that proves the slice is ready for the next dependent step.

## Constraints and Non-Goals

- Saved findings, reports, export bundles, and citation state must all remain anchored to immutable source versions.
- Editing UX should preserve or explicitly repair citation links rather than silently dropping provenance.
- Report regeneration must stay bounded and section-oriented instead of rerunning unrelated work.

## Related Notes

- Step: [[02_Phases/Phase_08_citation_backed_reports_and_durable_findings/Steps/Step_03_build-durable-findings-notebooks-and-report-composition|STEP-08-03 Build Durable Findings Notebooks and Report Composition]]
- Phase: [[02_Phases/Phase_08_citation_backed_reports_and_durable_findings/Phase|Phase 08 citation backed reports and durable findings]]
