---
note_type: phase
template_version: 2
contract_version: 1
title: v1.1 Research Usability
phase_id: PHASE-11
status: planned
owner: ''
created: '2026-07-17'
updated: '2026-07-21'
depends_on:
  - '[[02_Phases/Phase_10_v1_usable_research_workspace/Phase|PHASE-10 v1 Usable Research Workspace]]'
related_architecture:
  - '[[01_Architecture/System_Overview|System Overview]]'
  - '[[01_Architecture/Domain_Model|Domain Model]]'
  - '[[01_Architecture/Integration_Map|Integration Map]]'
  - '[[01_Architecture/Agent_Workflow|Agent Workflow]]'
related_decisions: []
related_bugs: []
tags:
  - agent-vault
  - phase
  - post-v1
---

# Phase 11 v1.1 Research Usability

Use this note as the canonical bounded milestone. Detailed execution belongs in linked step companion notes; architecture and durable choices belong in their linked notes.

## Objective

- Improve everyday research speed and comprehension through navigation, saved work, templates, accessibility, and evidence-based usability iteration without changing v1 trust guarantees.

## Why This Phase Exists

- After the reliable core ships, usability improvements can reduce repeated setup and help users inspect complex evidence while remaining independently releasable.

## Scope

- Improve global search, command/navigation patterns, run history, evidence exploration, and keyboard workflows.
- Add saved queries, views, filters, and reusable research templates with typed versioning.
- Measure usability, accessibility, adoption, error recovery, and support outcomes; iterate behind feature flags.

## Non-Goals

- New external source connectors, continuous monitoring, or multi-user governance.
- Changing citation, provenance, security, or deterministic-query guarantees.

## Dependencies

- Depends on [[02_Phases/Phase_09_v1_production_hardening_and_release/Phase|PHASE-09 v1 Production Hardening and Release]].

## Acceptance Criteria

- [ ] Core journeys require fewer measured steps without hiding plan, progress, evidence, or cost.
- [ ] Saved objects are workspace-scoped, versioned, migratable, exportable where appropriate, and covered by authorization tests.
- [ ] Accessibility, browser, analytics-privacy, usability, regression, and documentation gates pass.
- [ ] Features can be disabled or rolled back independently of v1 data integrity.

## Delivery Strategy

- **Safe parallel work:** Navigation and saved-object work can proceed in parallel behind stable v1 APIs; usability research validates both before release.
- **Gate:** The phase closes only when all acceptance criteria have reproducible evidence and the relevant docs, migrations, security checks, telemetry, and evaluations are updated.
- **Boundary:** Post-v1 work must not be pulled forward in a way that weakens v1 completeness or its release gates.

## Linear Context

<!-- AGENT-START:phase-linear-context -->
- Previous phase: [[02_Phases/Phase_10_v1_usable_research_workspace/Phase|PHASE-10 v1 Usable Research Workspace]]
- Current phase status: planned
- Next phase: [[02_Phases/Phase_12_v1_2_additional_sources/Phase|PHASE-12 v1.2 Additional Sources]]
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
- No phase-specific decision note; inherited architecture decisions still apply.
<!-- AGENT-END:phase-related-decisions -->

## Related Bugs

<!-- AGENT-START:phase-related-bugs -->
- None yet.
<!-- AGENT-END:phase-related-bugs -->

## Steps

<!-- AGENT-START:phase-steps -->
- [ ] [[02_Phases/Phase_11_v1_1_research_usability/Steps/Step_01_improve-research-search-navigation-and-command-ux|STEP-11-01 Improve Research Search Navigation and Command UX]]
- [ ] [[02_Phases/Phase_11_v1_1_research_usability/Steps/Step_02_add-saved-queries-views-and-research-templates|STEP-11-02 Add Saved Queries Views and Research Templates]]
- [ ] [[02_Phases/Phase_11_v1_1_research_usability/Steps/Step_03_validate-usability-accessibility-and-feedback-loops|STEP-11-03 Validate Usability Accessibility and Feedback Loops]]
<!-- AGENT-END:phase-steps -->

## Notes

- Product requirements: authoritative repository document `docs/product-brief.md`.
- Human-readable roadmap: `docs/roadmap.md`; concise index: `docs/implementation-plan.md`.
- Assumption policy: reversible uncertainties use the documented default until spike evidence requires a decision update; no hidden architectural assumption is carried only in chat.
