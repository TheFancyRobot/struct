---
note_type: phase
template_version: 2
contract_version: 1
title: "<phase title>"
phase_id: "PHASE-000"
status: planned
owner: ""
created: "YYYY-MM-DD"
updated: "YYYY-MM-DD"
depends_on: []
related_architecture: []
related_decisions: []
related_bugs: []
tags:
  - agent-vault
  - phase
---

# Phase Template

Use this note for a bounded phase. Keep it focused, link outward, and avoid duplicating durable detail from architecture, bug, or decision notes. See [[07_Templates/Note_Contracts|Note Contracts]].

## Objective

- State the outcome, not just the activity.

## Why This Phase Exists

- Explain the problem and who or what it affects.

## Scope

- List the systems, commands, workflows, or docs that are in scope.

## Non-Goals

- List related work that is intentionally out of scope.

## Dependencies

- List prerequisites or blockers.

## Acceptance Criteria

- Use observable completion checks.

## Linear Context

<!-- AGENT-START:phase-linear-context -->
- Previous phase:
- Current phase status: planned
- Next phase:
<!-- AGENT-END:phase-linear-context -->

## Related Architecture

<!-- AGENT-START:phase-related-architecture -->
- [[01_Architecture/<note name>|<architecture note>]]
<!-- AGENT-END:phase-related-architecture -->

## Related Decisions

<!-- AGENT-START:phase-related-decisions -->
- [[04_Decisions/<decision note>|<decision note>]]
<!-- AGENT-END:phase-related-decisions -->

## Related Bugs

<!-- AGENT-START:phase-related-bugs -->
- [[03_Bugs/<bug note>|<bug note>]]
<!-- AGENT-END:phase-related-bugs -->

## Steps

<!-- AGENT-START:phase-steps -->
- [ ] [[<step note>|Step 01]] - Describe the next concrete unit of execution.
- [ ] [[<step note>|Step 02]] - Add more steps as the plan becomes clearer.
<!-- AGENT-END:phase-steps -->

## Notes

- Keep short planning notes, risks, or assumptions here.
