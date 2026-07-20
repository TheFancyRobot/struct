# Execution Brief

## Exact Outcome

- Produce the concrete contracts, artifacts, and bounded implementation/design surfaces for Hybrid Synthesis with Quantitative Guardrails that this step is responsible for before any broader follow-on work begins.

## Prerequisites

- Re-read [[02_Phases/Phase_07_hybrid_cross_source_research/Phase|Phase 07 hybrid cross source research]] and confirm the step still matches the current roadmap sequence.
- Confirm the handoff from [[02_Phases/Phase_07_hybrid_cross_source_research/Steps/Step_03_normalize-and-reconcile-cross-source-evidence|STEP-07-03 Normalize and Reconcile Cross-Source Evidence]] before widening scope.
- Keep deterministic work in typed Effect services, repositories, and tools; reserve Fred for agentic orchestration only.
- Treat the listed files as planned starting points; create only the smallest set needed to land the slice.

## Planned Starting Files

- These paths may not exist yet; use them as the first bounded implementation or design surface.
- `packages/workflows/src/agents/answer-synthesizer.ts`
- `packages/research-engine/src/quantitative-guardrails.ts`
- `packages/data-engine/src/result-summary.ts`
- `packages/research-engine/src/hybrid-synthesis.ts`

## Required Reading

- [[02_Phases/Phase_07_hybrid_cross_source_research/Phase|Phase 07 hybrid cross source research]]
- [[01_Architecture/Agent_Workflow|Agent Workflow]]
- [[01_Architecture/Domain_Model|Domain Model]]
- [[01_Architecture/System_Overview|System Overview]]
- [[02_Phases/Phase_07_hybrid_cross_source_research/Steps/Step_03_normalize-and-reconcile-cross-source-evidence|STEP-07-03 Normalize and Reconcile Cross-Source Evidence]]
- `docs/product-brief.md` sections 9, 11-18, 22-24, 26-27, and 29-31.

## Concrete Deliverables

- Implement the narrowest typed slice for Hybrid Synthesis with Quantitative Guardrails that is callable by the next step without broadening scope.
- Land the data-engine boundary in `packages/data-engine/src/result-summary.ts` with deterministic execution, explicit limits, and source-linked outputs.
- Capture the orchestration or synthesis rules in `packages/research-engine/src/quantitative-guardrails.ts`, `packages/research-engine/src/hybrid-synthesis.ts` without moving deterministic work out of services/tools.
- Keep Fred-specific graph/agent wiring isolated to `packages/workflows/src/agents/answer-synthesizer.ts` and typed at every boundary.

## Smallest Bounded Checklist

- First, implement the narrowest typed slice for Hybrid Synthesis with Quantitative Guardrails that is callable by the next step without broadening scope.
- Then, land the data-engine boundary in `packages/data-engine/src/result-summary.ts` with deterministic execution, explicit limits, and source-linked outputs.
- Next, capture the orchestration or synthesis rules in `packages/research-engine/src/quantitative-guardrails.ts`, `packages/research-engine/src/hybrid-synthesis.ts` without moving deterministic work out of services/tools.
- Finish by leaving one observable typed path—test, route, worker flow, or UI state—that proves the slice is ready for the next dependent step.

## Constraints and Non-Goals

- Hybrid research must route exact questions to deterministic tools and use semantic analysis only where judgment is actually needed.
- Cross-source synthesis should preserve the distinction between computed facts, retrieved claims, inferences, contradictions, and limitations.
- Representative records, document evidence, and final citations must stay explorable in the UI and report layers.

## Related Notes

- Step: [[02_Phases/Phase_07_hybrid_cross_source_research/Steps/Step_04_build-hybrid-synthesis-with-quantitative-guardrails|STEP-07-04 Build Hybrid Synthesis with Quantitative Guardrails]]
- Phase: [[02_Phases/Phase_07_hybrid_cross_source_research/Phase|Phase 07 hybrid cross source research]]

## Refined Implementation Boundary — 2026-07-20

This supersedes the earlier generic file suggestions.

- Synthesize only from STEP-07-03 typed evidence. Quantitative claims come deterministically from validated query snapshots; the model may explain but never recalculate, alter, invent, or uncite.
- Extend current answer, citation validation, critic, synthesis, artifact, budget, and routing surfaces; add no redundant result-summary layer when snapshots already contain exact values.
- Narrative claims cite source locators, quantitative claims cite dataset/query snapshots/hashes/ranges, and combined claims retain both. Contradiction/insufficiency prevents an unqualified conclusion.
- Keep Fred wiring in workflows and deterministic guardrails in domain/research-engine/tools. Apply current Effect patterns plus `effect-ts`/`effect-best-practices`.
- Persist the answer only after guardrails and citation validation pass.
