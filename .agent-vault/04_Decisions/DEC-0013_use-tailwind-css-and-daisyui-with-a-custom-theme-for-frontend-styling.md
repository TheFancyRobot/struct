---
note_type: decision
template_version: 2
contract_version: 1
title: Use Tailwind CSS and DaisyUI with a Custom Theme for Frontend Styling
decision_id: DEC-0013
status: accepted
decided_on: '2026-07-17'
owner: ''
created: '2026-07-17'
updated: '2026-07-17'
supersedes: []
superseded_by: []
related_notes:
  - '[[02_Phases/Phase_00_architecture_spikes_and_delivery_foundations/Phase|PHASE-00 Architecture Spikes and Delivery Foundations]]'
  - '[[01_Architecture/System_Overview|System Overview]]'
  - '[[01_Architecture/Code_Map|Code Map]]'
  - '[[02_Phases/Phase_01_walking_skeleton/Phase|PHASE-01 Walking Skeleton]]'
  - '[[02_Phases/Phase_01_walking_skeleton/Steps/Step_01_scaffold-monorepo-and-runtime-applications|STEP-01-01 Scaffold Monorepo and Runtime Applications]]'
tags:
  - agent-vault
  - decision
---

# DEC-0013 - Use Tailwind CSS and DaisyUI with a Custom Theme for Frontend Styling

Use one note per durable choice. Record what was chosen, why, tradeoffs, and supersession history, and link back to the phase, bug, or architecture note that made the choice necessary. See [[07_Templates/Note_Contracts|Note Contracts]].

## Status

- Current status: accepted.

## Context

- The frontend needs one consistent styling system across the web application, shared UI, research workflows, reports, and future UX surfaces.
- Styling choices must remain themeable and accessible without accumulating one-off CSS or competing component systems.

## Decision

- Use Tailwind CSS for all frontend layout and utility styling.
- Use DaisyUI as the component and design-token layer.
- Define and own a project-specific DaisyUI theme; do not ship an unmodified stock theme.
- Frontend work must extend the shared theme or reusable components instead of introducing another styling framework or ad hoc page-level design system.

## Alternatives Considered

- Plain CSS or CSS Modules: rejected as the default because they would duplicate tokens and component patterns across surfaces.
- A different component library or CSS-in-JS runtime: rejected to keep the styling stack singular and avoid additional runtime or theming complexity.
- Stock DaisyUI themes: rejected because the product requires a distinctive, project-owned visual identity.

## Tradeoffs

- The team must maintain Tailwind/DaisyUI configuration, custom theme tokens, accessibility states, and upgrade compatibility.
- DaisyUI conventions constrain component markup, but provide consistent primitives and reduce bespoke styling.
- Exceptions require an explicit superseding decision rather than local divergence.

## Consequences

- The walking-skeleton scaffold must install and configure Tailwind CSS and DaisyUI.
- Shared UI primitives and every frontend feature should consume the custom theme tokens.
- Validation plans for frontend work must check responsive behavior, accessibility, and consistency with the custom theme.

## Related Notes

<!-- AGENT-START:decision-related-notes -->
- Phase: [[02_Phases/Phase_00_architecture_spikes_and_delivery_foundations/Phase|PHASE-00 Architecture Spikes and Delivery Foundations]]
- Architecture: [[01_Architecture/System_Overview|System Overview]]
- Architecture: [[01_Architecture/Code_Map|Code Map]]
- Phase: [[02_Phases/Phase_01_walking_skeleton/Phase|PHASE-01 Walking Skeleton]]
- Step: [[02_Phases/Phase_01_walking_skeleton/Steps/Step_01_scaffold-monorepo-and-runtime-applications|STEP-01-01 Scaffold Monorepo and Runtime Applications]]
<!-- AGENT-END:decision-related-notes -->

## Change Log

<!-- AGENT-START:decision-change-log -->
- 2026-07-17 - Created and accepted: standardize all frontend styling on Tailwind CSS, DaisyUI, and a project-owned custom theme.
<!-- AGENT-END:decision-change-log -->
