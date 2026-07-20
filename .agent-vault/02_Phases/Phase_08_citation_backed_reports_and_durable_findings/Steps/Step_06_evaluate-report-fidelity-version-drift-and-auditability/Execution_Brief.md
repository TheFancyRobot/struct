# Execution Brief

## Exact Outcome

- Produce the concrete contracts, artifacts, and bounded implementation/design surfaces for Report Fidelity Version Drift and Auditability that this step is responsible for before any broader follow-on work begins.

## Prerequisites

- Re-read [[02_Phases/Phase_08_citation_backed_reports_and_durable_findings/Phase|Phase 08 citation backed reports and durable findings]] and confirm the step still matches the current roadmap sequence.
- Confirm the handoff from [[02_Phases/Phase_08_citation_backed_reports_and_durable_findings/Steps/Step_05_add-report-ux-citation-navigation-and-repair|STEP-08-05 Add Report UX Citation Navigation and Repair]] before widening scope.
- Keep deterministic work in typed Effect services, repositories, and tools; reserve Fred for agentic orchestration only.
- Treat the listed files as planned starting points; create only the smallest set needed to land the slice.

## Planned Starting Files

- These paths may not exist yet; use them as the first bounded implementation or design surface.
- `packages/evaluation/src/report-fidelity.ts`
- `apps/api/test/report-export.integration.test.ts`
- `docs/operations/report-audit.md`
- `docs/benchmarks/report-fidelity.md`

## Required Reading

- [[02_Phases/Phase_08_citation_backed_reports_and_durable_findings/Phase|Phase 08 citation backed reports and durable findings]]
- [[01_Architecture/Domain_Model|Domain Model]]
- [[01_Architecture/Agent_Workflow|Agent Workflow]]
- [[02_Phases/Phase_08_citation_backed_reports_and_durable_findings/Steps/Step_05_add-report-ux-citation-navigation-and-repair|STEP-08-05 Add Report UX Citation Navigation and Repair]]
- `docs/product-brief.md` sections 9, 17-24, 26-27, and 29-31.

## Concrete Deliverables

- Produce an evidence-backed validation pass for Report Fidelity Version Drift and Auditability, with explicit pass/fail criteria and durable output artifacts.
- Expose only the minimal API surface in `apps/api/test/report-export.integration.test.ts` needed to exercise this step end to end.
- Add deterministic evaluation or benchmark artifacts in `packages/evaluation/src/report-fidelity.ts` so this step can be judged without hand-waving.
- Capture the durable contract or operator guidance in `docs/operations/report-audit.md`, `docs/benchmarks/report-fidelity.md` rather than burying it in session-only notes.

## Smallest Bounded Checklist

- First, produce an evidence-backed validation pass for Report Fidelity Version Drift and Auditability, with explicit pass/fail criteria and durable output artifacts.
- Then, expose only the minimal API surface in `apps/api/test/report-export.integration.test.ts` needed to exercise this step end to end.
- Next, add deterministic evaluation or benchmark artifacts in `packages/evaluation/src/report-fidelity.ts` so this step can be judged without hand-waving.
- Finish by capturing the deterministic fixture, benchmark, or gate evidence that will let the validation plan judge the slice without guesswork.

## Constraints and Non-Goals

- Saved findings, reports, export bundles, and citation state must all remain anchored to immutable source versions.
- Editing UX should preserve or explicitly repair citation links rather than silently dropping provenance.
- Report regeneration must stay bounded and section-oriented instead of rerunning unrelated work.

## Related Notes

- Step: [[02_Phases/Phase_08_citation_backed_reports_and_durable_findings/Steps/Step_06_evaluate-report-fidelity-version-drift-and-auditability|STEP-08-06 Evaluate Report Fidelity Version Drift and Auditability]]
- Phase: [[02_Phases/Phase_08_citation_backed_reports_and_durable_findings/Phase|Phase 08 citation backed reports and durable findings]]

## Refined Execution Boundary — 2026-07-20

- Add a deterministic Phase 08 evaluation that exercises the real domain, persistence/service, API, export, and UI-facing contracts shipped in Steps 01–05; fixture-only restatements of expected state do not satisfy the gate.
- The corpus includes document-only, dataset-only, recursive, and hybrid reports; generated and user-edited revisions; valid, unsupported, stale, broken, unauthorized, incompatible, contradicted, and repaired claims; source refresh/reindex; restart/replay; export round trip; and prompt-injection evidence.
- Derive fidelity, citation resolution, provenance completeness, publication blocking, drift detection, repair auditability, authorization containment, deterministic export, recovery, and accessibility results from observed case outcomes. Store seed/config, limits, assumptions, case counts, failures, and canonical result hash.
- The verifier parses through Effect Schema, checks exact case/result counts and IDs, recomputes semantic outcomes from the recorded evidence, and rejects independently tampered status, count, claim, edge, locator, version, hash, authorization, repair history, bundle, resource metric, or outer report hash.
- Keep evaluation bounded and reproducible with explicit wall-clock, concurrency, artifact-size, and case-count limits. Do not add a production-scale corpus, external service, second runtime, or unrelated performance platform.
