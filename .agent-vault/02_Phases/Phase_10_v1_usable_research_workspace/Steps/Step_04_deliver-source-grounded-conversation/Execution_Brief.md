# Execution Brief

- Record why the step exists, prerequisites, likely code paths, and the smallest execution checklist here.

- Prerequisite: STEP-10-03 exposes ready immutable source versions and durable activity state.
- Required reading: Agent Workflow; Phase 05–07; DEC-0008 and DEC-0010; research routes, event/cancel APIs, ResearchStream, and the SSE hook.
- Starting files: `packages/domain/src/research-execution.ts`, `packages/domain/src/research-events.ts`, `packages/persistence/src/repositories/research-execution.ts`, `apps/api/src/routes/research*.ts`, `apps/web/src/api/research.ts`, and `apps/web/src/components/ResearchStream.tsx`.
- Checklist: expose thread history; create/continue runs; select ready versions; stream committed events; preserve drafts and output across panes, routes, and reconnects; implement every honest state; remove fixture dependence from the primary route.
- Edge cases: no ready sources, a source becoming ready, stale selection, duplicate submit, cursor replay, cancel/retry, partial committed output, provider failure, and reload during a run.

## Related Notes

- Step: [[02_Phases/Phase_10_v1_usable_research_workspace/Steps/Step_04_deliver-source-grounded-conversation|STEP-10-04 Deliver Source Grounded Conversation]]
- Phase: [[02_Phases/Phase_10_v1_usable_research_workspace/Phase|Phase 10 v1 usable research workspace]]
