# Implementation Notes

- Capture durable findings learned during execution. Prefer short bullets with file paths, commands, and observed behavior.
- Added `apps/web/src/components/MixedSourceReport.tsx` as the single typed
  SolidJS boundary for mixed-source results and deterministic demo states.
- `ResearchPage` selects the explicit `?demo=mixed-source&state=...` fixture;
  `ResearchStream` takes that branch before initializing live resources, so the
  demo makes no accidental API request.
- Desktop uses a source rail, synthesis notebook, and evidence explorer. Mobile
  uses keyboard-operable source/synthesis/evidence tabs.
- Exact provenance includes immutable document versions/spans, canonical SQL,
  columns/types, rows, query hashes/ranges, unit/window/cohort/denominator
  semantics, mismatches, limitations, and inline anchors.
- The UI preserves the existing slate/blue token system, explicit light/dark
  behavior, focus visibility, reduced motion, semantic landmarks, and bounded
  horizontal table scrolling.
- Root review made inline document/query citations switch the mobile layout to
  the Evidence pane before anchor navigation, assigns one stable DOM anchor per
  dataset, and renders boolean/null query cells without information loss.
- Playwright observes failed requests, HTTP error responses, console errors,
  and page errors on every mixed-source workflow rather than relying only on
  the initial document response.
- The Fred cleanup regression now compares shutdown completion ordering against
  the emergency cleanup budget, avoiding a load-sensitive wall-clock threshold.

## Related Notes

- Step: [[02_Phases/Phase_07_hybrid_cross_source_research/Steps/Step_05_deliver-mixed-source-demo-and-explorable-report|STEP-07-05 Deliver Mixed-Source Demo and Explorable Report]]
- Phase: [[02_Phases/Phase_07_hybrid_cross_source_research/Phase|Phase 07 hybrid cross source research]]
