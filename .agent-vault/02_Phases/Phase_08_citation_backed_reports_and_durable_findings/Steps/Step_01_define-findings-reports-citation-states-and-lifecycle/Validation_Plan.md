# Validation Plan

## Acceptance Checks

- Confirm this deliverable is present, testable where applicable, and bounded to the step: The concrete contract for Findings Reports Citation States and Lifecycle in the first planned domain, persistence, or documentation files so downstream implementation does not need to rediscover the boundary.
- Confirm this deliverable is present, testable where applicable, and bounded to the step: update typed domain modules for `Finding`, `ResearchReport`, `CitationState` in `packages/domain/src/finding.ts`, `packages/domain/src/report.ts`, `packages/domain/src/citation-state.ts`.
- Confirm this deliverable is present, testable where applicable, and bounded to the step: The durable contract or operator guidance in `docs/report-lifecycle.md` rather than burying it in session-only notes.
- The step leaves the next dependent step with a stable typed boundary, not a placeholder or undocumented assumption.

## Planned Verification

- Planned command once these packages exist: `bun test packages/domain` plus the nearest package-level `bun run typecheck`.
- Review the paired doc/ADR/runbook output to confirm it matches the code-facing contract and names operator/developer prerequisites explicitly.

## Edge Cases

- Partial progress, retries, or restarts should leave this step in a typed, inspectable state rather than a silent half-success.
- Version drift, missing required fields, or ambiguous identity rules should be called out in the contract instead of deferred to implementation guesswork.
- Unsupported formats, stale chunk references, and citation-open failures should surface explicitly instead of degrading to uncited answers.
- Cancellation, duplicate actions, replay after restart, and stale source-version assumptions should produce deterministic terminal states.

## Regression Expectations

- This step should remain a clean successor to [[02_Phases/Phase_07_hybrid_cross_source_research/Steps/Step_06_evaluate-hybrid-correctness-provenance-and-security|STEP-07-06 Evaluate Hybrid Correctness Provenance and Security]] rather than reworking already-planned scope upstream.
- Do not let export/share flows erase auditability, version drift detection, or evidence inspection.
- Keep report and notebook persistence compatible with existing research threads and saved findings.
- Make sure later release hardening can audit citation state and provenance graphs without reverse engineering them.

## Security / Observability / Evaluation Focus

- Preserve access controls and source snapshot handling when packaging reports for export or sharing.
- Keep citation validation explicit so stale or broken links surface before publication.
- Add drift and audit scenarios to evaluation rather than relying only on manual review.
- Evaluation should verify provenance opening paths, contradiction reporting, and prompt-injection resistance for the evidence types touched here.

## Related Notes

- Step: [[02_Phases/Phase_08_citation_backed_reports_and_durable_findings/Steps/Step_01_define-findings-reports-citation-states-and-lifecycle|STEP-08-01 Define Findings Reports Citation States and Lifecycle]]
- Phase: [[02_Phases/Phase_08_citation_backed_reports_and_durable_findings/Phase|Phase 08 citation backed reports and durable findings]]

## Refined Zero-Defect Gate — 2026-07-20

- Schema tests cover valid construction and rejection of missing project/run/source-version identity, duplicate or dangling claim links, mutable citation targets, illegal lifecycle transitions, authorship conflation, stale revision writes, unsupported publish, and supersession cycles.
- Contract tests prove document spans, dataset query/result snapshots, recursive evidence artifacts, and hybrid dual-source claims can be represented without lossy string-only locators.
- A publishability decision is deterministic, fail-closed, and derived from every claim/citation state; user edits preserve prior revisions and evidence identity.
- The lifecycle doc and code use the same state names and invariants. No placeholder types, parallel legacy schemas, compatibility adapters, or untested migration-preservation scripts remain.
- Focused verification: domain and persistence tests/typechecks plus migration tests where the schema is touched. Before completion also run repository typecheck, lint, import/boundary checks, full test gate, docs lint, secrets scan, and Vault doctor.
