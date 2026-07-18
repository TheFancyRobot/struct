---
note_type: phase
template_version: 2
contract_version: 1
title: Citation-Backed Reports and Durable Findings
phase_id: PHASE-08
status: planned
owner: ''
created: '2026-07-17'
updated: '2026-07-17'
depends_on:
  - '[[02_Phases/Phase_07_hybrid_cross_source_research/Phase|PHASE-07 Hybrid Cross-Source Research]]'
related_architecture:
  - '[[01_Architecture/System_Overview|System Overview]]'
  - '[[01_Architecture/Domain_Model|Domain Model]]'
  - '[[01_Architecture/Integration_Map|Integration Map]]'
  - '[[01_Architecture/Agent_Workflow|Agent Workflow]]'
related_decisions:
  - '[[04_Decisions/DEC-0006_make-source-versions-immutable-and-provenance-typed|DEC-0006 Make Source Versions Immutable and Provenance Typed]]'
  - '[[04_Decisions/DEC-0008_own-the-typed-api-and-live-research-event-stream|DEC-0008 Own the Typed API and Live Research Event Stream]]'
related_bugs: []
tags:
  - agent-vault
  - phase
  - v1
---

# Phase 08 Citation-Backed Reports and Durable Findings

Use this note as the canonical bounded milestone. Detailed execution belongs in linked step companion notes; architecture and durable choices belong in their linked notes.

## Objective

- Turn research outputs into durable findings and reports whose claims, citations, source snapshots, computation artifacts, exports, and repair states remain inspectable over time.

## Why This Phase Exists

- A trustworthy research workspace must preserve more than an answer string. Users need editable durable artifacts without losing the immutable evidence and version history behind each claim.

## Scope

- Model finding, claim, report, section, evidence link, citation validation state, snapshot, export, and supersession lifecycles.
- Validate citation reachability and locator integrity before publication and when source/index versions change.
- Compose findings and reports from immutable run outputs while recording user edits separately from generated evidence.
- Create portable export/share bundles with source/version manifests, query artifacts, validation results, and redaction policy.
- Provide report editing, citation navigation, evidence inspection, stale/broken states, and repair workflows.
- Evaluate report fidelity, provenance completeness, version drift, tamper evidence, export round trips, accessibility, and auditability.

## Non-Goals

- Mutable citations that silently retarget newer source versions.
- Exports that omit required provenance or leak content beyond workspace policy.
- Full real-time multi-user collaboration, which remains post-v1.

## Dependencies

- Depends on [[02_Phases/Phase_07_hybrid_cross_source_research/Phase|PHASE-07 Hybrid Cross-Source Research]].

## Acceptance Criteria

- [ ] Every generated claim is backed, explicitly marked unsupported, or excluded from publishable output.
- [ ] Citations resolve through typed provenance edges to immutable source or query-result artifacts and exact locators.
- [ ] User edits, regenerated content, supersession, and source refresh never overwrite historical evidence or authorship.
- [ ] Stale, broken, unauthorized, or incompatible citations are visible and block publish/export according to policy.
- [ ] Export/share bundles are deterministic, access-controlled, redaction-aware, verifiable, and round-trip tested.
- [ ] Reports remain navigable and auditable after reindexing, source refresh, process restart, and application upgrade.
- [ ] Report fidelity, citation validity, provenance, version-drift, security, accessibility, and recovery gates pass.

## Delivery Strategy

- **Safe parallel work:** Domain/persistence work and report UX can proceed in parallel against citation-state fixtures; export begins after the provenance graph and authorization rules are stable.
- **Gate:** The phase closes only when all acceptance criteria have reproducible evidence and the relevant docs, migrations, security checks, telemetry, and evaluations are updated.
- **Boundary:** Post-v1 work must not be pulled forward in a way that weakens v1 completeness or its release gates.

## Linear Context

<!-- AGENT-START:phase-linear-context -->
- Previous phase: [[02_Phases/Phase_07_hybrid_cross_source_research/Phase|PHASE-07 Hybrid Cross-Source Research]]
- Current phase status: planned
- Next phase: [[02_Phases/Phase_09_v1_production_hardening_and_release/Phase|PHASE-09 v1 Production Hardening and Release]]
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
- [[04_Decisions/DEC-0006_make-source-versions-immutable-and-provenance-typed|DEC-0006 Make Source Versions Immutable and Provenance Typed]]
- [[04_Decisions/DEC-0008_own-the-typed-api-and-live-research-event-stream|DEC-0008 Own the Typed API and Live Research Event Stream]]
<!-- AGENT-END:phase-related-decisions -->

## Related Bugs

<!-- AGENT-START:phase-related-bugs -->
- None yet.
<!-- AGENT-END:phase-related-bugs -->

## Steps

<!-- AGENT-START:phase-steps -->
- [ ] [[02_Phases/Phase_08_citation_backed_reports_and_durable_findings/Steps/Step_01_define-findings-reports-citation-states-and-lifecycle|STEP-08-01 Define Findings Reports Citation States and Lifecycle]]
- [ ] [[02_Phases/Phase_08_citation_backed_reports_and_durable_findings/Steps/Step_02_implement-citation-validation-and-provenance-graph|STEP-08-02 Implement Citation Validation and Provenance Graph]]
- [ ] [[02_Phases/Phase_08_citation_backed_reports_and_durable_findings/Steps/Step_03_build-durable-findings-notebooks-and-report-composition|STEP-08-03 Build Durable Findings Notebooks and Report Composition]]
- [ ] [[02_Phases/Phase_08_citation_backed_reports_and_durable_findings/Steps/Step_04_build-export-and-share-bundles-with-source-snapshots|STEP-08-04 Build Export and Share Bundles with Source Snapshots]]
- [ ] [[02_Phases/Phase_08_citation_backed_reports_and_durable_findings/Steps/Step_05_add-report-ux-citation-navigation-and-repair|STEP-08-05 Add Report UX Citation Navigation and Repair]]
- [ ] [[02_Phases/Phase_08_citation_backed_reports_and_durable_findings/Steps/Step_06_evaluate-report-fidelity-version-drift-and-auditability|STEP-08-06 Evaluate Report Fidelity Version Drift and Auditability]]
<!-- AGENT-END:phase-steps -->

## Notes

- Product requirements: authoritative repository document `docs/product-brief.md`.
- Human-readable roadmap: `docs/roadmap.md`; concise index: `docs/implementation-plan.md`.
- Assumption policy: reversible uncertainties use the documented default until spike evidence requires a decision update; no hidden architectural assumption is carried only in chat.
