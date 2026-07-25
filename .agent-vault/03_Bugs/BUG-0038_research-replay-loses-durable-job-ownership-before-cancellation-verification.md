---
note_type: bug
template_version: 2
contract_version: 1
title: Research replay loses durable job ownership before cancellation verification
bug_id: BUG-0038
status: fixed
severity: sev-2
category: logic
reported_on: '2026-07-25'
fixed_on: '2026-07-25'
owner: ''
created: '2026-07-25'
updated: '2026-07-25'
related_notes:
  - '[[03_Bugs/BUG-0035_v1-browser-journey-gate-stubs-every-api-route-instead-of-using-the-real-stack|BUG-0035 V1 browser journey gate stubs every API route instead of using the real stack]]'
  - '[[02_Phases/Phase_05_research-workflow/Phase|PHASE-05 Research Workflow]]'
tags:
  - agent-vault
  - bug
---

# BUG-0038 - Research replay loses durable job ownership before cancellation verification

## Summary

- The live research replay integration test can transition its durable run out of `in-progress` before it verifies cancellation recovery, leaving checkpoints and cancellation acknowledgements unable to retain job ownership.

## Observed Behavior

- An earlier full-suite and standalone run reported a provider timeout then `Expected: "acknowledged"; Received: "none"` at the cancellation restart assertion.
- A root standalone reproduction on 2026-07-25 instead failed earlier with `ResearchJobOwnershipLostError: Research job no longer has in-progress ownership` from `ResearchExecutionRepo.persistCheckpoint`; logs showed the same durable run had `terminalStatus: "failed"`.

## Expected Behavior

- The replay fixture must preserve an in-progress owned job until it deliberately exercises cancellation. Its model/provider failure probe must not make later checkpoint or cancellation assertions race a terminal durable state.

## Reproduction Steps

1. Run `bun test --timeout 30000 apps/worker/test/research-replay.integration.test.ts`.
2. Observe either the cancellation durability assertion fail (`acknowledged` vs `none`) or the earlier fenced checkpoint write fail with `ResearchJobOwnershipLostError` after the run has reached `failed`.

## Scope / Blast Radius

- Blocks the repository-wide test suite and release-gate closure.
- Makes Phase 05 durable-recovery evidence nondeterministic, obscuring whether cancellation and restart fencing actually work.

## Suspected Root Cause

- The test combines restart recovery, real sidecar failure, a deliberately unavailable model-provider probe, and cancellation under one static durable run/job identity. One probe may terminally fail that identity before the cancellation transition, violating the ownership precondition enforced by `ResearchExecutionRepo.persistCheckpoint`.

## Confirmed Root Cause

- Investigation pending. The ownership fence is proven to reject writes once `job_queue.status` or `research_runs.status` is no longer `in-progress` (`packages/persistence/src/repositories/research-execution.ts:347-360`), and the reproduction logged `terminalStatus: "failed"` before the failed checkpoint.
- Update 2026-07-25 (bug-0038-attempt-1): the replay fixture itself seeded `research_runs` and `job_queue` with a hard-coded 2024 `updated_at` (`const now = 1_721_430_000_000n` in `apps/worker/test/research-replay.integration.test.ts`). Any live worker polling the shared database could immediately classify that in-progress job as stale via `ResearchExecutionRepo.recoverStale`, which atomically set `job_queue.status`, `research_runs.status`, and `research_run_control.terminal_status` to `failed` before the test reached its cancellation assertions.
- Evidence: adding `expect(await runRepo(sql, ResearchExecutionRepo.recoverStale(300_000))).toEqual([])` at the start of the replay test failed before the fix because it returned the replay job as recovered stale ownership. After changing the fixture timestamp to `BigInt(Date.now())`, the same assertion passed and the durable state after the model-provider failure probe still reported `cancellationStatus: 'none'` with no terminal status.

## Workaround

- No reliable workaround: the test's failure variability means it cannot be accepted as release evidence.

## Permanent Fix Plan

- Trace the exact terminal transition and isolate the model-provider failure probe from the cancellation/restart identity or otherwise retain the fixture's required ownership invariants. Add deterministic regression coverage for the resolved scenario.

## Regression Coverage Needed

- A focused run must consistently pass the full replay/cancellation sequence without terminal-state races.
- The test must prove the provider-failure probe without mutating the durable identity used for cancellation recovery.
- Full `bun run test` must pass before BUG-0035 is reconsidered for closure.

## Related Notes

<!-- AGENT-START:bug-related-notes -->
- [[03_Bugs/BUG-0035_v1-browser-journey-gate-stubs-every-api-route-instead-of-using-the-real-stack|BUG-0035 V1 browser journey gate stubs every API route instead of using the real stack]]
- [[02_Phases/Phase_05_research-workflow/Phase|PHASE-05 Research Workflow]]
<!-- AGENT-END:bug-related-notes -->

## Timeline

<!-- AGENT-START:bug-timeline -->
- 2026-07-25 - Reported after BUG-0035 full-suite validation exposed a standalone `research-replay.integration.test.ts` failure.
- 2026-07-25 - Root reproduction (`bun test --timeout 30000 apps/worker/test/research-replay.integration.test.ts`) failed with `ResearchJobOwnershipLostError` from `persistCheckpoint`; preceding durable-state log showed `terminalStatus: "failed"`.
- 2026-07-25 - Root cause confirmed: the fixture's fixed 2024 `updated_at` let a live worker classify its static in-progress job as stale and terminally fail it before cancellation assertions.
- 2026-07-25 - Fixed with a current fixture timestamp, a stale-recovery precondition, and a post-provider-failure nonterminal-state assertion; focused replay validation passed twice.
- 2026-07-25 - Regenerated `v1-performance-resilience-v1.json` after its replay evidence SHA changed; root focused report validation passed (3 pass, 0 fail). Independent review found no blocking issue.
<!-- AGENT-END:bug-timeline -->
