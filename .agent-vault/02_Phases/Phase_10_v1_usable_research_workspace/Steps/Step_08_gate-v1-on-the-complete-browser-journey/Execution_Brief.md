# Execution Brief

- Record why the step exists, prerequisites, likely code paths, and the smallest execution checklist here.

- Prerequisite: STEP-10-01 through STEP-10-07 complete and green.
- Required reading: Phase 09 release evidence and checklist; BUG-0013; approved design; all Phase 10 outcomes.
- Starting files: `apps/web/e2e/`, Playwright support, README, local-development and release-checklist docs, demo screenshots, and root HomePage/fixture routes.
- Checklist: add the deterministic release journey; run desktop and mobile; delete the fixture-driven primary route; update docs and real-state screenshots; record exact evidence; audit all known defects.
- Edge cases: cold start, dependency restart, slow upload, partial failure/retry, SSE reconnect, refresh at each stage, mobile sheets, dark theme, and browser console/network failures.
- Release rule: component demos, mocked fixtures, or direct API calls cannot substitute for the browser journey.

## Related Notes

- Step: [[02_Phases/Phase_10_v1_usable_research_workspace/Steps/Step_08_gate-v1-on-the-complete-browser-journey|STEP-10-08 Gate v1 on the Complete Browser Journey]]
- Phase: [[02_Phases/Phase_10_v1_usable_research_workspace/Phase|Phase 10 v1 usable research workspace]]
