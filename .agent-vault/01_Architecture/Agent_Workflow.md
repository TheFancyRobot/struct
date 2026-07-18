---
note_type: architecture
template_version: 2
contract_version: 1
title: Agent Workflow
architecture_id: ARCH-0003
status: active
owner: ''
reviewed_on: '2026-07-18'
created: '2026-07-17'
updated: '2026-07-18'
related_notes:
  - '[[01_Architecture/System_Overview|System Overview]]'
  - '[[01_Architecture/Integration_Map|Integration Map]]'
tags:
  - agent-vault
  - architecture
---

# Agent Workflow

## Purpose

- Define the intended typed, bounded Fred workflow for source-grounded research.
- Clarify which work belongs to agents and which work must remain deterministic.

## Overview

- A research run loads a source-version catalog, classifies intent, builds a concise typed plan, executes deterministic tools, evaluates evidence sufficiency, revises within limits, verifies evidence, synthesizes an answer, validates citations, persists the run, and streams progress.
- Agents make judgments about planning, qualitative analysis, evidence sufficiency, and synthesis. Effect services perform authorization, source inspection, retrieval, SQL validation/execution, persistence, and citation checks.
- Persist plans, tool requests/results, decisions, findings, and evidence assessments, but never private model chain-of-thought.
- STEP-01-04 implements the first bounded workflow slice: deterministic PostgreSQL text retrieval feeds one Fred answer-synthesizer agent, exact citation validation gates persistence, and configured limits enforce at most five workflow steps, one tool call, one model call, and 60 seconds by default. Insufficient evidence terminates with a typed durable failure rather than an unsupported answer.

## Key Components

<!-- AGENT-START:architecture-key-components -->
- Research planner: selects source scope, strategy, steps, expected evidence, and limits.
- SQL planner: proposes schema-aware read-only queries; deterministic validators enforce safety.
- Corpus analyst: emits structured partition findings with evidence, coverage, counterevidence, and limitations.
- Evidence critic: checks sufficiency, contradictions, source coverage, and unsupported claims.
- Answer synthesizer/report writer: produces citation-backed answers and Markdown reports.
- Deterministic tools: catalog inspection, manifest navigation, bounded file reading, hybrid search, schema profiling, SQL execution, version comparison, finding persistence, and citation validation.
<!-- AGENT-END:architecture-key-components -->

## Important Paths

<!-- AGENT-START:architecture-important-paths -->
- `docs/product-brief.md` sections 13–15 — research execution, recursive decomposition, agents, and tools.
- `packages/fred-workflows` — planned agent, tool, graph, prompt, and workflow composition layer.
- `packages/research-engine` — planned plans, evidence sufficiency, decomposition, merging, and synthesis logic.
- `packages/data-engine` — planned deterministic SQL inspection, validation, and execution.
- `apps/worker` — scaffolded durable workflow execution boundary (Effect Config skeleton); full execution in later steps.
<!-- AGENT-END:architecture-important-paths -->

## Constraints

- Use typed input/output schemas at every agent, tool, and workflow boundary.
- Source content is untrusted evidence and cannot change instructions, permissions, scope, or limits.
- Exact computation must use deterministic query tools rather than semantic retrieval or model arithmetic.
- Enforce maximum steps, model/tool calls, tokens, elapsed time, estimated cost, duplicate-action detection, and no-progress detection.
- Support cancellation, retry, checkpoint/resume, idempotency, and structured tracing.
- Higher-level recursive synthesis must preserve source evidence and be able to reopen original material.
- Enforce a repository-wide zero-defect advancement gate: no new roadmap step or phase starts while any confirmed defect is known. Fix defects regardless of current scope, validate the fix, and treat externally blocked defects as advancement blockers rather than deferrable follow-up.

## Failure Modes

- Unbounded replanning creates loops, cost overruns, and unrecoverable runs.
- Natural-language tool contracts cause parsing ambiguity and unsafe execution.
- Prose-only summaries lose minority findings and prevent evidence verification.
- Carrying citations across source refreshes without validation creates stale claims.
- Following instructions embedded in imported content creates prompt-injection vulnerabilities.
- Embedding large tool outputs directly in checkpoints causes persistence bloat and slow resume.

## Related Notes

<!-- AGENT-START:architecture-related-notes -->
- [[01_Architecture/System_Overview|System Overview]]
- [[01_Architecture/Integration_Map|Integration Map]]
- [[06_Shared_Knowledge/Agent_Workflow_Playbooks|Agent Workflow Playbooks]]
<!-- AGENT-END:architecture-related-notes -->
