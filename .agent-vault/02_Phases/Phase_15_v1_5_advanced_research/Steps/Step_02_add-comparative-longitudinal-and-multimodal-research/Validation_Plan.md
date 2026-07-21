# Validation Plan

## Acceptance Checks

- The slice for Comparative Longitudinal and Multimodal Research is implemented through typed module boundaries in the planned files (`packages/research-engine/src/comparative-analysis.ts`, `packages/research-engine/src/longitudinal-analysis.ts`, `packages/research-engine/src/multimodal-citations.ts`...).
- An observable path exists from the new code to the adjacent API, worker, persistence, or UI surface it must support.
- The result advances advanced research depth under explicit tool and policy control without bypassing provenance, bounded execution, or validation expectations.

## Planned Verification

- Run the nearest repo-wide or package-targeted `bun run typecheck` command once the touched packages and apps exist.
- Run targeted unit tests for the domain, service, or adapter code introduced by this step.
- Run an integration flow that exercises the API/worker boundary touched by this step, including failure handling.

## Edge Cases

- Partial progress, retries, or restarts should not leave Comparative Longitudinal and Multimodal Research in an ambiguous state.
- The step should surface unsupported, invalid, or adversarial inputs explicitly instead of silently guessing.
- Cancellation, duplicate actions, and no-progress loops should stop cleanly without duplicating side effects.

## Regression Expectations

- This step should remain a clean successor to [[02_Phases/Phase_15_v1_5_advanced_research/Steps/Step_01_add-custom-research-templates-and-tool-policies|STEP-15-01 Add Custom Research Templates and Tool Policies]] rather than reworking already-planned scope upstream.
- Do not let power-user features bypass budget enforcement, tool allowlists, or citation validation.
- Keep advanced findings compatible with existing notebooks, reports, and governance flows.
- Require evaluation evidence before promoting any new research mode beyond experimental status.

## Security / Observability / Evaluation Focus

- Constrain model/provider experimentation with explicit policy, observability, and rollback hooks.
- Protect multimodal and comparative workflows from silently widening source access or evidence scope.
- Carry advanced-mode evaluations through correctness, recovery, and provenance checks, not just demo quality.

## Related Notes

- Step: [[02_Phases/Phase_15_v1_5_advanced_research/Steps/Step_02_add-comparative-longitudinal-and-multimodal-research|STEP-15-02 Add Comparative Longitudinal and Multimodal Research]]
- Phase: [[02_Phases/Phase_15_v1_5_advanced_research/Phase|Phase 15 v1 5 advanced research]]
