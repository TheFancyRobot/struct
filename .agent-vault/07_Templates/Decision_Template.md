---
note_type: decision
template_version: 2
contract_version: 1
title: "<decision title>"
decision_id: "DEC-0000"
status: proposed
decided_on: "YYYY-MM-DD"
owner: ""
created: "YYYY-MM-DD"
updated: "YYYY-MM-DD"
supersedes: []
superseded_by: []
related_notes: []
tags:
  - agent-vault
  - decision
---

# Decision Template

Use one note per durable choice. Record what was chosen, why, tradeoffs, and supersession history, and link back to the phase, bug, or architecture note that made the choice necessary. See [[07_Templates/Note_Contracts|Note Contracts]].

## Status

- Keep this section aligned with the frontmatter status.

## Context

- Explain the problem, constraints, and links that forced a choice.

## Decision

- State the chosen direction and boundary clearly.

## Alternatives Considered

- List realistic alternatives and why they were not selected.

## Tradeoffs

- Describe costs, risks, complexity, and operational implications.

## Consequences

- Record what changes now and any required follow-up work.

## Related Notes

<!-- AGENT-START:decision-related-notes -->
- Phase: [[02_Phases/<phase path>/Phase|<phase name>]]
- Architecture: [[01_Architecture/<note name>|<architecture note>]]
- Bug: [[03_Bugs/<bug note>|<bug note>]]
<!-- AGENT-END:decision-related-notes -->

## Change Log

<!-- AGENT-START:decision-change-log -->
- YYYY-MM-DD - Created as \`proposed\`.
- YYYY-MM-DD - Updated after review.
<!-- AGENT-END:decision-change-log -->
