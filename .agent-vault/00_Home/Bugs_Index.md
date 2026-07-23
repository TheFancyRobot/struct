---
note_type: home_index
template_version: 1
contract_version: 1
title: Bugs Index
status: active
created: "YYYY-MM-DD"
updated: "YYYY-MM-DD"
tags:
  - agent-vault
  - home
  - index
  - bugs
---

# Bugs Index

Use this note as the manual table of contents for bug records in \`03_Bugs/\`.

## Triage Rules

- Create one note per bug.
- Use a stable id such as \`BUG-0001\`.
- Link relevant phase, decision, and session notes.
- Record root cause and verification.

## Status Buckets

<!-- AGENT-START:bugs-index -->
_Last rebuilt: 2026-07-23._

- Notes indexed: 23
- Status summary: confirmed (1), fixed (22)

| Id | Title | Status | Severity | Reported | Fixed | Linear |
| --- | --- | --- | --- | --- | --- | --- |
| BUG-0013 | [v1 UI lacks core research workflows](../03_Bugs/BUG-0013_v1-ui-lacks-core-research-workflows.md) | fixed | sev-1 | 2026-07-21 | 2026-07-23 | - |
| BUG-0033 | [E2E project lifecycle cache test asserts a nonexistent level-two project heading](../03_Bugs/BUG-0033_e2e-project-lifecycle-cache-test-asserts-a-nonexistent-level-two-project-heading.md) | fixed | sev-3 | 2026-07-23 | 2026-07-23 | - |
| BUG-0034 | [Recursive analysis responsive E2E emits unhandled 500 responses](../03_Bugs/BUG-0034_recursive-analysis-responsive-e2e-emits-unhandled-500-responses.md) | fixed | sev-3 | 2026-07-23 | 2026-07-23 | - |
| BUG-0035 | [V1 browser journey gate stubs every API route instead of using the real stack](../03_Bugs/BUG-0035_v1-browser-journey-gate-stubs-every-api-route-instead-of-using-the-real-stack.md) | confirmed | sev-3 | 2026-07-23 | - | - |
| BUG-0036 | [Automated code review capacity is rate-limited for PR #72](../03_Bugs/BUG-0036_automated-code-review-capacity-is-rate-limited-for-pr-72.md) | fixed | sev-3 | 2026-07-23 | 2026-07-23 | - |
| BUG-0032 | [E2E build artifacts break canonical lint gate](../03_Bugs/BUG-0032_e2e-build-artifacts-break-canonical-lint-gate.md) | fixed | sev-3 | 2026-07-22 | 2026-07-22 | - |
| BUG-0012 | [Frontend loads DaisyUI but bypasses its component framework](../03_Bugs/BUG-0012_frontend-loads-daisyui-but-bypasses-its-component-framework.md) | fixed | sev-3 | 2026-07-21 | 2026-07-21 | - |
| BUG-0014 | [Documentation roadmap links point to removed phase paths](../03_Bugs/BUG-0014_documentation-roadmap-links-point-to-removed-phase-paths.md) | fixed | sev-3 | 2026-07-21 | 2026-07-21 | - |
| BUG-0015 | [Citation navigation bypasses configured web base path](../03_Bugs/BUG-0015_citation-navigation-bypasses-configured-web-base-path.md) | fixed | sev-3 | 2026-07-21 | 2026-07-21 | - |
| BUG-0016 | [Base-path citation regression test is not isolated in the full test suite](../03_Bugs/BUG-0016_base-path-citation-regression-test-is-not-isolated-in-the-full-test-suite.md) | fixed | sev-3 | 2026-07-21 | 2026-07-21 | - |
| BUG-0017 | [Staged planning documents fail whitespace validation](../03_Bugs/BUG-0017_staged-planning-documents-fail-whitespace-validation.md) | fixed | sev-3 | 2026-07-21 | 2026-07-21 | - |
| BUG-0018 | [Vite proxy regression test does not typecheck](../03_Bugs/BUG-0018_vite-proxy-regression-test-does-not-typecheck.md) | fixed | sev-3 | 2026-07-21 | 2026-07-21 | - |
| BUG-0011 | [STEP-06-01 post-merge contract review findings](../03_Bugs/BUG-0011_step-06-01-post-merge-contract-review-findings.md) | fixed | sev-3 | 2026-07-20 | 2026-07-20 | - |
| BUG-0001 | [Research completion rejects serialized PostgreSQL JSONB payloads](../03_Bugs/BUG-0001_research-completion-rejects-serialized-postgresql-jsonb-payloads.md) | fixed | sev-3 | 2026-07-19 | 2026-07-19 | - |
| BUG-0002 | [SourceVersion ingestion attempt accepts forged aggregate scope](../03_Bugs/BUG-0002_sourceversion-ingestion-attempt-accepts-forged-aggregate-scope.md) | fixed | sev-3 | 2026-07-19 | 2026-07-19 | - |
| BUG-0003 | [Source registration persists unauthorized mismatched aggregate scope](../03_Bugs/BUG-0003_source-registration-persists-unauthorized-mismatched-aggregate-scope.md) | fixed | sev-3 | 2026-07-19 | 2026-07-19 | - |
| BUG-0004 | [Source text reindex lacks continuous lease renewal and database clock recovery](../03_Bugs/BUG-0004_source-text-reindex-lacks-continuous-lease-renewal-and-database-clock-recovery.md) | fixed | sev-3 | 2026-07-19 | 2026-07-19 | - |
| BUG-0005 | [Canonical DuckDB runtime documentation contradicts Bun only host boundary](../03_Bugs/BUG-0005_canonical-duckdb-runtime-documentation-contradicts-bun-only-host-boundary.md) | fixed | sev-3 | 2026-07-19 | 2026-07-19 | - |
| BUG-0006 | [Job transitions persist unvalidated cross-domain journal payloads](../03_Bugs/BUG-0006_job-transitions-persist-unvalidated-cross-domain-journal-payloads.md) | fixed | sev-3 | 2026-07-19 | 2026-07-19 | - |
| BUG-0007 | [Event journal cursors can commit out of replay order](../03_Bugs/BUG-0007_event-journal-cursors-can-commit-out-of-replay-order.md) | fixed | sev-3 | 2026-07-19 | 2026-07-19 | - |
| BUG-0008 | [Generic EventJournal append bypasses typed transition contracts](../03_Bugs/BUG-0008_generic-eventjournal-append-bypasses-typed-transition-contracts.md) | fixed | sev-3 | 2026-07-19 | 2026-07-19 | - |
| BUG-0009 | [Source registration persists extra sensitive payload fields](../03_Bugs/BUG-0009_source-registration-persists-extra-sensitive-payload-fields.md) | fixed | sev-3 | 2026-07-19 | 2026-07-19 | - |
| BUG-0010 | [Solid theme toggle does not apply the selected theme](../03_Bugs/BUG-0010_solid-theme-toggle-does-not-apply-the-selected-theme.md) | fixed | sev-3 | 2026-07-19 | 2026-07-19 | - |
<!-- AGENT-END:bugs-index -->

## Useful Links

- Template: [[07_Templates/Bug_Template|Bug Template]]
- Severity reference: [[06_Shared_Knowledge/Bug_Taxonomy|Bug Taxonomy]]
- Current work: [[00_Home/Active_Context|Active Context]]
