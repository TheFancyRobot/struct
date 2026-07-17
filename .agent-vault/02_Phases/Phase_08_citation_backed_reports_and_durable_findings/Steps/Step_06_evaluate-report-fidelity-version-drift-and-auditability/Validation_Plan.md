# Validation Plan

## Acceptance Checks

- Confirm this deliverable is present, testable where applicable, and bounded to the step: An evidence-backed validation pass for Report Fidelity Version Drift and Auditability, with explicit pass/fail criteria and durable output artifacts.
- Confirm this deliverable is present, testable where applicable, and bounded to the step: Only the minimal API surface in `apps/api/test/report-export.integration.test.ts` needed to exercise this step end to end.
- Confirm this deliverable is present, testable where applicable, and bounded to the step: Deterministic evaluation or benchmark artifacts in `packages/evaluation/src/report-fidelity.ts` so this step can be judged without hand-waving.
- The output includes a clear pass/fail signal, recorded defects or blockers, and the next action for anything intentionally left unresolved.

## Planned Verification

- Planned command once these packages exist: `bun test packages/evaluation` plus the nearest package-level `bun run typecheck`.
- Planned app/integration coverage once the app surfaces exist: `bun test apps/api` for the API/worker/web path touched here.
- Run the evaluation/benchmark fixture for this slice and store the corpus, seed, or hardware assumptions alongside the result.

## Edge Cases

- Partial progress, retries, or restarts should leave this step in a typed, inspectable state rather than a silent half-success.
- Cancellation, duplicate actions, replay after restart, and stale source-version assumptions should produce deterministic terminal states.
- Authorization failures, secret exposure, and audit-log gaps should be treated as first-class failures, not documentation nits.

## Regression Expectations

- This step should remain a clean successor to [[02_Phases/Phase_08_citation_backed_reports_and_durable_findings/Steps/Step_05_add-report-ux-citation-navigation-and-repair|STEP-08-05 Add Report UX Citation Navigation and Repair]] rather than reworking already-planned scope upstream.
- Do not let export/share flows erase auditability, version drift detection, or evidence inspection.
- Keep report and notebook persistence compatible with existing research threads and saved findings.
- Make sure later release hardening can audit citation state and provenance graphs without reverse engineering them.

## Security / Observability / Evaluation Focus

- Preserve access controls and source snapshot handling when packaging reports for export or sharing.
- Keep citation validation explicit so stale or broken links surface before publication.
- Add drift and audit scenarios to evaluation rather than relying only on manual review.
- Evaluation should verify provenance opening paths, contradiction reporting, and prompt-injection resistance for the evidence types touched here.

## Related Notes

- Step: [[02_Phases/Phase_08_citation_backed_reports_and_durable_findings/Steps/Step_06_evaluate-report-fidelity-version-drift-and-auditability|STEP-08-06 Evaluate Report Fidelity Version Drift and Auditability]]
- Phase: [[02_Phases/Phase_08_citation_backed_reports_and_durable_findings/Phase|Phase 08 citation backed reports and durable findings]]
