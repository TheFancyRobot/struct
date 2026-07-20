# Execution Brief

## Exact Outcome

- Produce the concrete contracts, artifacts, and bounded implementation/design surfaces for Citation Validation and Provenance Graph that this step is responsible for before any broader follow-on work begins.

## Prerequisites

- Re-read [[02_Phases/Phase_08_citation_backed_reports_and_durable_findings/Phase|Phase 08 citation backed reports and durable findings]] and confirm the step still matches the current roadmap sequence.
- Confirm the handoff from [[02_Phases/Phase_08_citation_backed_reports_and_durable_findings/Steps/Step_01_define-findings-reports-citation-states-and-lifecycle|STEP-08-01 Define Findings Reports Citation States and Lifecycle]] before widening scope.
- Keep deterministic work in typed Effect services, repositories, and tools; reserve Fred for agentic orchestration only.
- Treat the listed files as planned starting points; create only the smallest set needed to land the slice.

## Planned Starting Files

- These paths may not exist yet; use them as the first bounded implementation or design surface.
- `packages/research-engine/src/validate-citations.ts`
- `packages/persistence/src/repositories/provenance-graph.ts`
- `packages/domain/src/provenance-graph.ts`
- `packages/research-engine/src/citation-state-machine.ts`

## Required Reading

- [[02_Phases/Phase_08_citation_backed_reports_and_durable_findings/Phase|Phase 08 citation backed reports and durable findings]]
- [[01_Architecture/Domain_Model|Domain Model]]
- [[01_Architecture/Agent_Workflow|Agent Workflow]]
- [[02_Phases/Phase_08_citation_backed_reports_and_durable_findings/Steps/Step_01_define-findings-reports-citation-states-and-lifecycle|STEP-08-01 Define Findings Reports Citation States and Lifecycle]]
- `docs/product-brief.md` sections 9, 17-24, 26-27, and 29-31.

## Concrete Deliverables

- Implement the narrowest typed slice for Citation Validation and Provenance Graph that is callable by the next step without broadening scope.
- Define or update typed domain modules for `Provenance Graph` in `packages/domain/src/provenance-graph.ts`.
- Add repository boundaries in `packages/persistence/src/repositories/provenance-graph.ts` that translate between storage records and typed domain objects.
- Capture the orchestration or synthesis rules in `packages/research-engine/src/validate-citations.ts`, `packages/research-engine/src/citation-state-machine.ts` without moving deterministic work out of services/tools.

## Smallest Bounded Checklist

- First, implement the narrowest typed slice for Citation Validation and Provenance Graph that is callable by the next step without broadening scope.
- Then, define or update typed domain modules for `Provenance Graph` in `packages/domain/src/provenance-graph.ts`.
- Next, add repository boundaries in `packages/persistence/src/repositories/provenance-graph.ts` that translate between storage records and typed domain objects.
- Finish by leaving one observable typed path—test, route, worker flow, or UI state—that proves the slice is ready for the next dependent step.

## Constraints and Non-Goals

- Saved findings, reports, export bundles, and citation state must all remain anchored to immutable source versions.
- Editing UX should preserve or explicitly repair citation links rather than silently dropping provenance.
- Report regeneration must stay bounded and section-oriented instead of rerunning unrelated work.

## Related Notes

- Step: [[02_Phases/Phase_08_citation_backed_reports_and_durable_findings/Steps/Step_02_implement-citation-validation-and-provenance-graph|STEP-08-02 Implement Citation Validation and Provenance Graph]]
- Phase: [[02_Phases/Phase_08_citation_backed_reports_and_durable_findings/Phase|Phase 08 citation backed reports and durable findings]]

## Refined Execution Boundary — 2026-07-20

- Implement one deterministic Effect validation service and persistence projection over the Step 01 contract. Reuse existing citation repositories, research projections, `getCitationDetail`, dataset citation reopening, and immutable source/query/artifact identities instead of creating a disconnected graph subsystem.
- Persist typed edges from report claim to report revision, finding/run output, evidence, and immutable document span, dataset query/result snapshot, recursive artifact, or hybrid dual evidence. Store only the edges and validation facts needed for opening, auditing, drift detection, and publication gating; do not add a graph database.
- Validate existence, exact locator/hash/snapshot identity, workspace/project authorization, evidence-kind compatibility, and current visibility. Return explicit valid, stale, broken, unauthorized, or incompatible results; never silently retarget a citation to a refreshed version.
- Provide a bounded revalidation path triggered by publish/export and explicit source-version change, with idempotent results and observable reason codes. Fred is not involved.
- This step owns persistence, service, and API-read boundaries needed by later composition, not report editing UI, exports, or repair UX.
