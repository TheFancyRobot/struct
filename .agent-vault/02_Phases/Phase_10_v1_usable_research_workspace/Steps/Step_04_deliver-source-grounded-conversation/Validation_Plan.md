# Validation Plan

- Record the direct validation commands, acceptance checks, edge cases, and regression expectations here.

- Acceptance: ask during background ingestion, use only ready versions, stream progress, reload/reconnect without duplicate events, and continue the thread.
- Direct checks: API client tests, research integration tests, component state tests, SSE replay tests, and Playwright conversation flow.
- Regression: bounded execution, tool authorization, citation validation, and research evaluation gates remain green.

## Related Notes

- Step: [[02_Phases/Phase_10_v1_usable_research_workspace/Steps/Step_04_deliver-source-grounded-conversation|STEP-10-04 Deliver Source Grounded Conversation]]
- Phase: [[02_Phases/Phase_10_v1_usable_research_workspace/Phase|Phase 10 v1 usable research workspace]]
