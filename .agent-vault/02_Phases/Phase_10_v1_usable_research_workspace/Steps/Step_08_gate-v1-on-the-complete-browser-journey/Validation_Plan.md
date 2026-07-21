# Validation Plan

- Record the direct validation commands, acceptance checks, edge cases, and regression expectations here.

- Acceptance: typecheck, lint, unit, integration, build, full Playwright, evaluation, security, documentation, and vault doctor are clean; no console errors or failed requests; BUG-0013 verification is reproducible.
- Required Playwright journey: create project → add sources → navigate during upload → observe progress → chat → open exact citation → save/edit note → reload/reopen on desktop and mobile.
- The phase and bug remain open if any confirmed defect exists anywhere in the repository.
- Rollback and recovery: preserve the previous deployable artifact and greenfield drop-recreate procedure; a failed candidate does not advance the release action.

## Related Notes

- Step: [[02_Phases/Phase_10_v1_usable_research_workspace/Steps/Step_08_gate-v1-on-the-complete-browser-journey|STEP-10-08 Gate v1 on the Complete Browser Journey]]
- Phase: [[02_Phases/Phase_10_v1_usable_research_workspace/Phase|Phase 10 v1 usable research workspace]]
