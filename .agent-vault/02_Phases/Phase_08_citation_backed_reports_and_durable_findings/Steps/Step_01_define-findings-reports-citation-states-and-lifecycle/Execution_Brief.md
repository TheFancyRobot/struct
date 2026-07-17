# Execution Brief

## Exact Outcome

- Produce the concrete contracts, artifacts, and bounded implementation/design surfaces for Findings Reports Citation States and Lifecycle that this step is responsible for before any broader follow-on work begins.

## Prerequisites

- Re-read [[02_Phases/Phase_08_citation_backed_reports_and_durable_findings/Phase|Phase 08 citation backed reports and durable findings]] and confirm the step still matches the current roadmap sequence.
- Confirm the handoff from [[02_Phases/Phase_07_hybrid_cross_source_research/Steps/Step_06_evaluate-hybrid-correctness-provenance-and-security|STEP-07-06 Evaluate Hybrid Correctness Provenance and Security]] before widening scope.
- Keep deterministic work in typed Effect services, repositories, and tools; reserve Fred for agentic orchestration only.
- Treat the listed files as planned starting points; create only the smallest set needed to land the slice.

## Planned Starting Files

- These paths may not exist yet; use them as the first bounded implementation or design surface.
- `packages/domain/src/finding.ts`
- `packages/domain/src/report.ts`
- `packages/domain/src/citation-state.ts`
- `docs/report-lifecycle.md`

## Required Reading

- [[02_Phases/Phase_08_citation_backed_reports_and_durable_findings/Phase|Phase 08 citation backed reports and durable findings]]
- [[01_Architecture/Domain_Model|Domain Model]]
- [[01_Architecture/Agent_Workflow|Agent Workflow]]
- [[02_Phases/Phase_07_hybrid_cross_source_research/Steps/Step_06_evaluate-hybrid-correctness-provenance-and-security|STEP-07-06 Evaluate Hybrid Correctness Provenance and Security]]
- `docs/product-brief.md` sections 9, 17-24, 26-27, and 29-31.

## Concrete Deliverables

- Define the concrete contract for Findings Reports Citation States and Lifecycle in the first planned domain, persistence, or documentation files so downstream implementation does not need to rediscover the boundary.
- Define or update typed domain modules for `Finding`, `ResearchReport`, `CitationState` in `packages/domain/src/finding.ts`, `packages/domain/src/report.ts`, `packages/domain/src/citation-state.ts`.
- Capture the durable contract or operator guidance in `docs/report-lifecycle.md` rather than burying it in session-only notes.

## Smallest Bounded Checklist

- First, define the concrete contract for Findings Reports Citation States and Lifecycle in the first planned domain, persistence, or documentation files so downstream implementation does not need to rediscover the boundary.
- Then, define or update typed domain modules for `Finding`, `ResearchReport`, `CitationState` in `packages/domain/src/finding.ts`, `packages/domain/src/report.ts`, `packages/domain/src/citation-state.ts`.
- Next, capture the durable contract or operator guidance in `docs/report-lifecycle.md` rather than burying it in session-only notes.
- Finish by recording the chosen contract, recommendation, or runbook in the planned docs/ADR artifacts before expanding scope.

## Constraints and Non-Goals

- Saved findings, reports, export bundles, and citation state must all remain anchored to immutable source versions.
- Editing UX should preserve or explicitly repair citation links rather than silently dropping provenance.
- Report regeneration must stay bounded and section-oriented instead of rerunning unrelated work.

## Related Notes

- Step: [[02_Phases/Phase_08_citation_backed_reports_and_durable_findings/Steps/Step_01_define-findings-reports-citation-states-and-lifecycle|STEP-08-01 Define Findings Reports Citation States and Lifecycle]]
- Phase: [[02_Phases/Phase_08_citation_backed_reports_and_durable_findings/Phase|Phase 08 citation backed reports and durable findings]]
