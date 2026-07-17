---
note_type: architecture
template_version: 2
contract_version: 1
title: "<architecture note title>"
architecture_id: "ARCH-0000"
status: active
owner: ""
reviewed_on: "YYYY-MM-DD"
created: "YYYY-MM-DD"
updated: "YYYY-MM-DD"
related_notes: []
tags:
  - agent-vault
  - architecture
---

# Architecture Template

Use this note when a subsystem or cross-cutting concern needs durable explanation. Keep it high-signal, path-first, and linked to the related phase and decision notes. See [[07_Templates/Note_Contracts|Note Contracts]].

## Purpose

- Explain what part of the system this note covers.

## Overview

- Describe the subsystem and how it fits into the repo.

## Key Components

<!-- AGENT-START:architecture-key-components -->
- Component or module name - Responsibility.
<!-- AGENT-END:architecture-key-components -->

## Important Paths

<!-- AGENT-START:architecture-important-paths -->
- \`packages/...\` - Why this path matters.
<!-- AGENT-END:architecture-important-paths -->

## Constraints

- Record invariants, contracts, dependencies, or operational rules that must hold.

## Failure Modes

- List failures, symptoms, and what to inspect first.

## Related Notes

<!-- AGENT-START:architecture-related-notes -->
- [[01_Architecture/<related note>|<related note>]]
- [[04_Decisions/<decision note>|<decision note>]]
- [[02_Phases/<phase path>/Phase|<phase name>]]
<!-- AGENT-END:architecture-related-notes -->
