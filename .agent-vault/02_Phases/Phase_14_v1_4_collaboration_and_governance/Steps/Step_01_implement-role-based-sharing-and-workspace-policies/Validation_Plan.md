# Validation Plan

## Acceptance Checks

- The slice for Role-Based Sharing and Workspace Policies is implemented through typed module boundaries in the planned files (`packages/domain/src/roles.ts`, `apps/api/src/auth/policies.ts`, `apps/api/src/routes/workspace-members.ts`...).
- An observable path exists from the new code to the adjacent API, worker, persistence, or UI surface it must support.
- The result advances multi-user governance without weakening workspace isolation without bypassing provenance, bounded execution, or validation expectations.

## Planned Verification

- Run the nearest repo-wide or package-targeted `bun run typecheck` command once the touched packages and apps exist.
- Run targeted unit tests for the domain, service, or adapter code introduced by this step.
- Run an integration flow that exercises the API/worker boundary touched by this step, including failure handling.
- Add a browser, e2e, or component-level verification path for the visible UX behavior named in this step.

## Edge Cases

- Partial progress, retries, or restarts should not leave Role-Based Sharing and Workspace Policies in an ambiguous state.
- The step should surface unsupported, invalid, or adversarial inputs explicitly instead of silently guessing.

## Regression Expectations

- This step should remain a clean successor to [[02_Phases/Phase_13_v1_3_continuous_research/Steps/Step_03_add-alerts-staleness-policies-and-operations|STEP-13-03 Add Alerts Staleness Policies and Operations]] rather than reworking already-planned scope upstream.
- Do not let shared projects or comments bypass source, project, or workspace authorization.
- Keep approval/review flows compatible with durable findings and report exports rather than creating side channels.
- Maintain typed policy evaluation so future enterprise identity integrations have a stable seam.

## Security / Observability / Evaluation Focus

- Make every collaboration and admin action auditable, scope-checked, and sanitised for safe operator review.
- Preserve citation-backed evidence access during review instead of copying source data into uncontrolled comment fields.
- Validate retention and deletion behavior before introducing stronger admin powers.

## Related Notes

- Step: [[02_Phases/Phase_14_v1_4_collaboration_and_governance/Steps/Step_01_implement-role-based-sharing-and-workspace-policies|STEP-14-01 Implement Role-Based Sharing and Workspace Policies]]
- Phase: [[02_Phases/Phase_14_v1_4_collaboration_and_governance/Phase|Phase 14 v1 4 collaboration and governance]]
