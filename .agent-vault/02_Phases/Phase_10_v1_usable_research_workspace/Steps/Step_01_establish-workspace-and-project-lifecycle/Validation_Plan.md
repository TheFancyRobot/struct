# Validation Plan

- Record the direct validation commands, acceptance checks, edge cases, and regression expectations here.

- Acceptance: empty browser → create project → selected canonical route → reload → same project reopens; unauthorized workspaces remain indistinguishable from missing resources.
- Direct checks: focused domain tests, persistence integration tests, API authorization/validation tests, Solid state tests, and a Playwright first-project flow.
- Regression: existing authorization, health/readiness, base-path routing, and research API tests remain green.

## Related Notes

- Step: [[02_Phases/Phase_10_v1_usable_research_workspace/Steps/Step_01_establish-workspace-and-project-lifecycle|STEP-10-01 Establish Workspace and Project Lifecycle]]
- Phase: [[02_Phases/Phase_10_v1_usable_research_workspace/Phase|Phase 10 v1 usable research workspace]]
