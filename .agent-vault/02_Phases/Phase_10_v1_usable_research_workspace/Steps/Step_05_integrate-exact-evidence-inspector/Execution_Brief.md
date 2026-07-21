# Execution Brief

- Record why the step exists, prerequisites, likely code paths, and the smallest execution checklist here.

- Prerequisite: STEP-10-04 produces real citation-backed answers.
- Required reading: Phase 02, 04, 07, and 08; citation/provenance docs; CitationViewer, ReportCitationPanel, and research projection APIs.
- Starting files: `apps/api/src/routes/citations.ts`, `packages/persistence/src/repositories/research-projections.ts`, `apps/web/src/components/CitationViewer.tsx`, `ReportCitationPanel.tsx`, and citation routing helpers.
- Checklist: adapt existing evidence renderers into EvidenceInspector; retain immutable version, hash, locator, query, result, unit, window, cohort, and denominator metadata; provide all non-success states; support desktop pane, tablet drawer, and mobile sheet; restore focus on close.
- Edge cases: stale/superseded citation, unauthorized source, missing projection, rapid selection changes, long excerpts, wide tables, keyboard-only use, and browser back.

## Related Notes

- Step: [[02_Phases/Phase_10_v1_usable_research_workspace/Steps/Step_05_integrate-exact-evidence-inspector|STEP-10-05 Integrate Exact Evidence Inspector]]
- Phase: [[02_Phases/Phase_10_v1_usable_research_workspace/Phase|Phase 10 v1 usable research workspace]]
