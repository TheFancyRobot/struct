# Validation Plan

## Acceptance Checks

- Confirm this deliverable is present, testable where applicable, and bounded to the step: The narrowest typed slice for Report UX Citation Navigation and Repair that is callable by the next step without broadening scope.
- Confirm this deliverable is present, testable where applicable, and bounded to the step: Only the minimal API surface in `apps/api/src/routes/citations.ts` needed to exercise this step end to end.
- Confirm this deliverable is present, testable where applicable, and bounded to the step: `apps/web/src/components/ReportEditor.tsx`, `apps/web/src/components/ReportCitationPanel.tsx`, `apps/web/src/components/CitationRepairDialog.tsx` to expose only the UI states required to inspect this step’s output and failures.
- The step leaves the next dependent step with a stable typed boundary, not a placeholder or undocumented assumption.

## Planned Verification

- Run the nearest repo-wide or package-targeted `bun run typecheck` command once the touched packages and apps exist.
- Planned app/integration coverage once the app surfaces exist: `bun test apps/api apps/web` for the API/worker/web path touched here.
- Add a browser/e2e or component-level check that exercises the visible UI state introduced by this step and one failure presentation path.

## Edge Cases

- Partial progress, retries, or restarts should leave this step in a typed, inspectable state rather than a silent half-success.
- Unsupported formats, stale chunk references, and citation-open failures should surface explicitly instead of degrading to uncited answers.
- Cancellation, duplicate actions, replay after restart, and stale source-version assumptions should produce deterministic terminal states.

## Regression Expectations

- This step should remain a clean successor to [[02_Phases/Phase_08_citation_backed_reports_and_durable_findings/Steps/Step_04_build-export-and-share-bundles-with-source-snapshots|STEP-08-04 Build Export and Share Bundles with Source Snapshots]] rather than reworking already-planned scope upstream.
- Do not let export/share flows erase auditability, version drift detection, or evidence inspection.
- Keep report and notebook persistence compatible with existing research threads and saved findings.
- Make sure later release hardening can audit citation state and provenance graphs without reverse engineering them.

## Security / Observability / Evaluation Focus

- Preserve access controls and source snapshot handling when packaging reports for export or sharing.
- Keep citation validation explicit so stale or broken links surface before publication.
- Add drift and audit scenarios to evaluation rather than relying only on manual review.
- Evaluation should verify provenance opening paths, contradiction reporting, and prompt-injection resistance for the evidence types touched here.

## Related Notes

- Step: [[02_Phases/Phase_08_citation_backed_reports_and_durable_findings/Steps/Step_05_add-report-ux-citation-navigation-and-repair|STEP-08-05 Add Report UX Citation Navigation and Repair]]
- Phase: [[02_Phases/Phase_08_citation_backed_reports_and_durable_findings/Phase|Phase 08 citation backed reports and durable findings]]

## Refined Zero-Defect Gate — 2026-07-20

- Component and Playwright tests cover create/open/edit/save/reload, finding-to-report composition, section reorder, citation opening for every evidence kind, invalid-state filtering, repair choices, revision history, stale-write conflict, publish blocking, export success/failure, and keyboard/back navigation.
- Responsive Playwright coverage runs at 1440x900, 1024x768, and 390x844 in light and dark modes. Inspect screenshots for overflow, clipped controls, unreadable evidence, hidden status, focus loss, contrast, and density; keep six reviewed screenshots as durable evidence.
- Accessibility checks cover semantic headings/landmarks, labels, focus order/visibility, dialog focus trapping and escape, live error/status announcement, reduced motion, zoom, keyboard-only repair, and contrast.
- Tests prove no repair action mutates prior revisions or silently retargets citations, and that every publish/export blocker shown in the UI matches the API’s typed validation result.
- Run focused Solid component/API tests and the full Playwright suite, then repository typecheck, lint, import/boundary checks, full tests, production build, docs lint, secrets scan, and Vault doctor.
