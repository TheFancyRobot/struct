# Implementation Notes

- Capture durable findings learned during execution. Prefer short bullets with file paths, commands, and observed behavior.

- 2026-07-20 - Converged the minimal `Finding` and `Report` schemas into one canonical durable contract across `packages/domain/src/finding.ts`, `packages/domain/src/report.ts`, and `packages/domain/src/citation-state.ts`; existing cross-source, dataset, document, recursive-finding, citation, evidence, and branded-ID types are reused rather than duplicated.
- `Claim` owns one immutable support bundle, canonical claim signature, append-only generated/user revisions, and one embedded `CitationLifecycle`. Supporting evidence must be support-stance, signature-matched, unique, and within the enclosing finding/report source-version scope.
- Legal typed transitions, optimistic revisions, idempotency conflicts, dangling/cyclic supersession rejection, fail-closed publication, and section-only regeneration are executable Effect functions with `Schema.TaggedError` failures.
- Added the direct greenfield `0015_report_lifecycle` schema. It losslessly persists support mode/reason, complete citation lifecycle concurrency state, append-only revisions, immutable evidence, and scoped finding/report/section links. No compatibility or data-preservation path was added.
- `docs/report-lifecycle.md` is the durable developer/operator contract.

## Related Notes

- Step: [[02_Phases/Phase_08_citation_backed_reports_and_durable_findings/Steps/Step_01_define-findings-reports-citation-states-and-lifecycle|STEP-08-01 Define Findings Reports Citation States and Lifecycle]]
- Phase: [[02_Phases/Phase_08_citation_backed_reports_and_durable_findings/Phase|Phase 08 citation backed reports and durable findings]]
