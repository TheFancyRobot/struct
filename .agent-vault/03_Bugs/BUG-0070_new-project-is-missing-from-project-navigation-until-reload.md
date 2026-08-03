---
note_type: bug
template_version: 2
contract_version: 1
title: New project is missing from project navigation until reload
bug_id: BUG-0070
status: fixed
severity: sev-3
category: navigation
reported_on: '2026-07-28'
fixed_on: '2026-08-01'
owner: bug0070-attempt3
created: '2026-07-28'
updated: '2026-08-01'
related_notes:
  - '[[02_Phases/Phase_10_v1_usable_research_workspace/Steps/Step_07_complete-responsive-accessibility-and-theme-behavior|STEP-10-07 Complete Responsive Accessibility and Theme Behavior]]'
  - '[[05_Sessions/2026-07-28-204323-complete-responsive-accessibility-and-theme-behavior-codex|SESSION-2026-07-28-204323 Codex session for Complete Responsive Accessibility and Theme Behavior]]'
tags:
  - agent-vault
  - bug
---

# BUG-0070 - New project is missing from project navigation until reload

Use one note per bug. Capture reproduction, impact, root cause, workaround, and verification, then link back to the relevant phase, step, decision, or session. See [[07_Templates/Note_Contracts|Note Contracts]].

## Summary

- New project is missing from project navigation until reload.
- Related notes: [[02_Phases/Phase_10_v1_usable_research_workspace/Steps/Step_07_complete-responsive-accessibility-and-theme-behavior|STEP-10-07 Complete Responsive Accessibility and Theme Behavior]], [[05_Sessions/2026-07-28-204323-complete-responsive-accessibility-and-theme-behavior-codex|SESSION-2026-07-28-204323 Codex session for Complete Responsive Accessibility and Theme Behavior]].
- **Observed:** After creation, the route and H1 show the new project, but both project lists omit it until a manual reload. Reproduced with two projects after a 3-second settle.
- **Expected:** Refresh project collections before/with navigation so the current project is visible and current immediately.
- **Evidence:** `.local/ui-audit/lead/screenshots/new-project-missing-from-navigation-before-reload.png` and `new-project-navigation-after-reload.png`.

## Observed Behavior

- After creating a project, the route and H1 update to show the new project, but both project lists (the persistent sidebar `WorkspaceNavigation` and the in-page `ProjectSwitcher`) omit the new project until a manual page reload. Reproduced with two projects after a 3-second settle.

## Expected Behavior

- After creation, both project lists must show the new project immediately, without a manual reload.

## Reproduction Steps

1. Open the app on `/` or `/projects/:id` with at least one existing project.
2. Enter a new project name and submit the create form.
3. The app navigates to `/projects/:newId` and the H1 shows the new project, but neither the sidebar Projects list nor the project switcher list includes it until a full page reload.

## Scope / Blast Radius

- `apps/web` — `HomePage`, `ProjectPage`, and `WorkspaceNavigation` each held an independent `createResource(fetchProjects)`. All users on all routes.

## Suspected Root Cause

- Three independent `createResource(fetchProjects)` instances (HomePage, ProjectPage, WorkspaceNavigation sidebar). `createAndNavigate` creates a project and navigates but never refreshes any of them. Since the route component is reused across `/projects/:id` navigations and the `WorkspaceShell` never remounts, both visible project lists stay stale until a manual reload.

## Confirmed Root Cause

- No shared project-list state; `createAndNavigate` did not refetch after a successful create. Each list resource was a local `createResource` that never refreshed on navigation. The `WorkspaceShell` (sidebar) is mounted once by `App` and never remounts on client-side route changes, so its `createResource` never re-fetched. The route components (`HomePage`/`ProjectPage`) are also reused across `/projects/:id` navigations, so their `createResource` never re-fetched either.

## Workaround

- Manual page reload after creating a project.

## Permanent Fix Plan

- Consolidate the three independent `createResource(fetchProjects)` instances into a single shared resource owned by the `WorkspaceStateProvider` context (`workspace-state.tsx`). Expose `projects` and `refetchProjects` on the workspace state. Have `createAndNavigate` call `refetchProjects()` after a successful create, before navigating. Both the sidebar `WorkspaceNavigation` and the route-level `ProjectSwitcher` now read the same shared resource, so one refetch updates both lists immediately. This also removes the triple `GET /projects` request smell.

## Regression Coverage Needed

- Unit (structural): `workspace-shell.test.tsx` — guard that the workspace state exposes a shared `projects` resource and `refetchProjects` entry point (BUG-0070).
- E2e (behavioral): `project-lifecycle.spec.ts` — create a project from an existing project route and assert the new project appears in both the sidebar `Workspace navigation` and the `Projects` navigation list without a reload.

## Related Notes

<!-- AGENT-START:bug-related-notes -->
- Phase: [[02_Phases/Phase_10_v1_usable_research_workspace/Phase|Phase 10 v1 usable research workspace]]
- Step: [[02_Phases/Phase_10_v1_usable_research_workspace/Steps/Step_07_complete-responsive-accessibility-and-theme-behavior|STEP-10-07 Complete Responsive Accessibility and Theme Behavior]]
- Session: [[05_Sessions/2026-07-28-204323-complete-responsive-accessibility-and-theme-behavior-codex|SESSION-2026-07-28-204323 Codex session for Complete Responsive Accessibility and Theme Behavior]]
<!-- AGENT-END:bug-related-notes -->

## Timeline

<!-- AGENT-START:bug-timeline -->
- 2026-07-28 - Reported.
- 2026-08-01 - Fixed by bug0070-attempt3. Root cause: three independent `createResource(fetchProjects)` with no refetch after create. Fix: single shared project-list resource on `WorkspaceStateProvider` + `refetchProjects()` in `createAndNavigate`. Regression coverage: structural unit guard in `workspace-shell.test.tsx` + e2e in `project-lifecycle.spec.ts`. Validation: web typecheck clean, lint clean, 88/88 web unit tests pass. Pre-existing unrelated API defect noted in `apps/api/src/routes/projects.test.ts`.
<!-- AGENT-END:bug-timeline -->
