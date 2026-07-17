# Validation Plan

## Acceptance Checks

- Confirm this deliverable is present, testable where applicable, and bounded to the step: The narrowest typed slice for Citation Validation and Provenance Graph that is callable by the next step without broadening scope.
- Confirm this deliverable is present, testable where applicable, and bounded to the step: update typed domain modules for `Provenance Graph` in `packages/domain/src/provenance-graph.ts`.
- Confirm this deliverable is present, testable where applicable, and bounded to the step: Repository boundaries in `packages/persistence/src/repositories/provenance-graph.ts` that translate between storage records and typed domain objects.
- The step leaves the next dependent step with a stable typed boundary, not a placeholder or undocumented assumption.

## Planned Verification

- Planned command once these packages exist: `bun test packages/domain packages/persistence packages/research-engine` plus the nearest package-level `bun run typecheck`.

## Edge Cases

- Partial progress, retries, or restarts should leave this step in a typed, inspectable state rather than a silent half-success.
- Unsupported formats, stale chunk references, and citation-open failures should surface explicitly instead of degrading to uncited answers.

## Regression Expectations

- This step should remain a clean successor to [[02_Phases/Phase_08_citation_backed_reports_and_durable_findings/Steps/Step_01_define-findings-reports-citation-states-and-lifecycle|STEP-08-01 Define Findings Reports Citation States and Lifecycle]] rather than reworking already-planned scope upstream.
- Do not let export/share flows erase auditability, version drift detection, or evidence inspection.
- Keep report and notebook persistence compatible with existing research threads and saved findings.
- Make sure later release hardening can audit citation state and provenance graphs without reverse engineering them.

## Security / Observability / Evaluation Focus

- Preserve access controls and source snapshot handling when packaging reports for export or sharing.
- Keep citation validation explicit so stale or broken links surface before publication.
- Add drift and audit scenarios to evaluation rather than relying only on manual review.
- Evaluation should verify provenance opening paths, contradiction reporting, and prompt-injection resistance for the evidence types touched here.

## Related Notes

- Step: [[02_Phases/Phase_08_citation_backed_reports_and_durable_findings/Steps/Step_02_implement-citation-validation-and-provenance-graph|STEP-08-02 Implement Citation Validation and Provenance Graph]]
- Phase: [[02_Phases/Phase_08_citation_backed_reports_and_durable_findings/Phase|Phase 08 citation backed reports and durable findings]]
