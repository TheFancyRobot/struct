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
_Last rebuilt: 2026-07-20._

- Notes indexed: 11
- Status summary: fixed (11)

| Id | Title | Status | Severity | Reported | Fixed | Linear |
| --- | --- | --- | --- | --- | --- | --- |
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
