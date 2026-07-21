# Execution Brief

## Exact Outcome

- Validate and harden Advanced Models Tools and Research Modes with explicit evidence, remaining gaps, and next actions before the roadmap moves past v1.5 Advanced Research.

## Prerequisites

- Re-read [[02_Phases/Phase_15_v1_5_advanced_research/Phase|Phase 15 v1 5 advanced research]] and confirm the step still matches the current roadmap sequence.
- Confirm the handoff from [[02_Phases/Phase_15_v1_5_advanced_research/Steps/Step_02_add-comparative-longitudinal-and-multimodal-research|STEP-15-02 Add Comparative Longitudinal and Multimodal Research]] before widening scope.
- Keep deterministic work in typed Effect services, repositories, and tools; reserve Fred for agentic orchestration only.
- Treat the listed files as planned starting points; create only the smallest set needed to land the slice.

## Planned Starting Files

- These paths may not exist yet; use them as the first bounded implementation or design surface.
- `packages/evaluation/src/advanced-research.ts`
- `apps/api/test/advanced-research.integration.test.ts`
- `docs/benchmarks/advanced-research.md`
- `docs/operations/advanced-research-modes.md`

## Required Reading

- [[02_Phases/Phase_15_v1_5_advanced_research/Phase|Phase 15 v1 5 advanced research]]
- [[01_Architecture/Agent_Workflow|Agent Workflow]]
- [[01_Architecture/Domain_Model|Domain Model]]
- [[01_Architecture/System_Overview|System Overview]]
- [[02_Phases/Phase_15_v1_5_advanced_research/Steps/Step_02_add-comparative-longitudinal-and-multimodal-research|STEP-15-02 Add Comparative Longitudinal and Multimodal Research]]
- `docs/product-brief.md` sections 13-17, 20-25, 28-29, and 31.

## Smallest Bounded Checklist

- Assemble the representative success, failure, recovery, and adversarial scenarios for this slice.
- Run or script the targeted checks called out in the validation plan and collect durable evidence.
- Remediate blocking issues that belong in-scope or record precise follow-ups for work that does not.
- Avoid net-new feature scope while closing the validation and hardening pass.

## Constraints and Non-Goals

- Advanced modes must still route exact computation to deterministic tooling and preserve explicit evidence boundaries.
- Custom templates and tool policies need typed enforcement rather than prompt-only conventions.
- Multimodal or longitudinal analysis should extend provenance, not weaken it.

## Related Notes

- Step: [[02_Phases/Phase_15_v1_5_advanced_research/Steps/Step_03_evaluate-advanced-models-tools-and-research-modes|STEP-15-03 Evaluate Advanced Models Tools and Research Modes]]
- Phase: [[02_Phases/Phase_15_v1_5_advanced_research/Phase|Phase 15 v1 5 advanced research]]
