---
note_type: bug
template_version: 2
contract_version: 1
title: Workspace responsive e2e test retains obsolete project-gated source action contract
bug_id: BUG-0050
status: fixed
severity: sev-3
category: logic
reported_on: '2026-07-26'
fixed_on: '2026-07-26'
owner: bug-0050-implementer
created: '2026-07-26'
updated: '2026-07-26'
related_notes:
  - '[[02_Phases/Phase_10_v1_usable_research_workspace/Steps/Step_09_make-source-registration-workspace-scoped|STEP-10-09 Make Source Registration Workspace Scoped]]'
tags:
  - agent-vault
  - bug
---

# BUG-0050 - Workspace responsive e2e test retains obsolete project-gated source action contract

Use one note per bug. Capture reproduction, impact, root cause, workaround, and verification, then link back to the relevant phase, step, decision, or session. See [[07_Templates/Note_Contracts|Note Contracts]].

## Summary

- Workspace responsive e2e test retains obsolete project-gated source action contract.
- Related notes: [[02_Phases/Phase_10_v1_usable_research_workspace/Steps/Step_09_make-source-registration-workspace-scoped|STEP-10-09 Make Source Registration Workspace Scoped]].

## Observed Behavior

- Describe what actually happens.
- The e2e contract in `apps/web/e2e/workspace-responsive.spec.ts` (test "exposes creation actions with project-aware source availability on desktop and mobile") asserted a project-gated "Add source" action: a disabled `<button aria-describedby="add-source-requirement">`, a `#add-source-requirement` notice ("Open a project to view its sources."), and a project-scoped href `/projects/{id}/sources#source-import-heading` once a project opened.
- Running the focused spec failed at `disabledAddSource.isDisabled()` with a 30s timeout because no "Add source" button exists in production anymore.

## Expected Behavior

- Describe what should happen instead.
- Source registration is workspace-scoped ([[02_Phases/Phase_10_v1_usable_research_workspace/Steps/Step_09_make-source-registration-workspace-scoped|STEP-10-09]] / [[03_Bugs/BUG-0046_global-source-import-is-blocked-by-project-selection|BUG-0046]]): "Add source" is always an enabled link to the global source library at `/sources#source-import-heading`, with no project gate, no disabled button, and no requirement notice — whether or not a project is open.
- The unit test `apps/web/src/components/workspace/workspace-shell.test.tsx` already encodes this contract (`expect(html).toContain('href="/sources#source-import-heading"')` and `expect(html).toContain('Add source')`), so the e2e spec was the stale artifact.

## Reproduction Steps

1. List the exact setup state.
2. List the user or developer actions.
3. Record the observed result.
1. From the repo root run `bun test --timeout 90000 --max-concurrency 1 ./apps/web/e2e/workspace-responsive.spec.ts` (web-only build + Chromium; API responses are mocked via `page.route`, so no API/worker/postgres stack is required).
2. Observe the first test fail: `navigation.getByRole('button', { name: 'Add source' })` matches nothing, so `.isDisabled()` times out.

## Scope / Blast Radius

- List affected packages, commands, integrations, environments, or users.

## Suspected Root Cause

- Record current theories and assumptions.

## Confirmed Root Cause

- Record the proven cause and decisive evidence.
- STEP-10-09 made source registration workspace-scoped and changed the navigation "Add source" affordance from a project-gated disabled button to an always-enabled global link (`apps/web/src/components/workspace/WorkspaceShell.tsx`: `<a href="/sources#source-import-heading">Add source</a>`), removing `#add-source-requirement` entirely.
- The workspace-responsive e2e spec was never updated to match, and it was excluded from STEP-10-09's validation (`bun run test` ignores `**/e2e/**`), so the stale contract slipped through. A repo-wide grep confirms `add-source-requirement` exists only in this spec, nowhere in production.
- Scope / blast radius: the stale contract was confined to the first test of `apps/web/e2e/workspace-responsive.spec.ts`; no production code was changed.

## Workaround

- Describe any temporary mitigation and remaining risk.

## Permanent Fix Plan

- Describe the intended durable fix.
- DONE (test-only; no production change to the BUG-0050 source-action contract): updated the first test in `apps/web/e2e/workspace-responsive.spec.ts` to assert the workspace-scoped contract — "Add source" is an enabled link to `/sources#source-import-heading`, no "Add source" button exists (`count() === 0`), no `#add-source-requirement` element exists (`count() === 0`), the link stays pointed at the global library when a project is open, and the 44px touch-target plus desktop/mobile navigation contracts are preserved. Renamed the test to "exposes creation actions with workspace-scoped source availability on desktop and mobile".
- BUG-0050 changed file: `apps/web/e2e/workspace-responsive.spec.ts` (only). The BUG-0050 workspace-scoped source-action contract was not altered in production — the "Add source" affordance stays an always-enabled global link to `/sources#source-import-heading` with no project gate, per scope. (The PR separately touched `apps/web/src/components/workspace/WorkspaceShell.tsx` for BUG-0051's touch-target sizing only; that change does not alter the source-action contract — see below.)
- SEPARATE DEFECT, now also fixed by this PR (filed as [[03_Bugs/BUG-0051_manage-source-library-navigation-link-misses-the-44px-touch-target-minimum|BUG-0051]]): the "Manage source library" fallback link (`apps/web/src/components/workspace/WorkspaceShell.tsx`: `<a class="link px-2 text-xs" href="/sources">Manage source library</a>`, added by STEP-10-09) was <44px tall and failed the shell's "all visible controls >=44px" accessibility invariant in the same spec's test "keeps one ordered, overflow-free shell at every target width and theme" (`undersizedControls` received `["Manage source library"]`). The PR additionally fixed BUG-0051 by adding the `min-h-11` 44px touch-target token (plus `inline-flex items-center`) to that fallback link in `WorkspaceShell.tsx` — a behavior-preserving sizing change that does NOT alter the BUG-0050 workspace-scoped source-action contract (destination `/sources` and plain-link behavior unchanged; the "Add source" link and its `/sources#source-import-heading` href are untouched).

## Regression Coverage Needed

- List tests, fixtures, reproductions, alerts, or docs updates needed.
- DONE: the corrected test pins the workspace-scoped source-action contract (enabled global link, no disabled button, no requirement notice, href stable across project states, 44px touch target). Baseline run before the fix: 5 pass / 2 fail (the BUG-0050 test failed at the disabled-button assertion). After the BUG-0050 test-only fix: `bun test --timeout 90000 --max-concurrency 1 ./apps/web/e2e/workspace-responsive.spec.ts` -> 6 pass / 1 fail; the BUG-0050 test passed, with the only remaining failure being the separate "Manage source library" touch-target defect.
- After the PR additionally fixed BUG-0051's WorkspaceShell touch target, the focused responsive e2e suite now passes 7 / 0 (7 pass, 0 fail) — including the "keeps one ordered, overflow-free shell at every target width and theme" case that guards the 44px touch-target invariant. The BUG-0050 workspace-scoped source-action contract remains pinned by its own test.
- Follow-up: consider running the e2e suite in the phase/step validation gate (it is currently excluded via `--path-ignore-patterns='**/e2e/**'`) so source-scope contract drift is caught earlier. (The prior "add coverage for the new bug's touch target" follow-up is resolved — BUG-0051 is fixed and the existing 44px assertion is its red→green guard.)

## Related Notes

<!-- AGENT-START:bug-related-notes -->
- Phase: [[02_Phases/Phase_10_v1_usable_research_workspace/Phase|Phase 10 v1 usable research workspace]]
- Step: [[02_Phases/Phase_10_v1_usable_research_workspace/Steps/Step_09_make-source-registration-workspace-scoped|STEP-10-09 Make Source Registration Workspace Scoped]]
<!-- AGENT-END:bug-related-notes -->

## Timeline

<!-- AGENT-START:bug-timeline -->
- 2026-07-26 - Reported.
<!-- AGENT-END:bug-timeline -->
- 2026-07-26 — Fixed (test-only): replaced the first test's stale project-gated "Add source" contract with the workspace-scoped enabled-link contract; verified the focused spec passes for BUG-0050. Surfaced a separate defect (undersized "Manage source library" touch target) and escalated it for a new bug. Production source-action behavior unchanged; no git commands run.
- 2026-07-26 — Final state (review remediation): the PR additionally fixed [[03_Bugs/BUG-0051_manage-source-library-navigation-link-misses-the-44px-touch-target-minimum|BUG-0051]]'s "Manage source library" WorkspaceShell touch target (added the `min-h-11` 44px token plus `inline-flex items-center` in `WorkspaceShell.tsx`, behavior-preserving). The focused responsive e2e suite now passes 7 / 0. The BUG-0050 workspace-scoped source-action contract is preserved and remains pinned by its own test; BUG-0051's change did not alter it.
