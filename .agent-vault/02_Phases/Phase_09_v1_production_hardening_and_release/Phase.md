---
note_type: phase
template_version: 2
contract_version: 1
title: v1 Production Hardening and Release
phase_id: PHASE-09
status: planned
owner: ''
created: '2026-07-17'
updated: '2026-07-17'
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

## Why This Phase Exists

- v1 is a product boundary, not a feature pile. All foundational slices must operate together under realistic load, failures, hostile inputs, upgrades, and support procedures.

## Scope

- Complete authentication, authorization, workspace isolation, secret management, dependency/supply-chain controls, and security review.
- Prove zero/low-downtime migrations, backups, restore, rollback, artifact lifecycle, retention, and disaster-recovery objectives.
- Capacity-test ingestion, retrieval, DuckDB, recursive workflows, SSE, persistence, and storage against documented budgets.
- Finish OpenTelemetry coverage, SLOs, dashboards, alerts, cost controls, incident runbooks, support diagnostics, and data-redaction policy.
- Run and remediate the full exact-computation, semantic-retrieval, recursive-analysis, hybrid-research, provenance, injection, and recovery campaign.
- Publish operator, administrator, developer, API, user, security, privacy, migration, and accessibility documentation plus a signed release checklist.

## Non-Goals

- Adding post-v1 connectors, collaboration, continuous monitoring, or advanced research modes to rescue a missed v1 requirement.
- Waiving security, provenance, exactness, recovery, or evaluation gates to meet a date.
- Shipping experimental spike code or unowned operational risk.

## Dependencies

- Depends on [[02_Phases/Phase_02_document_research_and_hybrid_retrieval/Phase|PHASE-02 Document Research and Hybrid Retrieval]].
- Depends on [[02_Phases/Phase_03_durable_directory_ingestion_and_source_refresh/Phase|PHASE-03 Durable Directory Ingestion and Source Refresh]].
- Depends on [[02_Phases/Phase_04_structured_datasets_and_deterministic_sql/Phase|PHASE-04 Structured Datasets and Deterministic SQL]].
- Depends on [[02_Phases/Phase_05_typed_research_planning_and_bounded_execution/Phase|PHASE-05 Typed Research Planning and Bounded Execution]].
- Depends on [[02_Phases/Phase_06_recursive_corpus_analysis/Phase|PHASE-06 Recursive Corpus Analysis]].
- Depends on [[02_Phases/Phase_07_hybrid_cross_source_research/Phase|PHASE-07 Hybrid Cross-Source Research]].
- Depends on [[02_Phases/Phase_08_citation_backed_reports_and_durable_findings/Phase|PHASE-08 Citation-Backed Reports and Durable Findings]].

## Acceptance Criteria

- [ ] All Phase 01–08 acceptance criteria remain green in an integrated production-like environment.
- [ ] Workspace isolation, authorization, filesystem/SQL/tool boundaries, prompt-injection defenses, secrets, and supply-chain controls pass review and adversarial tests.
- [ ] Migrations, backup/restore, rollback, checkpoint recovery, dead-letter recovery, and disaster procedures meet documented objectives.
- [ ] Capacity, latency, availability, cost, event-stream, and artifact-storage SLOs pass at the v1 reference workload including the 25,000-file corpus.
- [ ] Every required evaluation class passes its versioned release threshold with reproducible artifacts and no unexplained regressions.
- [ ] Dashboards, alerts, traces, logs, runbooks, support bundles, and on-call ownership are exercised in game days.
- [ ] Critical user journeys meet accessibility and browser support targets; user and operator documentation is complete.
- [ ] The release checklist records owners, evidence, known limitations, migration/rollback readiness, and explicit go/no-go approval.

## Delivery Strategy

- **Safe parallel work:** Security review, operational readiness, performance/resilience, documentation/accessibility, and evaluation campaigns are parallel hardening lanes. Release approval waits for every lane.
- **Gate:** The phase closes only when all acceptance criteria have reproducible evidence and the relevant docs, migrations, security checks, telemetry, and evaluations are updated.
- **Boundary:** Post-v1 work must not be pulled forward in a way that weakens v1 completeness or its release gates.

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
