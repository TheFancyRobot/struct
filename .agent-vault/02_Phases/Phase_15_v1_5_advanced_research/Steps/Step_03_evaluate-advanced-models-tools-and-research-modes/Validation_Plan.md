# Validation Plan

## Acceptance Checks

- There is explicit validation evidence for Advanced Models Tools and Research Modes, not just an assertion that the slice should work.
- The step records blocking defects, remediations, and any follow-up work still needed in the planned artifacts (`packages/evaluation/src/advanced-research.ts`, `apps/api/test/advanced-research.integration.test.ts`, `docs/benchmarks/advanced-research.md`...).
- The outcome increases confidence in advanced research depth under explicit tool and policy control and in the next roadmap phase rather than only improving appearances.

## Planned Verification

- Run the nearest repo-wide or package-targeted `bun run typecheck` command once the touched packages and apps exist.
- Run targeted unit tests for the domain, service, or adapter code introduced by this step.
- Make the named integration or scale tests green and capture the exact scenario coverage they provide.
- Run or script the evaluation/benchmark harness for this slice and persist the assumptions behind the numbers.

## Edge Cases

- Partial progress, retries, or restarts should not leave Advanced Models Tools and Research Modes in an ambiguous state.
- The step should surface unsupported, invalid, or adversarial inputs explicitly instead of silently guessing.
- Cancellation, duplicate actions, and no-progress loops should stop cleanly without duplicating side effects.

## Regression Expectations

- This step should remain a clean successor to [[02_Phases/Phase_15_v1_5_advanced_research/Steps/Step_02_add-comparative-longitudinal-and-multimodal-research|STEP-15-02 Add Comparative Longitudinal and Multimodal Research]] rather than reworking already-planned scope upstream.
- Do not let power-user features bypass budget enforcement, tool allowlists, or citation validation.
- Keep advanced findings compatible with existing notebooks, reports, and governance flows.
- Require evaluation evidence before promoting any new research mode beyond experimental status.

## Security / Observability / Evaluation Focus

- Constrain model/provider experimentation with explicit policy, observability, and rollback hooks.
- Protect multimodal and comparative workflows from silently widening source access or evidence scope.
- Carry advanced-mode evaluations through correctness, recovery, and provenance checks, not just demo quality.

## Related Notes

- Step: [[02_Phases/Phase_15_v1_5_advanced_research/Steps/Step_03_evaluate-advanced-models-tools-and-research-modes|STEP-15-03 Evaluate Advanced Models Tools and Research Modes]]
- Phase: [[02_Phases/Phase_15_v1_5_advanced_research/Phase|Phase 15 v1 5 advanced research]]
