# Execution Brief

## Exact Outcome

- Produce the concrete contracts, artifacts, and bounded implementation/design surfaces for Export and Share Bundles with Source Snapshots that this step is responsible for before any broader follow-on work begins.

## Prerequisites

- Re-read [[02_Phases/Phase_08_citation_backed_reports_and_durable_findings/Phase|Phase 08 citation backed reports and durable findings]] and confirm the step still matches the current roadmap sequence.
- Confirm the handoff from [[02_Phases/Phase_08_citation_backed_reports_and_durable_findings/Steps/Step_03_build-durable-findings-notebooks-and-report-composition|STEP-08-03 Build Durable Findings Notebooks and Report Composition]] before widening scope.
- Keep deterministic work in typed Effect services, repositories, and tools; reserve Fred for agentic orchestration only.
- Treat the listed files as planned starting points; create only the smallest set needed to land the slice.

## Planned Starting Files

- These paths may not exist yet; use them as the first bounded implementation or design surface.
- `packages/source-storage/src/export-bundle.ts`
- `apps/api/src/routes/report-export.ts`
- `apps/worker/src/jobs/export-report.ts`
- `packages/domain/src/export-bundle.ts`

## Required Reading

- [[02_Phases/Phase_08_citation_backed_reports_and_durable_findings/Phase|Phase 08 citation backed reports and durable findings]]
- [[01_Architecture/Domain_Model|Domain Model]]
- [[01_Architecture/Agent_Workflow|Agent Workflow]]
- [[02_Phases/Phase_08_citation_backed_reports_and_durable_findings/Steps/Step_03_build-durable-findings-notebooks-and-report-composition|STEP-08-03 Build Durable Findings Notebooks and Report Composition]]
- `docs/product-brief.md` sections 9, 17-24, 26-27, and 29-31.

## Concrete Deliverables

- Implement the narrowest typed slice for Export and Share Bundles with Source Snapshots that is callable by the next step without broadening scope.
- Define or update typed domain modules for `Export Bundle` in `packages/domain/src/export-bundle.ts`.
- Expose only the minimal API surface in `apps/api/src/routes/report-export.ts` needed to exercise this step end to end.
- Constrain worker-side execution in `apps/worker/src/jobs/export-report.ts` to one resumable, observable path for this slice.

## Smallest Bounded Checklist

- First, implement the narrowest typed slice for Export and Share Bundles with Source Snapshots that is callable by the next step without broadening scope.
- Then, define or update typed domain modules for `Export Bundle` in `packages/domain/src/export-bundle.ts`.
- Next, expose only the minimal API surface in `apps/api/src/routes/report-export.ts` needed to exercise this step end to end.
- Finish by leaving one observable typed path—test, route, worker flow, or UI state—that proves the slice is ready for the next dependent step.

## Constraints and Non-Goals

- Saved findings, reports, export bundles, and citation state must all remain anchored to immutable source versions.
- Editing UX should preserve or explicitly repair citation links rather than silently dropping provenance.
- Report regeneration must stay bounded and section-oriented instead of rerunning unrelated work.

## Related Notes

- Step: [[02_Phases/Phase_08_citation_backed_reports_and_durable_findings/Steps/Step_04_build-export-and-share-bundles-with-source-snapshots|STEP-08-04 Build Export and Share Bundles with Source Snapshots]]
- Phase: [[02_Phases/Phase_08_citation_backed_reports_and_durable_findings/Phase|Phase 08 citation backed reports and durable findings]]

## Refined Execution Boundary — 2026-07-20

- Produce one deterministic export bundle for a publishable report through the existing local content-addressed artifact store. The canonical manifest names report/revision identity, ordered sections and claims, citation validation results, immutable source/query/artifact references, hashes, timestamps, schema version, redaction decisions, and producer version.
- Include only authorized material required to open and verify citations. Dataset evidence carries SQL, parameters, snapshot/result hash, schema/unit/filter/window metadata, and bounded rows; document evidence carries immutable source version and exact span/page/section locator; recursive/hybrid evidence preserves artifact and dual-source links.
- Canonical serialization, stable ordering, content hashing, idempotent request keys, bounded size/file counts, atomic publication, retry/restart behavior, and typed terminal failures belong in deterministic Effect services and the existing artifact store. No Fred workflow.
- The minimal API starts an authorized export and retrieves its status/download. Add a worker job only if existing job durability is necessary for bounded generation; do not invent a second queue or storage protocol.
- “Share” means an authorized bundle/download within existing workspace policy for v1. Do not add public links, external object storage, email delivery, collaborative permissions, PDF generation, or additional export formats.
