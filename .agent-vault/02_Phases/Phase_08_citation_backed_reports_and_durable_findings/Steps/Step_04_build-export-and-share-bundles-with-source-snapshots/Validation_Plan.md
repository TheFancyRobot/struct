# Validation Plan

## Acceptance Checks

- Confirm this deliverable is present, testable where applicable, and bounded to the step: The narrowest typed slice for Export and Share Bundles with Source Snapshots that is callable by the next step without broadening scope.
- Confirm this deliverable is present, testable where applicable, and bounded to the step: update typed domain modules for `Export Bundle` in `packages/domain/src/export-bundle.ts`.
- Confirm this deliverable is present, testable where applicable, and bounded to the step: Only the minimal API surface in `apps/api/src/routes/report-export.ts` needed to exercise this step end to end.
- The step leaves the next dependent step with a stable typed boundary, not a placeholder or undocumented assumption.

## Planned Verification

- Planned command once these packages exist: `bun test packages/domain packages/source-storage` plus the nearest package-level `bun run typecheck`.
- Planned app/integration coverage once the app surfaces exist: `bun test apps/api apps/worker` for the API/worker/web path touched here.

## Edge Cases

- Partial progress, retries, or restarts should leave this step in a typed, inspectable state rather than a silent half-success.

## Regression Expectations

- This step should remain a clean successor to [[02_Phases/Phase_08_citation_backed_reports_and_durable_findings/Steps/Step_03_build-durable-findings-notebooks-and-report-composition|STEP-08-03 Build Durable Findings Notebooks and Report Composition]] rather than reworking already-planned scope upstream.
- Do not let export/share flows erase auditability, version drift detection, or evidence inspection.
- Keep report and notebook persistence compatible with existing research threads and saved findings.
- Make sure later release hardening can audit citation state and provenance graphs without reverse engineering them.

## Security / Observability / Evaluation Focus

- Preserve access controls and source snapshot handling when packaging reports for export or sharing.
- Keep citation validation explicit so stale or broken links surface before publication.
- Add drift and audit scenarios to evaluation rather than relying only on manual review.

## Related Notes

- Step: [[02_Phases/Phase_08_citation_backed_reports_and_durable_findings/Steps/Step_04_build-export-and-share-bundles-with-source-snapshots|STEP-08-04 Build Export and Share Bundles with Source Snapshots]]
- Phase: [[02_Phases/Phase_08_citation_backed_reports_and_durable_findings/Phase|Phase 08 citation backed reports and durable findings]]

## Refined Zero-Defect Gate — 2026-07-20

- Golden tests prove byte-identical canonical manifests/bundles for identical inputs, stable ordering across insertion order, and different hashes for any report revision, evidence, validation, authorization/redaction, or producer-version change.
- Round-trip verification rebuilds the report/evidence graph from the bundle and resolves every included locator/hash without network access or mutable-current-version lookup. Independently tampered manifest fields, files, paths, hashes, counts, and trailing bytes fail closed.
- Security tests cover cross-workspace denial, revoked visibility, path traversal, symlink escape, secret/absolute-path leakage, unauthorized source inclusion, redaction, decompression/file-count/size bounds, and partial artifact cleanup.
- Retry after interruption is idempotent and atomic; duplicate requests do not publish divergent bundles. Non-valid required citations and unsupported claims block export with typed reasons.
- Run focused domain/source-storage/API/worker tests and typechecks, integration round trips, then repository typecheck, lint, import/boundary checks, full tests, docs lint, secrets scan, and Vault doctor.
