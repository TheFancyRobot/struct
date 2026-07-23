---
note_type: bug
template_version: 2
contract_version: 1
title: E2E project lifecycle cache test asserts a nonexistent level-two project heading
bug_id: BUG-0033
status: fixed
severity: sev-3
category: logic
reported_on: '2026-07-23'
fixed_on: '2026-07-23'
owner: bug0033-worker
created: '2026-07-23'
updated: '2026-07-23'
related_notes:
  - '[[02_Phases/Phase_10_v1_usable_research_workspace/Steps/Step_01_establish-workspace-and-project-lifecycle|STEP-10-01 Establish Workspace and Project Lifecycle]]'
  - '[[03_Bugs/BUG-0013_v1-ui-lacks-core-research-workflows|BUG-0013 v1 UI lacks core research workflows]]'
tags:
  - agent-vault
  - bug
---

# BUG-0033 - E2E project lifecycle cache test asserts a nonexistent level-two project heading

## Summary

- The project-lifecycle cache-transition browser test asserted a nonexistent level-two project heading and then treated heading visibility as proof that the retry-path cache write had finished.

## Observed Behavior

- `bun test --timeout 60000 apps/web/e2e/project-lifecycle.spec.ts` failed at `apps/web/e2e/project-lifecycle.spec.ts:398` while waiting for `getByRole('heading', { level: 2, name: 'Alpha roadmap' })`.
- After correcting the heading level, the focused test still needed to wait for `localStorage['struct:last-project-id']` on the retry path before asserting the cache update.

## Expected Behavior

- The browser test should assert the real level-one project heading and wait for the retry-path cache write before checking `struct:last-project-id`.

## Reproduction Steps

1. Run `bun test --timeout 60000 apps/web/e2e/project-lifecycle.spec.ts`.
2. Observe the cache-transition case fail at line 398 while waiting for a level-two project heading that the route never renders.

## Scope / Blast Radius

- Affected path: `apps/web/e2e/project-lifecycle.spec.ts`.
- The aggregate project-lifecycle browser suite failed; production code was unaffected.

## Suspected Root Cause

- The cache-transition test drifted from the current project-route markup and used heading visibility where a direct cache-write wait was the real condition under test.

## Confirmed Root Cause

- `apps/web/src/components/ProjectSwitcher.tsx` renders the project name as the route `h1`, but this cache-transition test still asserted `level: 2`.
- On the retry path, the same `h1` can render from the loaded project list before the direct project refetch completes, so heading visibility alone was not a safe proxy for the cache write.

## Workaround

- None. The stale E2E assertions had to be fixed.

## Permanent Fix Plan

- Replace the stale level-two heading assertions with level-one assertions in `apps/web/e2e/project-lifecycle.spec.ts`.
- Wait for `localStorage['struct:last-project-id']` to update before asserting the retry-path cache write.
- Changed paths:
  - `apps/web/e2e/project-lifecycle.spec.ts`

## Regression Coverage Needed

- Focused validation:
  - `bun test --timeout 60000 apps/web/e2e/project-lifecycle.spec.ts -t "updates the cached last project only after successful route loads and preserves the last known good id during outages"`
  - Output: `1 pass`, `10 filtered out`, `0 fail`.

## Related Notes

<!-- AGENT-START:bug-related-notes -->
- [[02_Phases/Phase_10_v1_usable_research_workspace/Steps/Step_01_establish-workspace-and-project-lifecycle|STEP-10-01 Establish Workspace and Project Lifecycle]]
- [[03_Bugs/BUG-0013_v1-ui-lacks-core-research-workflows|BUG-0013 v1 UI lacks core research workflows]]
<!-- AGENT-END:bug-related-notes -->

## Timeline

<!-- AGENT-START:bug-timeline -->
- 2026-07-23 - Reported.
- 2026-07-23 - Reproduced with `bun test --timeout 60000 apps/web/e2e/project-lifecycle.spec.ts` (`10 pass`, `1 fail`).
- 2026-07-23 - Fixed `apps/web/e2e/project-lifecycle.spec.ts` and revalidated the focused cache-transition case (`1 pass`, `0 fail`).
<!-- AGENT-END:bug-timeline -->
