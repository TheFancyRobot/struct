# Validation Plan

## Acceptance Checks

- The slice for Custom Research Templates and Tool Policies is implemented through typed module boundaries in the planned files (`packages/domain/src/custom-research-template.ts`, `packages/fred-workflows/src/tool-policies.ts`, `apps/web/src/components/CustomTemplateEditor.tsx`...).
- An observable path exists from the new code to the adjacent API, worker, persistence, or UI surface it must support.
- The result advances advanced research depth under explicit tool and policy control without bypassing provenance, bounded execution, or validation expectations.

## Planned Verification

- Run the nearest repo-wide or package-targeted `bun run typecheck` command once the touched packages and apps exist.
- Run targeted unit tests for the domain, service, or adapter code introduced by this step.
- Run an integration flow that exercises the API/worker boundary touched by this step, including failure handling.
- Add a browser, e2e, or component-level verification path for the visible UX behavior named in this step.

## Edge Cases

- Partial progress, retries, or restarts should not leave Custom Research Templates and Tool Policies in an ambiguous state.
- The step should surface unsupported, invalid, or adversarial inputs explicitly instead of silently guessing.
- Cancellation, duplicate actions, and no-progress loops should stop cleanly without duplicating side effects.

## Regression Expectations

- This step should remain a clean successor to [[02_Phases/Phase_13_v1_4_collaboration_and_governance/Steps/Step_03_enforce-audit-retention-and-administrative-controls|STEP-13-03 Enforce Audit Retention and Administrative Controls]] rather than reworking already-planned scope upstream.
- Do not let power-user features bypass budget enforcement, tool allowlists, or citation validation.
- Keep advanced findings compatible with existing notebooks, reports, and governance flows.
- Require evaluation evidence before promoting any new research mode beyond experimental status.

## Security / Observability / Evaluation Focus

- Constrain model/provider experimentation with explicit policy, observability, and rollback hooks.
- Protect multimodal and comparative workflows from silently widening source access or evidence scope.
- Carry advanced-mode evaluations through correctness, recovery, and provenance checks, not just demo quality.

## Related Notes

- Step: [[02_Phases/Phase_14_v1_5_advanced_research/Steps/Step_01_add-custom-research-templates-and-tool-policies|STEP-14-01 Add Custom Research Templates and Tool Policies]]
- Phase: [[02_Phases/Phase_14_v1_5_advanced_research/Phase|Phase 14 v1 5 advanced research]]
