---
note_type: bug
template_version: 2
contract_version: 1
title: standard local dev stack stages source uploads outside the worker artifact root
bug_id: BUG-0059
status: fixed
severity: sev-1
category: integration
reported_on: '2026-07-28'
fixed_on: '2026-07-28'
owner: bug0059-a1
created: '2026-07-28'
updated: '2026-07-28'
related_notes:
  - '[[02_Phases/Phase_10_v1_usable_research_workspace/Steps/Step_07_complete-responsive-accessibility-and-theme-behavior|STEP-10-07 Complete Responsive Accessibility and Theme Behavior]]'
tags:
  - agent-vault
  - bug
---

# BUG-0059 - standard local dev stack stages source uploads outside the worker artifact root

Use one note per bug. Capture reproduction, impact, root cause, workaround, and verification, then link back to the relevant phase, step, decision, or session. See [[07_Templates/Note_Contracts|Note Contracts]].

## Summary

- The standard local development stack resolved the API and worker artifact roots from different working directories, causing accepted source imports to fail ingestion.
- Related notes: [[02_Phases/Phase_10_v1_usable_research_workspace/Steps/Step_07_complete-responsive-accessibility-and-theme-behavior|STEP-10-07 Complete Responsive Accessibility and Theme Behavior]].

## Observed Behavior

- In a clean browser against `bun run dev`, valid pasted Markdown is accepted into the project catalog but its ingestion job immediately reaches `failed`.
- Retrying the failed job returns it to work briefly and then fails again. A second fresh source reproduces the same failure.
- The UI cannot reach ready-source research, so the mandated browser/design audit is blocked beyond source import.

## Expected Behavior

- The standard documented development command must give the API and worker the same canonical artifact-storage root so accepted sources become ready and can ground research.

## Reproduction Steps

1. Run `bun run dev` from the repository root.
2. In the browser, create/open a project, visit Sources, select Paste, provide a valid name and Markdown body, and submit.
3. Observe the source activity row reach `failed`; select Retry and observe another failure.
4. Inspect disk state: the API staged both reproductions below `apps/api/.local/artifacts/staging`, not the repository `.local/artifacts` root used by the worker.

## Scope / Blast Radius

- Affects source uploads through the API when `ARTIFACT_STORAGE_ROOT` is relative or omitted and the API is started from `apps/api`, including the standard root `bun run dev` workflow.
- Absolute artifact-root deployments are unaffected.

## Suspected Root Cause

- The API and worker were resolving the same relative configuration from different working directories.

## Confirmed Root Cause

- Record the proven cause and decisive evidence.
- `apps/api/src/config.ts` returns the relative `ARTIFACT_STORAGE_ROOT` unchanged, so `./.local/artifacts` resolves from the API process working directory (`apps/api`).
- `apps/worker/src/config.ts` deliberately resolves the same value from the repository root. `scripts/prepare-local-storage.ts` also prepares the repository-root path.
- Under `bun run --parallel --filter ./apps/* dev`, the API and worker therefore operate on different artifact directories. The worker cannot read API-staged uploads and records `IngestionFailureError`.

## Workaround

- Before this fix, setting `ARTIFACT_STORAGE_ROOT` to the same absolute path for both processes avoided the divergence. No workaround is needed after the fix.

## Permanent Fix Plan

- Describe the intended durable fix.
- Make API artifact-root resolution follow the worker's repository-root contract for relative paths while preserving absolute paths.
- Add a failing-first API config regression test for default, relative, and absolute roots.
- Validate the targeted tests and reproduce a full browser source ingestion to ready state under `bun run dev`.
- Implemented in this fix: `apps/api/src/config.ts` now derives `repositoryRoot = resolve(import.meta.dir, '../../..')` (mirroring `apps/worker/src/config.ts`) and pipes `artifactStorageRootConfig` through `Config.map((root) => resolve(repositoryRoot, root))`. Relative/default roots now resolve from the repository root; absolute roots are returned unchanged because Node `path.resolve` treats an absolute second argument as the new base. The API and worker now share one canonical artifact root under `bun run dev`.

## Regression Coverage Needed

- List tests, fixtures, reproductions, alerts, or docs updates needed.
- Unit coverage proving `apps/api` resolves a relative artifact root from the repository root and preserves absolute paths.
- Browser evidence from the standard local stack proving a newly pasted source reaches ready rather than failed.
- Existing full unit/E2E/import validations must remain green.
- Added unit coverage in `apps/api/src/config.test.ts` (TDD, RED-before-fix): default resolves to `resolve(import.meta.dir, '../../..', '.local/artifacts')`; a relative `ARTIFACT_STORAGE_ROOT` resolves from the repository root; an absolute root is preserved unchanged. Mirrors the worker config regression contract.
- Verification: `bun test apps/api/src/config.test.ts` → 13 pass / 0 fail. `bun test apps/api/src/` → 139 pass / 0 fail (includes the full vertical-slice ingestion tests that stage sources through the resolved root). `bun test packages/source-storage/` → 21 pass / 0 fail. `tsc --noEmit --project apps/api/tsconfig.json` → exit 0. `eslint apps/api/src/config.ts` → 0 errors.
- Root browser verification after restarting a clean `bun run dev` stack: pasted `bug-0059-root-validation.md` through the project Sources UI and observed it progress from `pending` to `ready`; the worker successfully consumed the API-staged artifact.

## Related Notes

<!-- AGENT-START:bug-related-notes -->
- Phase: [[02_Phases/Phase_10_v1_usable_research_workspace/Phase|Phase 10 v1 usable research workspace]]
- Step: [[02_Phases/Phase_10_v1_usable_research_workspace/Steps/Step_07_complete-responsive-accessibility-and-theme-behavior|STEP-10-07 Complete Responsive Accessibility and Theme Behavior]]
<!-- AGENT-END:bug-related-notes -->
- Decision: [[04_Decisions/DEC-0024_require-full-browser-coverage-and-design-consistency-audit-before-phase-11|DEC-0024 Require full browser coverage and design consistency audit before Phase 11]]

## Timeline

<!-- AGENT-START:bug-timeline -->
- 2026-07-28 - Reported.
- 2026-07-28 - Root cause confirmed: API `artifactStorageRootConfig` returned the relative `ARTIFACT_STORAGE_ROOT` unchanged, resolving from the API process CWD (`apps/api`) instead of the repository root. Fixed by mirroring the worker's `resolve(repositoryRoot, root)` map in `apps/api/src/config.ts` so relative/default roots resolve from the repo root and absolute roots are preserved. Added TDD regression coverage (default/relative/absolute) in `apps/api/src/config.test.ts`; API (139), source-storage (21), and config (13) unit suites, API typecheck, and lint all green.
- 2026-07-28 - Root restarted the standard development stack and verified in the browser that a newly pasted source progressed from `pending` to `ready`.
<!-- AGENT-END:bug-timeline -->
