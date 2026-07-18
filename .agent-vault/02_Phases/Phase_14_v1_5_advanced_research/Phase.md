---
note_type: phase
template_version: 2
contract_version: 1
title: v1.5 Advanced Research
phase_id: PHASE-14
status: planned
owner: ''
created: '2026-07-17'
updated: '2026-07-17'
depends_on:
  - '[[02_Phases/Phase_12_v1_3_continuous_research/Phase|PHASE-12 v1.3 Continuous Research]]'
  - '[[02_Phases/Phase_13_v1_4_collaboration_and_governance/Phase|PHASE-13 v1.4 Collaboration and Governance]]'
related_architecture:
  - '[[01_Architecture/System_Overview|System Overview]]'
  - '[[01_Architecture/Domain_Model|Domain Model]]'
  - '[[01_Architecture/Integration_Map|Integration Map]]'
  - '[[01_Architecture/Agent_Workflow|Agent Workflow]]'
related_decisions:
  - '[[04_Decisions/DEC-0002_prefer-product-local-adapters-before-fred-core-changes|DEC-0002 Prefer Product-Local Adapters Before Fred Core Changes]]'
  - '[[04_Decisions/DEC-0010_use-focused-fred-agents-with-deterministic-effect-tools|DEC-0010 Use Focused Fred Agents with Deterministic Effect Tools]]'
related_bugs: []
tags:
  - agent-vault
  - phase
  - post-v1
---

# Phase 14 v1.5 Advanced Research

Use this note as the canonical bounded milestone. Detailed execution belongs in linked step companion notes; architecture and durable choices belong in their linked notes.

## Objective

- Add policy-governed custom research templates/tools and advanced comparative, longitudinal, multimodal, and model-assisted modes with dedicated evaluations.

## Why This Phase Exists

- Advanced modes should reuse the stable typed plan, tool, provenance, and governance contracts rather than expanding the trusted computing base ad hoc.

## Scope

- Version custom plan templates and tool policies with validation, approval, capability, budget, and sandbox contracts.
- Add comparative, longitudinal, and selected multimodal research paths while preserving source-specific evidence semantics.
- Evaluate new models, providers, tools, modalities, cost/latency, safety, reproducibility, and graceful degradation.

## Non-Goals

- Arbitrary user code execution or unrestricted tool installation.
- Relaxing deterministic computation or citation requirements for advanced models.

## Dependencies

- Depends on [[02_Phases/Phase_12_v1_3_continuous_research/Phase|PHASE-12 v1.3 Continuous Research]].
- Depends on [[02_Phases/Phase_13_v1_4_collaboration_and_governance/Phase|PHASE-13 v1.4 Collaboration and Governance]].

## Acceptance Criteria

- [ ] Custom templates and tools are schema-valid, capability-scoped, reviewed, versioned, auditable, revocable, and sandboxed.
- [ ] Advanced research outputs disclose modality/model limitations and retain complete claim-level provenance.
- [ ] Provider/model changes pass golden-trace, quality, cost, latency, security, and fallback gates before rollout.
- [ ] Every advanced mode is feature-flagged, independently reversible, documented, and excluded from v1 compatibility promises.

## Delivery Strategy

- **Safe parallel work:** Template/tool governance and new research-mode prototyping may proceed in parallel; production rollout depends on dedicated evaluation gates.
- **Gate:** The phase closes only when all acceptance criteria have reproducible evidence and the relevant docs, migrations, security checks, telemetry, and evaluations are updated.
- **Boundary:** Post-v1 work must not be pulled forward in a way that weakens v1 completeness or its release gates.

## Linear Context

<!-- AGENT-START:phase-linear-context -->
- Previous phase: [[02_Phases/Phase_13_v1_4_collaboration_and_governance/Phase|PHASE-13 v1.4 Collaboration and Governance]]
- Current phase status: planned
- Next phase: [[02_Phases/Phase_15_v2_scaled_research_platform/Phase|PHASE-15 v2 Scaled Research Platform]]
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
- [[04_Decisions/DEC-0010_use-focused-fred-agents-with-deterministic-effect-tools|DEC-0010 Use Focused Fred Agents with Deterministic Effect Tools]]
<!-- AGENT-END:phase-related-decisions -->

## Related Bugs

<!-- AGENT-START:phase-related-bugs -->
- None yet.
<!-- AGENT-END:phase-related-bugs -->

## Steps

<!-- AGENT-START:phase-steps -->
- [ ] [[02_Phases/Phase_14_v1_5_advanced_research/Steps/Step_01_add-custom-research-templates-and-tool-policies|STEP-14-01 Add Custom Research Templates and Tool Policies]]
- [ ] [[02_Phases/Phase_14_v1_5_advanced_research/Steps/Step_02_add-comparative-longitudinal-and-multimodal-research|STEP-14-02 Add Comparative Longitudinal and Multimodal Research]]
- [ ] [[02_Phases/Phase_14_v1_5_advanced_research/Steps/Step_03_evaluate-advanced-models-tools-and-research-modes|STEP-14-03 Evaluate Advanced Models Tools and Research Modes]]
<!-- AGENT-END:phase-steps -->

## Notes

- Product requirements: authoritative repository document `docs/product-brief.md`.
- Human-readable roadmap: `docs/roadmap.md`; concise index: `docs/implementation-plan.md`.
- Assumption policy: reversible uncertainties use the documented default until spike evidence requires a decision update; no hidden architectural assumption is carried only in chat.
