---
note_type: bug
template_version: 2
contract_version: 1
title: Base-path citation regression test is not isolated in the full test suite
bug_id: BUG-0016
status: fixed
severity: sev-3
category: logic
reported_on: '2026-07-21'
fixed_on: '2026-07-21'
owner: orchestrator
created: '2026-07-21'
updated: '2026-07-21'
related_notes:
  - '[[02_Phases/Phase_09_v1_production_hardening_and_release/Steps/Step_06_publish-v1-documentation-accessibility-and-release-checklist|STEP-09-06 Publish v1 Documentation Accessibility and Release Checklist]]'
tags:
  - agent-vault
  - bug
---

# BUG-0016 - Base-path citation regression test is not isolated in the full test suite

Use one note per bug. Capture reproduction, impact, root cause, workaround, and verification, then link back to the relevant phase, step, decision, or session. See [[07_Templates/Note_Contracts|Note Contracts]].

## Summary

- Base-path citation regression test is not isolated in the full test suite.
- Related notes: [[02_Phases/Phase_09_v1_production_hardening_and_release/Steps/Step_06_publish-v1-documentation-accessibility-and-release-checklist|STEP-09-06 Publish v1 Documentation Accessibility and Release Checklist]].

## Observed Behavior

- Describe what actually happens.

## Expected Behavior

- Describe what should happen instead.

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
- Proven cause: `apps/web/src/components/citation-paths.ts` captured `import.meta.env.BASE_URL` in a module-level constant, so earlier full-suite imports cached the default empty base path before `apps/web/src/components/citation-base-path.test.tsx` mutated the env. The focused file passed in isolation because its first import happened after the test set `/struct/`.
- Decisive evidence: `bun test apps/web/src/components/citation-base-path.test.tsx` passed in isolation, while `bun run test` failed the same three assertions with `/projects/...` links missing the `/struct` prefix.
- Durable fix: added `publicBasePathFromEnv(...)` and made citation path + report return helpers read `BASE_URL` at call time instead of module initialization, removing the cache-sensitive behavior while preserving production URLs.

## Workaround

- Describe any temporary mitigation and remaining risk.

## Permanent Fix Plan

- Describe the intended durable fix.

## Regression Coverage Needed

- List tests, fixtures, reproductions, alerts, or docs updates needed.

## Related Notes

<!-- AGENT-START:bug-related-notes -->
- Phase: [[02_Phases/Phase_09_v1_production_hardening_and_release/Phase|Phase 09 v1 production hardening and release]]
- Step: [[02_Phases/Phase_09_v1_production_hardening_and_release/Steps/Step_06_publish-v1-documentation-accessibility-and-release-checklist|STEP-09-06 Publish v1 Documentation Accessibility and Release Checklist]]
<!-- AGENT-END:bug-related-notes -->

## Timeline

<!-- AGENT-START:bug-timeline -->
- 2026-07-21 - Reported.
<!-- AGENT-END:bug-timeline -->
