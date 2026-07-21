---
note_type: bug
template_version: 2
contract_version: 1
title: Citation navigation bypasses configured web base path
bug_id: BUG-0015
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

# BUG-0015 - Citation navigation bypasses configured web base path

Use one note per bug. Capture reproduction, impact, root cause, workaround, and verification, then link back to the relevant phase, step, decision, or session. See [[07_Templates/Note_Contracts|Note Contracts]].

## Summary

- Citation navigation bypasses configured web base path.
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
- Proven cause: some citation links were built from raw root-relative strings instead of the shared base-path-aware helpers/router paths, so deployments under a configured web base path (for example `/struct/`) navigated to the wrong URL.
- Fixed in `apps/web/src/components/ResearchStream.tsx` by routing completed-answer citation links through `researchCitationPath(...)`, matching the already-correct helpers used by other citation surfaces.
- Verified that `PartialFindingsPanel`, report citation links, and `citation-return.ts` all remain base-path aware.

## Workaround

- Describe any temporary mitigation and remaining risk.

## Permanent Fix Plan

- Describe the intended durable fix.

## Regression Coverage Needed

- List tests, fixtures, reproductions, alerts, or docs updates needed.
- Added/kept focused base-path coverage in `apps/web/src/components/citation-base-path.test.tsx` for partial findings links, direct research citation paths, and report citation paths.
- Preserved `apps/web/src/pages/citation-page.test.ts` coverage for base-path-aware citation return handling.
- Validation run on 2026-07-21:
  - `bun test apps/web/src/pages/citation-page.test.ts` ✅
  - `bun test apps/web/src/components/citation-base-path.test.tsx` ✅
  - `bun run typecheck` ✅
  - `bun run test:e2e` ✅
- 2026-07-21 follow-up: hardened the regression coverage so the focused base-path tests and citation return-path tests import the real helpers directly instead of relying on cache-busting dynamic imports.
- Revalidated after BUG-0016 fix:
  - `bun test apps/web/src/components/citation-base-path.test.tsx` ✅
  - `bun test apps/web/src/pages/citation-page.test.ts` ✅
  - `bun run test` ✅ (792 pass, 171 skip, 0 fail)
  - `bun run typecheck` ✅

## Related Notes

<!-- AGENT-START:bug-related-notes -->
- Phase: [[02_Phases/Phase_09_v1_production_hardening_and_release/Phase|Phase 09 v1 production hardening and release]]
- Step: [[02_Phases/Phase_09_v1_production_hardening_and_release/Steps/Step_06_publish-v1-documentation-accessibility-and-release-checklist|STEP-09-06 Publish v1 Documentation Accessibility and Release Checklist]]
<!-- AGENT-END:bug-related-notes -->

## Timeline

<!-- AGENT-START:bug-timeline -->
- 2026-07-21 - Reported.
<!-- AGENT-END:bug-timeline -->
