# Validation Plan

## Acceptance Checks

- Confirm this deliverable is present, testable where applicable, and bounded to the step: The narrowest typed slice for Durable Findings Notebooks and Report Composition that is callable by the next step without broadening scope.
- Confirm this deliverable is present, testable where applicable, and bounded to the step: Repository boundaries in `packages/persistence/src/repositories/reports.ts` that translate between storage records and typed domain objects.
- Confirm this deliverable is present, testable where applicable, and bounded to the step: The orchestration or synthesis rules in `packages/research-engine/src/compose-report.ts` without moving deterministic work out of services/tools.
- The step leaves the next dependent step with a stable typed boundary, not a placeholder or undocumented assumption.

## Planned Verification

- Planned command once these packages exist: `bun test packages/persistence packages/research-engine` plus the nearest package-level `bun run typecheck`.
- Planned app/integration coverage once the app surfaces exist: `bun test apps/api apps/web` for the API/worker/web path touched here.
- Add a browser/e2e or component-level check that exercises the visible UI state introduced by this step and one failure presentation path.

## Edge Cases

- Partial progress, retries, or restarts should leave this step in a typed, inspectable state rather than a silent half-success.
- Cancellation, duplicate actions, replay after restart, and stale source-version assumptions should produce deterministic terminal states.

## Regression Expectations

- This step should remain a clean successor to [[02_Phases/Phase_08_citation_backed_reports_and_durable_findings/Steps/Step_02_implement-citation-validation-and-provenance-graph|STEP-08-02 Implement Citation Validation and Provenance Graph]] rather than reworking already-planned scope upstream.
- Do not let export/share flows erase auditability, version drift detection, or evidence inspection.
- Keep report and notebook persistence compatible with existing research threads and saved findings.
- Make sure later release hardening can audit citation state and provenance graphs without reverse engineering them.

## Security / Observability / Evaluation Focus

- Preserve access controls and source snapshot handling when packaging reports for export or sharing.
- Keep citation validation explicit so stale or broken links surface before publication.
- Add drift and audit scenarios to evaluation rather than relying only on manual review.
- Evaluation should verify provenance opening paths, contradiction reporting, and prompt-injection resistance for the evidence types touched here.

## Related Notes

- Step: [[02_Phases/Phase_08_citation_backed_reports_and_durable_findings/Steps/Step_03_build-durable-findings-notebooks-and-report-composition|STEP-08-03 Build Durable Findings Notebooks and Report Composition]]
- Phase: [[02_Phases/Phase_08_citation_backed_reports_and_durable_findings/Phase|Phase 08 citation backed reports and durable findings]]

## Refined Zero-Defect Gate — 2026-07-20

- Integration tests cover save finding, idempotent duplicate save, create report, add/reorder/remove section, compose from mixed evidence, edit as a new revision, reload after restart, and project/workspace denial.
- Tests prove unsupported or non-valid required citations cannot publish, generated evidence is immutable, user edits retain authorship, optimistic concurrency rejects stale writes, and section regeneration leaves all unrelated revision hashes unchanged.
- API contracts fail with typed errors and never expose another workspace. If Fred is used, cancellation, timeout, replay, token/model-call budgets, and no-tool agent boundaries are verified; otherwise do not introduce Fred merely to satisfy the roadmap.
- Solid component/e2e coverage proves the full saved-finding-to-report path plus loading, empty, invalid-citation, and persistence failure states. Existing research and citation UI tests remain green.
- Run focused app/package tests and Playwright for the new visible path, then repository typecheck, lint, import/boundary checks, full tests, build, docs lint, secrets scan, and Vault doctor.
