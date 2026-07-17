---
note_type: session
template_version: 2
contract_version: 1
title: "<session title>"
session_id: "SESSION-YYYY-MM-DD-01"
date: "YYYY-MM-DD"
status: in-progress
owner: ""
branch: ""
phase: "[[02_Phases/<phase path>/Phase|<phase name>]]"
context:
  context_id: "SESSION-YYYY-MM-DD-01"
  status: active
  updated_at: "YYYY-MM-DDTHH:MM:SS.000Z"
  current_focus:
    summary: "Advance [[02_Phases/<phase path>/Steps/<step note>|<step name>]]."
    target: "[[02_Phases/<phase path>/Steps/<step note>|<step name>]]"
  resume_target:
    type: step
    target: "[[02_Phases/<phase path>/Steps/<step note>|<step name>]]"
    section: "Context Handoff"
  last_action:
    type: saved
related_bugs: []
related_decisions: []
created: "YYYY-MM-DD"
updated: "YYYY-MM-DD"
tags:
  - agent-vault
  - session
---

# Session Template

Use one note per meaningful work session. Record chronology, validation, and handoff state, but promote durable conclusions into phase, architecture, bug, or decision notes. See [[07_Templates/Note_Contracts|Note Contracts]].

## Objective

- State the intended outcome for this session.

## Planned Scope

- List the specific tasks intended for this session.

## Execution Log

<!-- AGENT-START:session-execution-log -->
- HH:MM - Started session and reviewed context.
- HH:MM - Implemented or investigated change.
<!-- AGENT-END:session-execution-log -->

## Findings

- Record important facts learned during the session.

## Context Handoff

- Use this as the canonical prose section for prepared context and resume notes.

## Changed Paths

<!-- AGENT-START:session-changed-paths -->
- \`path/to/file\`
<!-- AGENT-END:session-changed-paths -->

## Validation Run

<!-- AGENT-START:session-validation-run -->
- Command: \`bun test <target>\`
- Result: pass | fail | not run
- Notes:
<!-- AGENT-END:session-validation-run -->

## Bugs Encountered

<!-- AGENT-START:session-bugs-encountered -->
- [[03_Bugs/<bug note>|<bug note>]] - Short note.
<!-- AGENT-END:session-bugs-encountered -->

## Decisions Made or Updated

<!-- AGENT-START:session-decisions-made-or-updated -->
- [[04_Decisions/<decision note>|<decision note>]] - Short note.
<!-- AGENT-END:session-decisions-made-or-updated -->

## Follow-Up Work

<!-- AGENT-START:session-follow-up-work -->
- [ ] Next concrete action.
<!-- AGENT-END:session-follow-up-work -->

## Completion Summary

- State what finished, what remains, and whether handoff is clean.
