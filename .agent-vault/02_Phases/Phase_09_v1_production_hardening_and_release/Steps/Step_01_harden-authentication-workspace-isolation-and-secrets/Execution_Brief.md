# Execution Brief

## Exact Outcome

- Produce the concrete contracts, artifacts, and bounded implementation/design surfaces for Authentication Workspace Isolation and Secrets that this step is responsible for before any broader follow-on work begins.

## Prerequisites

- Re-read [[02_Phases/Phase_09_v1_production_hardening_and_release/Phase|Phase 09 v1 production hardening and release]] and confirm the step still matches the current roadmap sequence.
- Confirm the handoff from [[02_Phases/Phase_08_citation_backed_reports_and_durable_findings/Steps/Step_06_evaluate-report-fidelity-version-drift-and-auditability|STEP-08-06 Evaluate Report Fidelity Version Drift and Auditability]] before widening scope.
- Keep deterministic work in typed Effect services, repositories, and tools; reserve Fred for agentic orchestration only.
- Treat the listed files as planned starting points; create only the smallest set needed to land the slice.

## Planned Starting Files

- These paths may not exist yet; use them as the first bounded implementation or design surface.
- `apps/api/src/auth/session.ts`
- `apps/api/src/auth/authorization.ts`
- `packages/persistence/src/workspace-scope.ts`
- `docs/security.md`
- `.env.example`

## Required Reading

- [[02_Phases/Phase_09_v1_production_hardening_and_release/Phase|Phase 09 v1 production hardening and release]]
- [[01_Architecture/System_Overview|System Overview]]
- [[01_Architecture/Code_Map|Code Map]]
- [[01_Architecture/Agent_Workflow|Agent Workflow]]
- [[02_Phases/Phase_08_citation_backed_reports_and_durable_findings/Steps/Step_06_evaluate-report-fidelity-version-drift-and-auditability|STEP-08-06 Evaluate Report Fidelity Version Drift and Auditability]]
- `docs/product-brief.md` sections 16, 18-25, 27, and 29-31.

## Concrete Deliverables

- Produce an evidence-backed validation pass for Authentication Workspace Isolation and Secrets, with explicit pass/fail criteria and durable output artifacts.
- Expose only the minimal API surface in `apps/api/src/auth/session.ts`, `apps/api/src/auth/authorization.ts` needed to exercise this step end to end.
- Capture the durable contract or operator guidance in `docs/security.md` rather than burying it in session-only notes.

## Smallest Bounded Checklist

- First, produce an evidence-backed validation pass for Authentication Workspace Isolation and Secrets, with explicit pass/fail criteria and durable output artifacts.
- Then, expose only the minimal API surface in `apps/api/src/auth/session.ts`, `apps/api/src/auth/authorization.ts` needed to exercise this step end to end.
- Next, capture the durable contract or operator guidance in `docs/security.md` rather than burying it in session-only notes.
- Finish by leaving one observable typed path—test, route, worker flow, or UI state—that proves the slice is ready for the next dependent step.

## Constraints and Non-Goals

- Treat hardening as evidence-producing work: every claim should be backed by tests, docs, or operational artifacts.
- Protect tenant isolation, secrets, migrations, backups, and rollback paths before optimizing for convenience.
- Do not ship v1 until evaluation, accessibility, and operational runbooks all tell a coherent story.

## Related Notes

- Step: [[02_Phases/Phase_09_v1_production_hardening_and_release/Steps/Step_01_harden-authentication-workspace-isolation-and-secrets|STEP-09-01 Harden Authentication Workspace Isolation and Secrets]]
- Phase: [[02_Phases/Phase_09_v1_production_hardening_and_release/Phase|Phase 09 v1 production hardening and release]]
