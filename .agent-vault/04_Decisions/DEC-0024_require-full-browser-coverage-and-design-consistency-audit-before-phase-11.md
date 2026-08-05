---
note_type: decision
template_version: 2
contract_version: 1
title: require full browser coverage and design consistency audit before phase 11
decision_id: DEC-0024
status: accepted
decided_on: '2026-07-27'
owner: ''
created: '2026-07-27'
updated: '2026-07-27'
supersedes: []
superseded_by: []
related_notes:
  - '[[02_Phases/Phase_10_v1_usable_research_workspace/Phase|PHASE-10 v1 Usable Research Workspace]]'
tags:
  - agent-vault
  - decision
---

# DEC-0024 - require full browser coverage and design consistency audit before phase 11

Use one note per durable choice. Record what was chosen, why, tradeoffs, and supersession history, and link back to the phase, bug, or architecture note that made the choice necessary. See [[07_Templates/Note_Contracts|Note Contracts]].

## Status

- Current status: accepted.

## Context

- Phase 10 reached functional completion, but browser coverage and cross-view visual consistency were not yet proven comprehensively enough to begin Phase 11 safely.
- Add Project and Add Source are parallel creation workflows and must present closely aligned interaction, error, responsive, and theme behavior.
- Related notes: [[02_Phases/Phase_10_v1_usable_research_workspace/Phase|PHASE-10 v1 Usable Research Workspace]].

## Decision

- Keep PHASE-11 blocked until a full browser E2E coverage and cross-view design audit is completed.
- Browser-test every user-facing function and meaningful state, with responsive light/dark screenshots for each state.
- Use frontend design review, UI/UX review, and live browser dogfooding; explicitly compare equivalent workflows, especially Add Project and Add Source.
- Record every confirmed gap as a vault bug, fix each bug through the normal fresh-worker and reviewed-PR workflow, and require clean repository and vault validation before lifting the gate.

## Alternatives Considered

- Begin PHASE-11 after the existing E2E suite passed: rejected because passing current tests does not prove complete state or visual coverage.
- Track design inconsistencies as later polish: rejected because Phase 11 would build on unverified interaction and visual foundations.
- Audit only desktop light mode: rejected because responsive and dark-mode states are user-facing contracts.

## Tradeoffs

- This adds audit, screenshot, implementation, and review time before Phase 11.
- It reduces the risk of compounding missing coverage, inconsistent workflows, accessibility defects, and responsive/theme regressions in later phases.

## Consequences

- PHASE-11 remains blocked until the audit is complete, every confirmed finding is fixed, full browser coverage and screenshot matrices are green, all PR review feedback is resolved, and the vault validates cleanly.
- The v1.0 release action remains outside this decision and must not be performed without explicit authorization.

## Related Notes

<!-- AGENT-START:decision-related-notes -->
- Phase: [[02_Phases/Phase_10_v1_usable_research_workspace/Phase|PHASE-10 v1 Usable Research Workspace]]
<!-- AGENT-END:decision-related-notes -->

## Change Log

<!-- AGENT-START:decision-change-log -->
- 2026-07-27 - Created and accepted as the mandatory gate before PHASE-11.
- 2026-08-05 - DEC-0024 final browser E2E and cross-view design audit completed. 0 new confirmed defects found. DEC-0024 gate satisfied; Phase 11 unblocked. Session: [[05_Sessions/2026-08-05-052456-complete-responsive-accessibility-and-theme-behavior-pi|SESSION-2026-08-05-052456]].
<!-- AGENT-END:decision-change-log -->
