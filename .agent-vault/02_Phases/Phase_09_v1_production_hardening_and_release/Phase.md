---
note_type: phase
template_version: 2
contract_version: 1
title: v1 Production Hardening and Release
phase_id: PHASE-09
status: in_progress
owner: Codex
created: '2026-07-17'
updated: '2026-07-20'
depends_on:
  - '[[02_Phases/Phase_02_document_research_and_hybrid_retrieval/Phase|PHASE-02 Document Research and Hybrid Retrieval]]'
  - '[[02_Phases/Phase_03_durable_directory_ingestion_and_source_refresh/Phase|PHASE-03 Durable Directory Ingestion and Source Refresh]]'
  - '[[02_Phases/Phase_04_structured_datasets_and_deterministic_sql/Phase|PHASE-04 Structured Datasets and Deterministic SQL]]'
  - '[[02_Phases/Phase_05_typed_research_planning_and_bounded_execution/Phase|PHASE-05 Typed Research Planning and Bounded Execution]]'
  - '[[02_Phases/Phase_06_recursive_corpus_analysis/Phase|PHASE-06 Recursive Corpus Analysis]]'
  - '[[02_Phases/Phase_07_hybrid_cross_source_research/Phase|PHASE-07 Hybrid Cross-Source Research]]'
  - '[[02_Phases/Phase_08_citation_backed_reports_and_durable_findings/Phase|PHASE-08 Citation-Backed Reports and Durable Findings]]'
related_architecture:
  - '[[01_Architecture/System_Overview|System Overview]]'
  - '[[01_Architecture/Domain_Model|Domain Model]]'
  - '[[01_Architecture/Integration_Map|Integration Map]]'
  - '[[01_Architecture/Agent_Workflow|Agent Workflow]]'
related_decisions:
  - '[[04_Decisions/DEC-0009_sandbox-filesystem-roots-and-allowlist-read-only-sql|DEC-0009 Sandbox Filesystem Roots and Allowlist Read-Only SQL]]'
  - '[[04_Decisions/DEC-0011_gate-releases-on-a-reproducible-25000-file-evaluation-corpus|DEC-0011 Gate Releases on a Reproducible 25000-File Evaluation Corpus]]'
related_bugs: []
tags:
  - agent-vault
  - phase
  - v1
---

# Phase 09 v1 Production Hardening and Release

Use this note as the canonical bounded milestone. Detailed execution belongs in linked step companion notes; architecture and durable choices belong in their linked notes.

## Objective

- Release a coherent production-quality v1 by hardening security, migrations, resilience, performance, operability, accessibility, documentation, and every release-gating evaluation class.
### 2026-07-20 authoritative refinement

- Produce a release-ready v1 candidate from the functional Phase 08 application, with security, recoverability, resilience, observability, evaluation, documentation, and accessibility proven by reproducible evidence.
- Complete all six steps and the zero-defect/review gates, then stop immediately before the actual v1.0 release action.

## Why This Phase Exists

- v1 is a product boundary, not a feature pile. All foundational slices must operate together under realistic load, failures, hostile inputs, upgrades, and support procedures.

## Scope

- Complete authentication, authorization, workspace isolation, secret management, dependency/supply-chain controls, and security review.
- Prove clean greenfield drop-recreate, backups, restore, rollback, artifact integrity, and dependency restart objectives.
- Capacity-test ingestion, retrieval, DuckDB, recursive workflows, SSE, persistence, and storage against documented budgets.
- Finish correlated telemetry, health/readiness, bounded alert specifications, incident runbooks, support diagnostics, and data-redaction policy.
- Run and remediate the full exact-computation, semantic-retrieval, recursive-analysis, hybrid-research, provenance, injection, and recovery campaign.
- Publish accurate user, operator, developer, security, recovery, and accessibility documentation plus an evidence-linked release checklist.
### 2026-07-20 authoritative refinement

- Execute exactly six sequential lanes: (1) authentication/isolation/secrets, (2) deployment plus greenfield drop-recreate/backup/rollback, (3) performance/resilience, (4) observability/runbooks, (5) full evaluation/remediation, and (6) documentation/accessibility/release checklist.
- Preserve the shipped stack: Bun is the sole host runtime; Docker Compose owns PostgreSQL and the authenticated no-egress data-engine sidecar; the package name is `workflows`.
- Treat the Phase 08 functional responsive report UI, the 26/26 canonical report evaluator, 754 unit tests, 112 PostgreSQL/data-engine integration tests, and isolated passing Playwright suites as the starting baseline—not work to recreate.

## Non-Goals

- Adding post-v1 connectors, collaboration, continuous monitoring, or advanced research modes to rescue a missed v1 requirement.
- Waiving security, provenance, exactness, recovery, or evaluation gates to meet a date.
- Shipping experimental spike code or unowned operational risk.
### 2026-07-20 authoritative refinement

- No legacy compatibility, data-preservation migration path, second host runtime, new queue/database/storage platform, or speculative infrastructure.
- The database is greenfield and has no production data: use drop-and-recreate when a breaking schema change is simpler.
- Do not expand the upstream Fred global-timeout issue into product-owned Fred replacement work; keep explicit product boundary timeouts/cancellation safe and retain the upstream issue as external follow-up.

## Dependencies

- Depends on [[02_Phases/Phase_02_document_research_and_hybrid_retrieval/Phase|PHASE-02 Document Research and Hybrid Retrieval]].
- Depends on [[02_Phases/Phase_03_durable_directory_ingestion_and_source_refresh/Phase|PHASE-03 Durable Directory Ingestion and Source Refresh]].
- Depends on [[02_Phases/Phase_04_structured_datasets_and_deterministic_sql/Phase|PHASE-04 Structured Datasets and Deterministic SQL]].
- Depends on [[02_Phases/Phase_05_typed_research_planning_and_bounded_execution/Phase|PHASE-05 Typed Research Planning and Bounded Execution]].
- Depends on [[02_Phases/Phase_06_recursive_corpus_analysis/Phase|PHASE-06 Recursive Corpus Analysis]].
- Depends on [[02_Phases/Phase_07_hybrid_cross_source_research/Phase|PHASE-07 Hybrid Cross-Source Research]].
- Depends on [[02_Phases/Phase_08_citation_backed_reports_and_durable_findings/Phase|PHASE-08 Citation-Backed Reports and Durable Findings]].
### 2026-07-20 authoritative refinement

- Phase 08 is completed and merged, including its canonical 26/26 evaluator and responsive report workspace.
- Steps are strictly sequential: STEP-09-01 → STEP-09-02 → STEP-09-03 → STEP-09-04 → STEP-09-05 → STEP-09-06. Each predecessor must be reviewed, merged, and free of known defects before its successor begins.

## Acceptance Criteria

- [ ] All Phase 01–08 acceptance criteria remain green in an integrated production-like environment.
- [ ] Workspace isolation, authorization, filesystem/SQL/tool boundaries, prompt-injection defenses, secrets, and supply-chain controls pass review and adversarial tests.
- [ ] Drop-recreate, backup/restore, rollback, checkpoint recovery, and dependency-restart procedures meet documented objectives.
- [ ] Capacity, latency, availability, cost, event-stream, and artifact-storage SLOs pass at the v1 reference workload including the 25,000-file corpus.
- [ ] Every required evaluation class passes its versioned release threshold with reproducible artifacts and no unexplained regressions.
- [ ] Traces, logs, metrics, alert specifications, runbooks, and bounded support diagnostics are exercised through local game days.
- [ ] Critical user journeys meet accessibility and browser support targets; user and operator documentation is complete.
- [ ] The release checklist records owners, evidence, known limitations, migration/rollback readiness, and explicit go/no-go approval.
### 2026-07-20 authoritative refinement

- [ ] Every step has focused evidence plus applicable repository-wide typecheck, lint, import-boundary, unit, PostgreSQL/data-engine integration, build, docs, secret-scan, and Vault-doctor proof.
- [ ] Any SolidJS or Effect changes explicitly follow the available SolidJS and Effect skills.
- [ ] UI-affecting work is exercised with Playwright across representative desktop/tablet/mobile resolutions in light and dark mode, with screenshots visually reviewed for responsive layout, focus, contrast, and overflow.
- [ ] Root self-review occurs before each PR; review feedback is validated as a real defect before repair, affected call sites are checked in the same round, and no confirmed defect remains.
- [ ] The release checklist is fully evidenced but the workflow stops immediately before tagging, publishing, deploying, or otherwise performing the actual v1.0 release action.

## Delivery Strategy

- **Sequential work:** Execute one step and one reviewed PR at a time; each merged predecessor supplies the next step's baseline.
- **Gate:** The phase closes only when all acceptance criteria have reproducible evidence and the relevant docs, migrations, security checks, telemetry, and evaluations are updated.
- **Boundary:** Post-v1 work must not be pulled forward in a way that weakens v1 completeness or its release gates.
### 2026-07-20 authoritative refinement

- This supersedes the earlier parallel-lane suggestion: execute the six steps sequentially, one fresh worker and one branch/PR at a time, with root-owned git, self-review, automated review remediation, merge, and clean advancement gates.
- Keep each step minimal and product-owned. Prefer executable checks and small runbooks over introducing new services or platforms.

## Linear Context

<!-- AGENT-START:phase-linear-context -->
- Previous phase: [[02_Phases/Phase_08_citation_backed_reports_and_durable_findings/Phase|PHASE-08 Citation-Backed Reports and Durable Findings]]
- Current phase status: planned
- Next phase: [[02_Phases/Phase_10_v1_1_research_usability/Phase|PHASE-10 v1.1 Research Usability]]
<!-- AGENT-END:phase-linear-context -->

## Related Architecture

<!-- AGENT-START:phase-related-architecture -->
- [[01_Architecture/System_Overview|System Overview]]
- [[01_Architecture/Domain_Model|Domain Model]]
- [[01_Architecture/Integration_Map|Integration Map]]
- [[01_Architecture/Agent_Workflow|Agent Workflow]]
<!-- AGENT-END:phase-related-architecture -->

## Related Decisions

<!-- AGENT-START:phase-related-decisions -->
- [[04_Decisions/DEC-0009_sandbox-filesystem-roots-and-allowlist-read-only-sql|DEC-0009 Sandbox Filesystem Roots and Allowlist Read-Only SQL]]
- [[04_Decisions/DEC-0011_gate-releases-on-a-reproducible-25000-file-evaluation-corpus|DEC-0011 Gate Releases on a Reproducible 25000-File Evaluation Corpus]]
<!-- AGENT-END:phase-related-decisions -->

## Related Bugs

<!-- AGENT-START:phase-related-bugs -->
- None yet.
<!-- AGENT-END:phase-related-bugs -->

## Steps

<!-- AGENT-START:phase-steps -->
- [ ] [[02_Phases/Phase_09_v1_production_hardening_and_release/Steps/Step_01_harden-authentication-workspace-isolation-and-secrets|STEP-09-01 Harden Authentication Workspace Isolation and Secrets]]
- [ ] [[02_Phases/Phase_09_v1_production_hardening_and_release/Steps/Step_02_harden-deployments-migrations-backups-and-rollback|STEP-09-02 Harden Deployments Migrations Backups and Rollback]]
- [ ] [[02_Phases/Phase_09_v1_production_hardening_and_release/Steps/Step_03_complete-performance-capacity-and-resilience-testing|STEP-09-03 Complete Performance Capacity and Resilience Testing]]
- [ ] [[02_Phases/Phase_09_v1_production_hardening_and_release/Steps/Step_04_complete-observability-operations-and-incident-runbooks|STEP-09-04 Complete Observability Operations and Incident Runbooks]]
- [ ] [[02_Phases/Phase_09_v1_production_hardening_and_release/Steps/Step_05_run-full-evaluation-campaign-and-remediate-gates|STEP-09-05 Run Full Evaluation Campaign and Remediate Gates]]
- [ ] [[02_Phases/Phase_09_v1_production_hardening_and_release/Steps/Step_06_publish-v1-documentation-accessibility-and-release-checklist|STEP-09-06 Publish v1 Documentation Accessibility and Release Checklist]]
<!-- AGENT-END:phase-steps -->

## Notes

- Product requirements: authoritative repository document `docs/product-brief.md`.
- Human-readable roadmap: `docs/roadmap.md`; concise index: `docs/implementation-plan.md`.
- Assumption policy: reversible uncertainties use the documented default until spike evidence requires a decision update; no hidden architectural assumption is carried only in chat.
### 2026-07-20 Phase Refinement

- Refined against the completed Phase 08 repository in [[05_Sessions/2026-07-20-211503-harden-authentication-workspace-isolation-and-secrets-phase-09-refinement|SESSION-2026-07-20-211503]].
- Architecture anchors: [[01_Architecture/System_Overview|System Overview]], [[01_Architecture/Integration_Map|Integration Map]], [[01_Architecture/Agent_Workflow|Agent Workflow]], and [[01_Architecture/Code_Map|Code Map]].
- Durable boundaries: [[04_Decisions/DEC-0009_sandbox-filesystem-roots-and-allowlist-read-only-sql|DEC-0009]], [[04_Decisions/DEC-0011_gate-releases-on-a-reproducible-25000-file-evaluation-corpus|DEC-0011]], [[04_Decisions/DEC-0013_use-tailwind-css-and-daisyui-with-a-custom-theme-for-frontend-styling|DEC-0013]], and [[04_Decisions/DEC-0014_use-solidjs-vite-8-and-solid-router-for-frontend-runtime|DEC-0014]].
- Risk focus is confined to authentication/isolation, destructive greenfield recovery, bounded provider/runtime interruption, telemetry redaction, evaluation drift, and accessible responsive release evidence.
