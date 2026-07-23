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

- Notes indexed: 31
- Status summary: confirmed (1), fixed (17), resolved (13)

| Id | Title | Status | Severity | Reported | Fixed | Linear |
| --- | --- | --- | --- | --- | --- | --- |
| BUG-0013 | [v1 UI lacks core research workflows](../03_Bugs/BUG-0013_v1-ui-lacks-core-research-workflows.md) | confirmed | sev-1 | 2026-07-21 | - | - |
| BUG-0019 | [Merged PR 17 Review Findings Remain Unresolved](../03_Bugs/BUG-0019_merged-pr-17-review-findings-remain-unresolved.md) | resolved | sev-2 | 2026-07-22 | 2026-07-23 | - |
| BUG-0020 | [Completed Step Snapshots Contradict Canonical Status Across Vault](../03_Bugs/BUG-0020_completed-step-snapshots-contradict-canonical-status-across-vault.md) | resolved | sev-2 | 2026-07-22 | 2026-07-23 | - |
| BUG-0021 | [Phase 07 Hybrid Evaluation Artifact Fails Its Canonical Evidence Check](../03_Bugs/BUG-0021_phase-07-hybrid-evaluation-artifact-fails-its-canonical-evidence-check.md) | resolved | sev-3 | 2026-07-22 | 2026-07-22 | - |
| BUG-0022 | [V1 Performance Resilience Artifact Is Stale After Canonical Evidence Updates](../03_Bugs/BUG-0022_v1-performance-resilience-artifact-is-stale-after-canonical-evidence-updates.md) | resolved | sev-3 | 2026-07-22 | 2026-07-23 | - |
| BUG-0023 | [Phase 08 Report Fidelity Artifact Is Stale After Canonical Engine Identity Updates](../03_Bugs/BUG-0023_phase-08-report-fidelity-artifact-is-stale-after-canonical-engine-identity-updates.md) | resolved | sev-3 | 2026-07-22 | 2026-07-22 | - |
| BUG-0024 | [Source Text Reindex Heartbeat Failure Test Asserts Redacted Persistence Detail](../03_Bugs/BUG-0024_source-text-reindex-heartbeat-failure-test-asserts-redacted-persistence-detail.md) | resolved | sev-3 | 2026-07-22 | 2026-07-22 | - |
| BUG-0025 | [Ingestion Heartbeat Failure Test Asserts Redacted Persistence Detail](../03_Bugs/BUG-0025_ingestion-heartbeat-failure-test-asserts-redacted-persistence-detail.md) | resolved | sev-3 | 2026-07-22 | 2026-07-22 | - |
| BUG-0026 | [Recursive Analysis Route Tests Assert Redacted Persistence Details](../03_Bugs/BUG-0026_recursive-analysis-route-tests-assert-redacted-persistence-details.md) | resolved | sev-3 | 2026-07-22 | 2026-07-22 | - |
| BUG-0027 | [E2E App Server Helper Adopts Stale Port Listeners and Leaves Orphans](../03_Bugs/BUG-0027_e2e-app-server-helper-adopts-stale-port-listeners-and-leaves-orphans.md) | resolved | sev-3 | 2026-07-22 | 2026-07-22 | - |
| BUG-0028 | [Local Docker Daemon Is Unresponsive for Required Data-Engine Integration Validation](../03_Bugs/BUG-0028_local-docker-daemon-is-unresponsive-for-required-data-engine-integration-validation.md) | resolved | sev-3 | 2026-07-22 | 2026-07-22 | - |
| BUG-0029 | [Stack-up operation can validate a stale data-engine image after sidecar source changes](../03_Bugs/BUG-0029_stack-up-operation-can-validate-a-stale-data-engine-image-after-sidecar-source-changes.md) | resolved | sev-3 | 2026-07-22 | 2026-07-22 | - |
| BUG-0030 | [Mixed-case reserved sidecar lineage field names bypass namespace protection](../03_Bugs/BUG-0030_mixed-case-reserved-sidecar-lineage-field-names-bypass-namespace-protection.md) | resolved | sev-3 | 2026-07-22 | 2026-07-22 | - |
| BUG-0031 | [Database-independent production operations require a valid database URL](../03_Bugs/BUG-0031_database-independent-production-operations-require-a-valid-database-url.md) | resolved | sev-3 | 2026-07-22 | 2026-07-22 | - |
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
