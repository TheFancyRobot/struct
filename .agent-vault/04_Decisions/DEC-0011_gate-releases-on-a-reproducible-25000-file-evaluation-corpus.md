---
note_type: decision
template_version: 2
contract_version: 1
title: Gate Releases on a Reproducible 25000-File Evaluation Corpus
decision_id: DEC-0011
status: accepted
decided_on: '2026-07-17'
owner: ''
created: '2026-07-17'
updated: '2026-07-17'
supersedes: []
superseded_by: []
related_notes:
  - '[[02_Phases/Phase_04_structured_datasets_and_deterministic_sql/Phase|PHASE-04 Structured Datasets and Deterministic SQL]]'
  - '[[01_Architecture/System_Overview|System Overview]]'
tags:
  - agent-vault
  - decision
  - architecture
---

# DEC-0011 - Gate Releases on a Reproducible 25000-File Evaluation Corpus

## Status

- Current status: accepted.
- Revisit when a linked spike contradicts the selected boundary or the documented promotion/scale criterion is met.

## Context

- The defining scale and trust claims need a reproducible, reviewable corpus that exercises thousands of files, exact answers, recursive analysis, hostile content, schema variation, and recovery without relying on private data.

## Decision

- Maintain a deterministic generator and manifest for approximately 25,000 JSON files with committed seed/specification and versioned ground truth.
- Include exact aggregates, semantic facts, contradictions, missing/corrupt files, schema evolution, duplicates, hostile instructions, and restart/fault scenarios.
- Use the corpus across exact-computation, semantic-retrieval, recursive-analysis, hybrid-research, provenance, prompt-injection, and recovery evaluations.
- Make documented thresholds release-gating from their owning phases through v1.

## Alternatives Considered

- A small hand-written fixture set only — rejected because it cannot expose scale/recovery behavior.
- Commit 25,000 generated files to git — rejected unless storage review proves it preferable; deterministic generation is the default.
- Use production/customer data — rejected because reproducibility, privacy, and distribution suffer.

## Tradeoffs

- Generation and ground-truth maintenance require version discipline.
- Full campaigns cost time and model budget, so tiered smoke/nightly/release suites are needed.

## Consequences

- Phase 00 specifies the corpus; Phase 04 implements it; Phases 06/07/09 expand and gate it.
- Every evaluation artifact records corpus version, seed, code, models, prompts, providers, and dependency versions.
- Ground truth changes require review and a documented reason.

## Related Notes

<!-- AGENT-START:decision-related-notes -->
- Phase: [[02_Phases/Phase_04_structured_datasets_and_deterministic_sql/Phase|PHASE-04 Structured Datasets and Deterministic SQL]]
- Architecture: [[01_Architecture/System_Overview|System Overview]]
- Product requirements: `docs/product-brief.md`
<!-- AGENT-END:decision-related-notes -->

## Change Log

<!-- AGENT-START:decision-change-log -->
- 2026-07-17 - Accepted during greenfield architecture planning; implementation remains gated by the linked phase and spikes.
<!-- AGENT-END:decision-change-log -->
