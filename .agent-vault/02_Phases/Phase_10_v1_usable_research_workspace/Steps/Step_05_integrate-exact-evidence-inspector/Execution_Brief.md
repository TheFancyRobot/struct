# Execution Brief

- Prerequisite: STEP-10-04 produces real citation-backed answers.
- Required reading: Phase 02, 04, 07, and 08; citation/provenance docs; CitationViewer, ReportCitationPanel, and research projection APIs.
- Starting files: `apps/api/src/routes/citations.ts`, `packages/persistence/src/repositories/research-projections.ts`, `apps/web/src/components/CitationViewer.tsx`, `ReportCitationPanel.tsx`, and citation routing helpers.
- Checklist: adapt existing evidence renderers into EvidenceInspector; retain immutable version, hash, locator, query, result, unit, window, cohort, and denominator metadata; provide all non-success states; support desktop pane, tablet drawer, and mobile sheet; restore focus on close.
- Edge cases: stale/superseded citation, unauthorized source, missing projection, rapid selection changes, long excerpts, wide tables, keyboard-only use, and browser back.

## Refinement Addendum — Execution-Ready Contract

### Outcome and prerequisites

- Success means activating any validated inline citation updates the existing right pane to the exact authorized document passage or deterministic dataset result without remounting, scrolling, or clearing the conversation/draft. Close/Back restores the prior pane state and focus.
- Requires STEP-10-04 real thread/run history with validated citation identities. This step publishes the evidence/provenance contract reused by notes.

### Concrete starting points and required reading

- Document evidence: `apps/api/src/routes/citations.ts`, `packages/persistence/src/repositories/research-projections.ts`, `apps/web/src/components/CitationViewer.tsx`, and `pages/CitationPage.tsx`.
- Dataset evidence: `packages/domain/src/dataset-query-evidence.ts`, `cross-source-evidence.ts`; `packages/persistence/src/repositories/dataset-query-evidence.ts`; `apps/api/src/routes/dataset-queries.ts`.
- Reusable UI/routing: `apps/web/src/components/MixedSourceReport.tsx`, `ReportCitationPanel.tsx`, `ResearchStream.tsx`, `PartialFindingsPanel.tsx`, `citation-paths.ts`, `pages/citation-return.ts`, `base-path.ts`, and router wiring in `index.tsx`.
- Add one typed web evidence client plus bounded `EvidenceInspector` adapters; do not duplicate citation parsing or deterministic query projection logic.
- Read citation/provenance documentation, DEC-0006/0008, Phase 02/04/07/08 outcomes, and the BUG-0015/0016 base-path regressions before editing.

### Exact evidence and pane contract

1. Expose/consume a discriminated evidence union for document and dataset citations. Every success includes citation/run/thread identity, immutable source/snapshot version, stable locator, source name, and validation state.
2. Document detail preserves original/normalized hashes, section/page/line or byte/character locator, exact cited excerpt, bounded surrounding context, and source-version identity. Never silently substitute a newer version.
3. Dataset detail preserves query text/parameters, engine/version, result hash, schema/snapshot IDs, rows/row count/truncation, units, filters, time window/timezone, cohort, denominator, join keys, and calculation limitations. Do not recompute or model-summarize exact results in the inspector.
4. Selecting a citation updates project-scoped shell evidence state and a base-path-safe history entry such as `?evidence=:citationId`; it does not navigate to a standalone page or remount the center. Browser Back/Forward changes/clears selection predictably.
5. Desktop uses the existing right pane; tablet uses a right drawer; mobile uses an evidence sheet. Open moves focus to the inspector heading/selected item; switching keeps focus in context; close/Escape returns focus to the exact citation trigger.
6. Abort/ignore stale fetches during rapid reselection. Cache only bounded authorized evidence by immutable identity for the current project session.
7. State table is explicit: no selection, loading, document success, dataset success, missing/not-found, unauthorized-as-not-found, invalid, stale/superseded, repair-required, network failure/retry, long excerpt, wide/truncated result, and rapid reselection.
8. Invalid/stale/missing evidence is never rendered as trustworthy success. Repair actions reuse existing bounded repair contracts where available; otherwise provide a non-destructive explanation and return action.

### Security, performance, recovery, non-goals, and handoff

- Derive workspace from auth and verify the project/thread/run/citation/source/query chain. Foreign/missing resources share a response shape and no source metadata leaks before authorization.
- Render source content as untrusted text; never inject HTML or execute links/instructions from evidence. Keep wide tables/excerpts scrollable inside the pane and cap context/result payloads.
- Do not redesign research execution, mutate citations, or add generic source browsing. Dedicated legacy citation URLs may redirect/open the inspector for compatibility only until STEP-10-08 removes obsolete primary paths.
- Handoff records the evidence union, URL/history behavior, focus contract, cache bounds, and provenance fields required by STEP-10-06.

### Readiness verdict

- **Pass.** Both evidence kinds, exact provenance, pane/history/focus behavior, failure states, base-path handling, authorization, performance, non-goals, and note handoff are concrete.

## Related Notes

- Step: [[02_Phases/Phase_10_v1_usable_research_workspace/Steps/Step_05_integrate-exact-evidence-inspector|STEP-10-05 Integrate Exact Evidence Inspector]]
- Phase: [[02_Phases/Phase_10_v1_usable_research_workspace/Phase|Phase 10 v1 usable research workspace]]
