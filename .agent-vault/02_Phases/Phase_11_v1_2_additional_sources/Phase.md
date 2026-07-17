---
note_type: phase
template_version: 2
contract_version: 1
title: v1.2 Additional Sources
phase_id: PHASE-11
status: planned
owner: ''
created: '2026-07-17'
updated: '2026-07-17'
depends_on: 
  - '[[02_Phases/Phase_09_v1_production_hardening_and_release/Phase|PHASE-09 v1 Production Hardening and Release]]'
  - '[[02_Phases/Phase_10_v1_1_research_usability/Phase|PHASE-10 v1.1 Research Usability]]'
related_architecture:
  - '[[01_Architecture/System_Overview|System Overview]]'
  - '[[01_Architecture/Domain_Model|Domain Model]]'
  - '[[01_Architecture/Integration_Map|Integration Map]]'
  - '[[01_Architecture/Agent_Workflow|Agent Workflow]]'
related_decisions: 
  - '[[04_Decisions/DEC-0002_prefer-product-local-adapters-before-fred-core-changes|DEC-0002 Prefer Product-Local Adapters Before Fred Core Changes]]'
  - '[[04_Decisions/DEC-0006_make-source-versions-immutable-and-provenance-typed|DEC-0006 Make Source Versions Immutable and Provenance Typed]]'
related_bugs: []
tags:
  - agent-vault
  - phase
  - post-v1
---

# Phase 11 v1.2 Additional Sources

Use this note as the canonical bounded milestone. Detailed execution belongs in linked step companion notes; architecture and durable choices belong in their linked notes.

## Objective

- Add a secure reusable connector framework and selected web/object-storage/export sources without compromising immutable versions, provenance, access control, or recovery.

## Why This Phase Exists

- Additional sources broaden research value only after the local document/directory/dataset contracts are stable enough to constrain connectors.

## Scope

- Define connector capabilities, credentials, discovery, rate limits, checkpoints, version identity, provenance, and revocation contracts.
- Implement the prioritized web, S3-compatible object storage, and export/import connectors selected by product evidence.
- Validate connector-specific security, licensing/robots policy, provenance, retries, quotas, recovery, observability, and docs.

## Non-Goals

- A generic unreviewed plugin marketplace.
- Connectors that bypass source versions, workspace policy, artifact storage, or ingestion jobs.

## Dependencies

- Depends on [[02_Phases/Phase_09_v1_production_hardening_and_release/Phase|PHASE-09 v1 Production Hardening and Release]].
- Depends on [[02_Phases/Phase_10_v1_1_research_usability/Phase|PHASE-10 v1.1 Research Usability]].

## Acceptance Criteria

- [ ] Every connector maps external objects to immutable local source versions with complete origin metadata.
- [ ] Credentials are scoped, encrypted, revocable, redacted, and never exposed to Fred prompts or tool results.
- [ ] Rate limits, pagination, deletion, partial failure, retry, resume, and upstream changes are deterministic and tested.
- [ ] Connector provenance, security, legal-policy, observability, migration, and recovery gates pass.

## Delivery Strategy

- **Safe parallel work:** Connector framework and one reference adapter precede parallel source-specific adapters; shared conformance tests gate every connector.
- **Gate:** The phase closes only when all acceptance criteria have reproducible evidence and the relevant docs, migrations, security checks, telemetry, and evaluations are updated.
- **Boundary:** Post-v1 work must not be pulled forward in a way that weakens v1 completeness or its release gates.

## Linear Context

<!-- AGENT-START:phase-linear-context -->
- Previous phase: [[02_Phases/Phase_10_v1_1_research_usability/Phase|PHASE-10 v1.1 Research Usability]]
- Current phase status: planned
- Next phase: [[02_Phases/Phase_12_v1_3_continuous_research/Phase|PHASE-12 v1.3 Continuous Research]]
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
- [[04_Decisions/DEC-0002_prefer-product-local-adapters-before-fred-core-changes|DEC-0002 Prefer Product-Local Adapters Before Fred Core Changes]]
- [[04_Decisions/DEC-0006_make-source-versions-immutable-and-provenance-typed|DEC-0006 Make Source Versions Immutable and Provenance Typed]]
<!-- AGENT-END:phase-related-decisions -->

## Related Bugs

<!-- AGENT-START:phase-related-bugs -->
- None yet.
<!-- AGENT-END:phase-related-bugs -->

## Steps

<!-- AGENT-START:phase-steps -->
- [ ] [[02_Phases/Phase_11_v1_2_additional_sources/Steps/Step_01_define-a-secure-connector-framework|STEP-11-01 Define a Secure Connector Framework]]
- [ ] [[02_Phases/Phase_11_v1_2_additional_sources/Steps/Step_02_add-web-object-storage-and-export-connectors|STEP-11-02 Add Web Object Storage and Export Connectors]]
- [ ] [[02_Phases/Phase_11_v1_2_additional_sources/Steps/Step_03_validate-connector-provenance-security-and-recovery|STEP-11-03 Validate Connector Provenance Security and Recovery]]
<!-- AGENT-END:phase-steps -->

## Notes

- Product requirements: authoritative repository document `docs/product-brief.md`.
- Human-readable roadmap: `docs/roadmap.md`; concise index: `docs/implementation-plan.md`.
- Assumption policy: reversible uncertainties use the documented default until spike evidence requires a decision update; no hidden architectural assumption is carried only in chat.
