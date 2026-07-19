---
note_type: bug
template_version: 2
contract_version: 1
title: Solid theme toggle does not apply the selected theme
bug_id: BUG-0007
status: fixed
severity: sev-3
category: logic
reported_on: '2026-07-19'
fixed_on: '2026-07-19'
owner: Codex
created: '2026-07-19'
updated: '2026-07-19'
related_notes:
  - '[[02_Phases/Phase_04_structured_datasets_and_deterministic_sql/Steps/Step_02_implement-parquet-materialization-and-data-profiling|STEP-04-02 Implement Parquet Materialization and Data Profiling]]'
  - '[[05_Sessions/2026-07-19-171923-implement-parquet-materialization-and-data-profiling-codex-step-04-02-worker|SESSION-2026-07-19-171923 codex-step-04-02-worker session for Implement Parquet Materialization and Data Profiling]]'
tags:
  - agent-vault
  - bug
---

# BUG-0007 - Solid theme toggle does not apply the selected theme

Use one note per bug. Capture reproduction, impact, root cause, workaround, and verification, then link back to the relevant phase, step, decision, or session. See [[07_Templates/Note_Contracts|Note Contracts]].

## Summary

- Solid theme toggle does not apply the selected theme.
- Related notes: [[02_Phases/Phase_04_structured_datasets_and_deterministic_sql/Steps/Step_02_implement-parquet-materialization-and-data-profiling|STEP-04-02 Implement Parquet Materialization and Data Profiling]], [[05_Sessions/2026-07-19-171923-implement-parquet-materialization-and-data-profiling-codex-step-04-02-worker|SESSION-2026-07-19-171923 codex-step-04-02-worker session for Implement Parquet Materialization and Data Profiling]].

## Observed Behavior

- Describe what actually happens.
- The theme toggle updates its Solid signal, but the selected theme is not applied to the document or application root, so the UI appearance does not change.

## Expected Behavior

- Describe what should happen instead.
- The toggle applies the selected theme to the application root, and the control state always matches the visible theme.

## Reproduction Steps

1. List the exact setup state.
2. List the user or developer actions.
3. Record the observed result.

## Scope / Blast Radius

- List affected packages, commands, integrations, environments, or users.

## Suspected Root Cause

- Record current theories and assumptions.

## Confirmed Root Cause

- Record the proven cause and decisive evidence.
- `App` changed a `theme` signal but never read it in a reactive DOM attribute, so Solid had no visible theme side effect.
- The web Vite pipeline also lacked the official Tailwind CSS Vite plugin. Production output retained raw `@plugin` and `@tailwind` directives, leaving Tailwind utilities and DaisyUI theme selectors inert. Attribute-only wiring therefore would not have changed the rendered palette.

## Workaround

- Describe any temporary mitigation and remaining risk.

## Permanent Fix Plan

- Describe the intended durable fix.
- Completed: bind the signal to the application root through reactive `data-theme`, expose accessible toggle state, define matching `struct-light` and `struct-dark` project themes, and compile Tailwind/DaisyUI through `@tailwindcss/vite`.
- Added browser regression coverage that proves the deterministic light default, the dark toggle, the updated accessible control state, and a real computed background-color change.

## Regression Coverage Needed

- List tests, fixtures, reproductions, alerts, or docs updates needed.
- Prove the initial theme is deterministic and toggling changes the applied root theme.
- Run the focused web suite plus typecheck, build, lint, and repository integrity gates.

## Related Notes

<!-- AGENT-START:bug-related-notes -->
- Phase: [[02_Phases/Phase_04_structured_datasets_and_deterministic_sql/Phase|Phase 04 structured datasets and deterministic sql]]
- Step: [[02_Phases/Phase_04_structured_datasets_and_deterministic_sql/Steps/Step_02_implement-parquet-materialization-and-data-profiling|STEP-04-02 Implement Parquet Materialization and Data Profiling]]
- Session: [[05_Sessions/2026-07-19-171923-implement-parquet-materialization-and-data-profiling-codex-step-04-02-worker|SESSION-2026-07-19-171923 codex-step-04-02-worker session for Implement Parquet Materialization and Data Profiling]]
<!-- AGENT-END:bug-related-notes -->

## Timeline

<!-- AGENT-START:bug-timeline -->
- 2026-07-19 - Reported.
<!-- AGENT-END:bug-timeline -->
- 2026-07-19: Fixed and validated. Focused web unit tests passed (12 tests, 72 assertions); the full walking-skeleton browser suite passed (5 tests, 13 assertions). Repository typecheck, build, lint, dependency/import boundaries, documentation links, and secret scan all passed.
- 2026-07-19: Final package-level validation passed: `@struct/web test` ran 17 tests with 85 assertions. The web test script now explicitly loads the Solid TSX transform when executed from its workspace, avoiding reliance on the repository-root Bun configuration.
