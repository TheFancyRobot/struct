# Execution Brief

## Exact Outcome

- Implement the smallest coherent slice for Comparative Longitudinal and Multimodal Research that advances v1.5 Advanced Research while preserving advanced research depth under explicit tool and policy control.

## Prerequisites

- Re-read [[02_Phases/Phase_15_v1_5_advanced_research/Phase|Phase 15 v1 5 advanced research]] and confirm the step still matches the current roadmap sequence.
- Confirm the handoff from [[02_Phases/Phase_15_v1_5_advanced_research/Steps/Step_01_add-custom-research-templates-and-tool-policies|STEP-15-01 Add Custom Research Templates and Tool Policies]] before widening scope.
- Keep deterministic work in typed Effect services, repositories, and tools; reserve Fred for agentic orchestration only.
- Treat the listed files as planned starting points; create only the smallest set needed to land the slice.

## Planned Starting Files

- These paths may not exist yet; use them as the first bounded implementation or design surface.
- `packages/research-engine/src/comparative-analysis.ts`
- `packages/research-engine/src/longitudinal-analysis.ts`
- `packages/research-engine/src/multimodal-citations.ts`
- `apps/api/src/routes/advanced-research.ts`

## Required Reading

- [[02_Phases/Phase_15_v1_5_advanced_research/Phase|Phase 15 v1 5 advanced research]]
- [[01_Architecture/Agent_Workflow|Agent Workflow]]
- [[01_Architecture/Domain_Model|Domain Model]]
- [[01_Architecture/System_Overview|System Overview]]
- [[02_Phases/Phase_15_v1_5_advanced_research/Steps/Step_01_add-custom-research-templates-and-tool-policies|STEP-15-01 Add Custom Research Templates and Tool Policies]]
- `docs/product-brief.md` sections 13-17, 20-25, 28-29, and 31.

## Smallest Bounded Checklist

- Extend typed plans and evidence unions for explicit version/time comparisons and selected image/diagram evidence without changing existing citation semantics.
- Use deterministic alignment, version diffs, metadata extraction, and exact computation before invoking specialized Fred agents or multimodal providers.
- Preserve model/provider limitations, source locations, derived artifacts, comparisons, and counterevidence at claim level.
- Add modality-specific fixtures and evaluate temporal correctness, accessibility, safety, cost, fallback, provenance, and unsupported-content behavior.

## Constraints and Non-Goals

- Advanced modes must still route exact computation to deterministic tooling and preserve explicit evidence boundaries.
- Custom templates and tool policies need typed enforcement rather than prompt-only conventions.
- Multimodal or longitudinal analysis should extend provenance, not weaken it.

## Related Notes

- Step: [[02_Phases/Phase_15_v1_5_advanced_research/Steps/Step_02_add-comparative-longitudinal-and-multimodal-research|STEP-15-02 Add Comparative Longitudinal and Multimodal Research]]
- Phase: [[02_Phases/Phase_15_v1_5_advanced_research/Phase|Phase 15 v1 5 advanced research]]
