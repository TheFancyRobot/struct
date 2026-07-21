# Validation Plan

- Record the direct validation commands, acceptance checks, edge cases, and regression expectations here.

- Acceptance: add multiple sources, navigate immediately, keep ready sources usable, reopen progress, recover partial failure, and preserve job truth across reload/reconnect.
- Direct checks: domain, API, and repository tests for validation, idempotency, isolation, limits, and event replay; component tests for every activity state; Playwright background-upload flow.
- Accessibility: progress uses polite live announcements, never steals focus, and failures remain actionable.

## Related Notes

- Step: [[02_Phases/Phase_10_v1_usable_research_workspace/Steps/Step_03_deliver-source-catalog-and-non-blocking-import|STEP-10-03 Deliver Source Catalog and Non Blocking Import]]
- Phase: [[02_Phases/Phase_10_v1_usable_research_workspace/Phase|Phase 10 v1 usable research workspace]]
