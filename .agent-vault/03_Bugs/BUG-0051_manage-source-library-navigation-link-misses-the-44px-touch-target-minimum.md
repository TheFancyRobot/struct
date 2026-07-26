---
note_type: bug
template_version: 2
contract_version: 1
title: Manage source library navigation link misses the 44px touch-target minimum
bug_id: BUG-0051
status: fixed
severity: sev-3
category: logic
reported_on: '2026-07-26'
fixed_on: '2026-07-26'
owner: bug-0051-implementer
created: '2026-07-26'
updated: '2026-07-26'
related_notes:
  - '[[02_Phases/Phase_10_v1_usable_research_workspace/Steps/Step_09_make-source-registration-workspace-scoped|STEP-10-09 Make Source Registration Workspace Scoped]]'
tags:
  - agent-vault
  - bug
---

# BUG-0051 - Manage source library navigation link misses the 44px touch-target minimum

Use one note per bug. Capture reproduction, impact, root cause, workaround, and verification, then link back to the relevant phase, step, decision, or session. See [[07_Templates/Note_Contracts|Note Contracts]].

## Summary

- Manage source library navigation link misses the 44px touch-target minimum.
- Related notes: [[02_Phases/Phase_10_v1_usable_research_workspace/Steps/Step_09_make-source-registration-workspace-scoped|STEP-10-09 Make Source Registration Workspace Scoped]].

## Observed Behavior

- Describe what actually happens.
- On the workspace shell with no project open (`state.projectId() === null`), the Sources section renders a fallback "Manage source library" link styled only with `link px-2 text-xs`, producing a rendered height of roughly 12px (text-xs line box + `px-2` horizontal padding, no vertical sizing token).
- The workspace-responsive e2e spec "keeps one ordered, overflow-free shell at every target width and theme" enumerates every visible `.app-shell button:not([disabled]), .app-shell a[href]` and asserts each has both width and height >= 44px. The "Manage source library" link is the only visible `a[href]` control below 44px, so `undersizedControls` resolves to `["Manage source library"]` and the test fails.

## Expected Behavior

- Describe what should happen instead.
- Every visible interactive control in the workspace shell must meet the 44px touch-target minimum in both dimensions (the contract already enforced by the responsive e2e spec and honored by the "Add source" link via the `min-h-11` Tailwind token = min-height 2.75rem = 44px).
- The "Manage source library" fallback link must render at >= 44px height while preserving its destination (`/sources`) and behavior (plain navigation link to the global source library).

## Reproduction Steps

1. List the exact setup state.
2. List the user or developer actions.
3. Record the observed result.
1. Start the workspace app server (e2e `startAppServer` on port 4180) and launch headless Chromium.
2. Open the workspace root (`/`) with no project selected (`state.projectId() === null`), so the Sources section renders its `Show` fallback "Manage source library" link.
3. Run the e2e case "keeps one ordered, overflow-free shell at every target width and theme" across viewports 375/768/1024/1440 and both themes.
4. Observed (before fix): the case fails with `undersizedControls` containing `"Manage source library"` because the link's `boundingBox().height` is < 44.
5. Observed (after fix): the case passes with `undersizedControls` equal to `[]`.

## Scope / Blast Radius

- List affected packages, commands, integrations, environments, or users.
- WorkspaceShell navigation (`apps/web/src/components/workspace/WorkspaceShell.tsx`), Sources section `Show` fallback branch (no project open). Single component, single render path.

## Suspected Root Cause

- Record current theories and assumptions.
- The "Manage source library" fallback link was styled with `link px-2 text-xs` only — no vertical sizing token. Every other interactive control in the shell (e.g. the "Add source" link with `btn btn-ghost min-h-11 px-3 text-xs`) carries the `min-h-11` 44px touch-target token, but this fallback link was missed when the 44px contract was applied across the shell.

## Confirmed Root Cause

- Record the proven cause and decisive evidence.
- Confirmed by red evidence: the workspace-responsive e2e case "keeps one ordered, overflow-free shell at every target width and theme" failed with `undersizedControls` containing the "Manage source library" link, proving the link renders under 44px in both themes at every target width (375/768/1024/1440).
- Decisive code evidence: `WorkspaceShell.tsx` Sources `Show` fallback `<a class="link px-2 text-xs" ...>` had no min-height token, unlike the sibling "Add source" link which uses `min-h-11`. The `link` class is display:inline, so without an explicit `min-h-11` (and a flex/inline-flex display to let the min-height apply to the box) the link collapses to its text line height (~12px).

## Workaround

- Describe any temporary mitigation and remaining risk.
- None. The fallback link is reachable on the no-project workspace view; users on touch devices simply had an undersized tap target. No data or routing impact.

## Permanent Fix Plan

- Describe the intended durable fix.
- Apply the existing 44px touch-target token (`min-h-11`, Tailwind min-height 2.75rem = 44px) to the "Manage source library" fallback link, matching the contract already used by the "Add source" link. Add `inline-flex items-center` so the min-height is honored on what was a display:inline `link`, keeping `link px-2 text-xs` for destination/behavior parity.
- Diff: `class="link px-2 text-xs"` -> `class="link inline-flex min-h-11 items-center px-2 text-xs"` on the fallback `<a>` in `WorkspaceShell.tsx`. Destination (`/sources`) and plain-link behavior unchanged; BUG-0050 behavior untouched.

## Regression Coverage Needed

- List tests, fixtures, reproductions, alerts, or docs updates needed.
- The existing workspace-responsive e2e case "keeps one ordered, overflow-free shell at every target width and theme" already asserts every visible `.app-shell button:not([disabled]), .app-shell a[href]` is >= 44px in both dimensions across 4 viewports x 2 themes; it now passes and serves as regression coverage for this defect. No new test added — the existing assertion is the correct red→green guard.

## Related Notes

<!-- AGENT-START:bug-related-notes -->
- Phase: [[02_Phases/Phase_10_v1_usable_research_workspace/Phase|Phase 10 v1 usable research workspace]]
- Step: [[02_Phases/Phase_10_v1_usable_research_workspace/Steps/Step_09_make-source-registration-workspace-scoped|STEP-10-09 Make Source Registration Workspace Scoped]]
<!-- AGENT-END:bug-related-notes -->

## Timeline

<!-- AGENT-START:bug-timeline -->
- 2026-07-26 - Reported.
<!-- AGENT-END:bug-timeline -->
- 2026-07-26 - Root cause confirmed and fixed: added `min-h-11` 44px touch-target token (plus `inline-flex items-center`) to the "Manage source library" fallback link in `apps/web/src/components/workspace/WorkspaceShell.tsx`. Destination/behavior unchanged; BUG-0050 untouched. Validation: `bun test --preload ./test/solid-test-preload.ts --max-concurrency 1 ./e2e/workspace-responsive.spec.ts` -> 7 pass / 0 fail (112 expect() calls), including the red-evidence case "keeps one ordered, overflow-free shell at every target width and theme". Status -> fixed.
