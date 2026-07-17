# Validation Plan

## Acceptance Checks

- Confirm this deliverable is present, testable where applicable, and bounded to the step: An evidence-backed validation pass for Authentication Workspace Isolation and Secrets, with explicit pass/fail criteria and durable output artifacts.
- Confirm this deliverable is present, testable where applicable, and bounded to the step: Only the minimal API surface in `apps/api/src/auth/session.ts`, `apps/api/src/auth/authorization.ts` needed to exercise this step end to end.
- Confirm this deliverable is present, testable where applicable, and bounded to the step: The durable contract or operator guidance in `docs/security.md` rather than burying it in session-only notes.
- The output includes a clear pass/fail signal, recorded defects or blockers, and the next action for anything intentionally left unresolved.

## Planned Verification

- Planned command once these packages exist: `bun test packages/persistence` plus the nearest package-level `bun run typecheck`.
- Planned app/integration coverage once the app surfaces exist: `bun test apps/api` for the API/worker/web path touched here.
- Review the paired doc/ADR/runbook output to confirm it matches the code-facing contract and names operator/developer prerequisites explicitly.

## Edge Cases

- Partial progress, retries, or restarts should leave this step in a typed, inspectable state rather than a silent half-success.
- Authorization failures, secret exposure, and audit-log gaps should be treated as first-class failures, not documentation nits.

## Regression Expectations

- This step should remain a clean successor to [[02_Phases/Phase_08_citation_backed_reports_and_durable_findings/Steps/Step_06_evaluate-report-fidelity-version-drift-and-auditability|STEP-08-06 Evaluate Report Fidelity Version Drift and Auditability]] rather than reworking already-planned scope upstream.
- Do not trade away provenance, bounded workflows, or exact-computation guarantees during productionization.
- Keep deployment and rollback procedures consistent with the repository layout and persistence model already established.
- Avoid last-minute feature creep while closing security, performance, and documentation gaps.

## Security / Observability / Evaluation Focus

- Prioritize workspace isolation, secret handling, auditability, and safe failure reporting in every hardening slice.
- Make backup, migration, and incident workflows rehearseable before the release checklist is considered complete.
- Use the evaluation corpus and adversarial suites as release gates, not optional confidence boosters.
- Audit all newly exposed boundaries for least privilege, secret hygiene, and safe error sanitization before widening rollout.

## Related Notes

- Step: [[02_Phases/Phase_09_v1_production_hardening_and_release/Steps/Step_01_harden-authentication-workspace-isolation-and-secrets|STEP-09-01 Harden Authentication Workspace Isolation and Secrets]]
- Phase: [[02_Phases/Phase_09_v1_production_hardening_and_release/Phase|Phase 09 v1 production hardening and release]]
