# Implementation Notes

- Capture durable findings learned during execution. Prefer short bullets with file paths, commands, and observed behavior.
- `packages/evaluation/src/report-fidelity.ts` evaluates 26 deterministic cases against shipped domain, evidence-normalization, citation-transition, export, and verification contracts.
- Root review remediation replaced self-reported citation policy expectations with real `prepareReportPublication` and `prepareReportExport` Effect outcomes for all eight citation states. The export probe keeps the report shell publishable to reach the citation guard and requires `citation-not-valid` plus the exact blocking claim identity for every non-publishable state.
- Pass signals are derived from observed contract behavior or explicit independent predicates; the canonical artifact contains no fabricated host timing.
- `runReportFidelityEvaluationWithinLimits` measures real wall-clock time with the Effect clock and enforces the 5-second ceiling with `Effect.timeout` outside the canonical semantic hash.
- The verifier parses with Effect Schema, validates one canonical trailing newline, recomputes the outer hash, reruns all semantic cases, and rejects independently rehashed tampering.
- `apps/api/test/report-export.integration.test.ts` proves exact-revision export, content-addressed storage reopen, verified download, safe response headers, and tenant-safe authorization denial.
- `docs/operations/report-audit.md` and `docs/benchmarks/report-fidelity.md` are the durable operator and benchmark contracts.

## Related Notes

- Step: [[02_Phases/Phase_08_citation_backed_reports_and_durable_findings/Steps/Step_06_evaluate-report-fidelity-version-drift-and-auditability|STEP-08-06 Evaluate Report Fidelity Version Drift and Auditability]]
- Phase: [[02_Phases/Phase_08_citation_backed_reports_and_durable_findings/Phase|Phase 08 citation backed reports and durable findings]]
