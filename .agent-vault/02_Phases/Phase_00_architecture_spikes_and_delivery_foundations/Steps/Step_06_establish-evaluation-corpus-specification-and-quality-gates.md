---
note_type: step
template_version: 2
contract_version: 1
title: Establish Evaluation Corpus Specification and Quality Gates
step_id: STEP-00-06
phase: '[[02_Phases/Phase_00_architecture_spikes_and_delivery_foundations/Phase|Phase 00 architecture spikes and delivery foundations]]'
status: completed
owner: step-00-06-implementor
created: '2026-07-17'
updated: '2026-07-17'
depends_on:
  - '[[02_Phases/Phase_00_architecture_spikes_and_delivery_foundations/Steps/Step_05_specify-security-threat-model-and-trust-boundaries|STEP-00-05 Specify Security Threat Model and Trust Boundaries]]'
related_sessions:
  - '[[05_Sessions/2026-07-17-194019-establish-evaluation-corpus-specification-and-quality-gates-step-00-06-implementor|SESSION-2026-07-17-194019 step-00-06-implementor session for Establish Evaluation Corpus Specification and Quality Gates]]'
related_bugs: []
tags:
  - agent-vault
  - step
context_id: SESSION-2026-07-17-194019
active_session_id: 05_Sessions/2026-07-17-194019-establish-evaluation-corpus-specification-and-quality-gates-step-00-06-implementor
context_status: completed
context_summary: 'Completed [[02_Phases/Phase_00_architecture_spikes_and_delivery_foundations/Steps/Step_06_establish-evaluation-corpus-specification-and-quality-gates|STEP-00-06 Establish Evaluation Corpus Specification and Quality Gates]]: authored docs/evaluation-corpus.md (Phase 0 spec-only; 19 sections, 10 required spec objects, finalized DEF-05 gate-tier thresholds in §11, consumed STEP-00-05 §25 handoff for all 15 ABUSE categories in §10, reproducibility/seed/content-addressing in §13, Phase-4 planned-CLI handoff in §14, pass/fail in §18, reconciliation in §19); back-linked from docs/evaluation-strategy.md; no packages/evaluation or CI created. Validation: rg term-coverage PASS (187 hits), all 15 ABUSE mapped, gate tiers + 100%/0% thresholds present; install/typecheck/tests/corpus-gen N/A (docs-only repo, packages deferred to Phase 04).'
---

# Step 06 - Establish Evaluation Corpus Specification and Quality Gates

Use this note as a thin index for one executable step. Keep detail in companion notes so execution can load only the smallest note needed.

## Purpose

- Outcome: Define the smallest stable contract for Evaluation Corpus Specification and Quality Gates so later implementation can proceed without reopening boundaries around clear product-local Fred boundaries and measurable delivery risks.
- Parent phase: [[02_Phases/Phase_00_architecture_spikes_and_delivery_foundations/Phase|Phase 00 architecture spikes and delivery foundations]].
- Sequencing: start after [[02_Phases/Phase_00_architecture_spikes_and_delivery_foundations/Steps/Step_05_specify-security-threat-model-and-trust-boundaries|STEP-00-05 Specify Security Threat Model and Trust Boundaries]] has a stable outcome or handoff.
- Refined sequencing: corpus-schema drafting may proceed in parallel, but the adversarial fixtures and limits matrix must consume STEP-00-05's finalized handoff.
- Refined scope: produce the Phase 0 specification in `docs/evaluation-corpus.md`; later phases own `packages/evaluation` generator code and CI implementation.

## Required Reading

- [[02_Phases/Phase_00_architecture_spikes_and_delivery_foundations/Phase|Phase 00 architecture spikes and delivery foundations]]
- [[02_Phases/Phase_00_architecture_spikes_and_delivery_foundations/Steps/Step_06_establish-evaluation-corpus-specification-and-quality-gates/Execution_Brief|Execution Brief]]
- [[02_Phases/Phase_00_architecture_spikes_and_delivery_foundations/Steps/Step_06_establish-evaluation-corpus-specification-and-quality-gates/Validation_Plan|Validation Plan]]
- [[01_Architecture/System_Overview|System Overview]]
- [[01_Architecture/Code_Map|Code Map]]
- [[01_Architecture/Agent_Workflow|Agent Workflow]]

## Companion Notes

- [[02_Phases/Phase_00_architecture_spikes_and_delivery_foundations/Steps/Step_06_establish-evaluation-corpus-specification-and-quality-gates/Execution_Brief|Execution Brief]] - Why the step exists, prerequisites, likely code paths, and the smallest execution checklist.
- [[02_Phases/Phase_00_architecture_spikes_and_delivery_foundations/Steps/Step_06_establish-evaluation-corpus-specification-and-quality-gates/Validation_Plan|Validation Plan]] - Acceptance checks, commands, edge cases, and regression expectations.
- [[02_Phases/Phase_00_architecture_spikes_and_delivery_foundations/Steps/Step_06_establish-evaluation-corpus-specification-and-quality-gates/Implementation_Notes|Implementation Notes]] - Durable findings discovered while the step is being executed.
- [[02_Phases/Phase_00_architecture_spikes_and_delivery_foundations/Steps/Step_06_establish-evaluation-corpus-specification-and-quality-gates/Outcome|Outcome]] - Final result, validation evidence, and explicit follow-up.

## Agent-Managed Snapshot

<!-- AGENT-START:step-agent-managed-snapshot -->
- Status: completed
- Current owner: step-00-06-implementor
- Last touched: 2026-07-17
- Next action: Hand off to Phase 04 (implement `packages/evaluation` generator CLI, question loaders, gate evaluator, and CI `corpus:smoke`/`corpus:eval` per `docs/evaluation-corpus.md` §14); Phase 09 hardens/audits.
- Deliverable: `docs/evaluation-corpus.md` (created) + back-link in `docs/evaluation-strategy.md` (edited). No `packages/evaluation`, no `.github/workflows/ci.yml` (spec-only, per Refinement Addendum).
<!-- AGENT-END:step-agent-managed-snapshot -->

## Human Notes

- Keep this step narrow and explicit; planned paths may not exist yet and should be created only when execution begins.

### Refinement Readiness Checklist

- Exact outcome/success: **PASS** — ten specification objects, initial gates, reproducibility rules, and pass/fail are explicit.
- Why it matters: **PASS** — v1 quality claims require deterministic, provenance-aware, adversarial, and scale evidence.
- Prerequisites/dependencies: **PASS** — STEP-00-05's abuse/limits handoff is required while safe parallel drafting is preserved.
- Starting files/commands/tests: **PASS** — `docs/evaluation-corpus.md`, doc checks, and explicitly future generator/test commands are distinguished.
- Required reading: **PASS** — evaluation/security docs, architecture, decisions, product sections, and security handoff are complete.
- Constraints/non-goals: **PASS** — spec-only Phase 0, synthetic data, no provider calls in generation, and no premature package/CI implementation.
- Validation/manual checks: **PASS** — ground truth, provenance, v1/v2 changes, seed/hash, gate tiers, variance, and coverage checks are concrete.
- Edge/failure/recovery: **PASS** — schema drift, rare/contradictory findings, stale citations, retry duplication, flaky metrics, and toy-corpus misuse are covered.
- Security/performance: **PASS** — inert adversarial fixtures, no PII/secrets, 25k scale discipline, and benchmark hardware metadata are explicit.
- Integration/downstream: **PASS** — Phase 4 receives generator CLI/schema/output/gate/artifact requirements.
- Blockers/handoff: **PASS** — missing ground truth/provenance, real sensitive data, model-only deterministic judging, or omitted recovery/security gates fail the step.
- Junior-developer verdict: **PASS — execution-ready.**

## Session History

<!-- AGENT-START:step-session-history -->
- 2026-07-17 - [[05_Sessions/2026-07-17-194019-establish-evaluation-corpus-specification-and-quality-gates-step-00-06-implementor|SESSION-2026-07-17-194019 step-00-06-implementor session for Establish Evaluation Corpus Specification and Quality Gates]] — completed; authored docs/evaluation-corpus.md, finalized DEF-05 gate-tier thresholds, consumed STEP-00-05 §25 handoff.
<!-- AGENT-END:step-session-history -->

## Related Notes

- [[07_Templates/Note_Contracts|Note Contracts]]
- [[07_Templates/Phase_Template|Phase Template]]
