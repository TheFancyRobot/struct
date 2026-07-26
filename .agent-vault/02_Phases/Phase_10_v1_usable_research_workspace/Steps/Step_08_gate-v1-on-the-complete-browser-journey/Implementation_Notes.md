# Implementation Notes

- Capture durable findings learned during execution. Prefer short bullets with file paths, commands, and observed behavior.
- `apps/web/e2e/workspace-release.spec.ts` reuses one Chromium browser, context, and page for root and BASE_PATH scenarios. Each scenario still owns a fresh database reset, artifact root, ports, isolated no-egress data-engine, API, worker, and web stack, with page listeners detached and stacks stopped in `finally`.

## Related Notes

- Step: [[02_Phases/Phase_10_v1_usable_research_workspace/Steps/Step_08_gate-v1-on-the-complete-browser-journey|STEP-10-08 Gate v1 on the Complete Browser Journey]]
- Phase: [[02_Phases/Phase_10_v1_usable_research_workspace/Phase|Phase 10 v1 usable research workspace]]
