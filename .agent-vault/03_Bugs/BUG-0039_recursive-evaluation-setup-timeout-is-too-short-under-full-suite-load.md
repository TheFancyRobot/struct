---
note_type: bug
template_version: 2
contract_version: 1
title: Recursive evaluation setup timeout is too short under full-suite load
bug_id: BUG-0039
status: fixed
severity: sev-3
category: logic
reported_on: '2026-07-25'
fixed_on: '2026-07-25'
owner: ''
created: '2026-07-25'
updated: '2026-07-25'
related_notes:
  - '[[03_Bugs/BUG-0035_v1-browser-journey-gate-stubs-every-api-route-instead-of-using-the-real-stack|BUG-0035 V1 browser journey gate stubs every API route instead of using the real stack]]'
  - '[[02_Phases/Phase_06_recursive-analysis/Phase|PHASE-06 Recursive Analysis]]'
tags:
  - agent-vault
  - bug
---

# BUG-0039 - Recursive evaluation setup timeout is too short under full-suite load

## Summary

- The Phase 06 25,000-file evaluation times out in its `beforeAll` when run in the full suite, despite passing standalone.

## Observed Behavior

- `bun run test` failed after 62.26s with `25,000-file recursive analysis evaluation > (unnamed) [31508.69ms]` and `a beforeEach/afterEach hook timed out for this test`.
- The test's `beforeAll` runs the expensive evaluation twice but has only a 30,000 ms timeout.
- Standalone root runs passed in 16.65s, 17.18s, 16.67s, and 22.37s, so the test has insufficient headroom for ordinary full-suite resource contention.

## Expected Behavior

- The evaluation test must retain the real repeated 25,000-file gate and finish reliably in the full suite without weakening the evaluation's own measured budget assertions.

## Reproduction Steps

1. Run `bun run test`.
2. Observe the Phase 06 recursive evaluation hook exceed its 30-second timeout under full-suite load.

## Scope / Blast Radius

- Blocks repository-wide validation and BUG-0035 release-gate closure.
- Risks treating host scheduling contention as a product regression rather than preserving the intended evaluation.

## Suspected Root Cause

- The test harness timeout is narrower than the observed full-suite setup duration for two 25,000-file evaluations; it is unrelated to the evaluation report's 600,000 ms product budget.

## Confirmed Root Cause

- `packages/evaluation/test/recursive-analysis.test.ts:37-39` executes two complete evaluations in `beforeAll(..., 30_000)`. The fresh full suite recorded 31,508.69 ms before hook timeout, while repeated focused runs took 16.67–22.37 s. The fixed test harness allowance is too small for normal full-suite load.

## Workaround

- Run the test alone; this does not make the full test gate reliable.

## Permanent Fix Plan

- Increase only the test hook timeout enough for its two real evaluations under full-suite contention. Keep both evaluations, all content assertions, and the product/report budget unchanged.

## Regression Coverage Needed

- The focused recursive evaluation test must pass with both repeated runs still executed.
- `bun run test` must pass without Phase 06 hook timeout.

## Related Notes

<!-- AGENT-START:bug-related-notes -->
- [[03_Bugs/BUG-0035_v1-browser-journey-gate-stubs-every-api-route-instead-of-using-the-real-stack|BUG-0035 V1 browser journey gate stubs every API route instead of using the real stack]]
- [[02_Phases/Phase_06_recursive-analysis/Phase|PHASE-06 Recursive Analysis]]
<!-- AGENT-END:bug-related-notes -->

## Timeline

<!-- AGENT-START:bug-timeline -->
- 2026-07-25 - Reported from full-suite failure: 956 pass, 3 skip, 1 Phase 06 hook timeout.
- 2026-07-25 - Root reproduction passed three focused runs in 17.18s, 16.67s, and 22.37s, confirming that the 30-second timeout has inadequate full-suite headroom rather than that the test has no real work.
- 2026-07-25 - Raised `RECURSIVE_EVALUATION_SETUP_TIMEOUT_MS` from `30_000` to `60_000`, retained both real 25,000-file evaluations and all product/report budget assertions, and added a 60-second headroom assertion. Root focused validation passed (4 pass, 0 fail).
<!-- AGENT-END:bug-timeline -->
