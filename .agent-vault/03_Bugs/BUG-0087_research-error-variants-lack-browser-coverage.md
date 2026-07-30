---
note_type: bug
template_version: 2
contract_version: 1
title: Research error variants lack browser coverage
bug_id: BUG-0087
status: new
severity: sev-3
category: testing
reported_on: '2026-07-28'
fixed_on: ''
owner: unassigned
created: '2026-07-28'
updated: '2026-07-28'
related_notes:
  - '[[02_Phases/Phase_10_v1_usable_research_workspace/Steps/Step_07_complete-responsive-accessibility-and-theme-behavior|STEP-10-07 Complete Responsive Accessibility and Theme Behavior]]'
  - '[[05_Sessions/2026-07-28-204323-complete-responsive-accessibility-and-theme-behavior-codex|SESSION-2026-07-28-204323 Codex session for Complete Responsive Accessibility and Theme Behavior]]'
tags:
  - agent-vault
  - bug
---

# BUG-0087 - Research error variants lack browser coverage

Use one note per bug. Capture reproduction, impact, root cause, workaround, and verification, then link back to the relevant phase, step, decision, or session. See [[07_Templates/Note_Contracts|Note Contracts]].

## Summary

- Research error variants lack browser coverage.
- Related notes: [[02_Phases/Phase_10_v1_usable_research_workspace/Steps/Step_07_complete-responsive-accessibility-and-theme-behavior|STEP-10-07 Complete Responsive Accessibility and Theme Behavior]], [[05_Sessions/2026-07-28-204323-complete-responsive-accessibility-and-theme-behavior-codex|SESSION-2026-07-28-204323 Codex session for Complete Responsive Accessibility and Theme Behavior]].
- **Gap:** No browser test exercises `EvidenceContradictionError`, `ResearchCitationValidationError`, or `RetrievalQueryError` copy, recovery actions, focus, responsive layout, and theme parity.
- **Expected regression:** Deterministic E2E cases for each error variant with light/dark responsive screenshots.
- **Evidence:** `.local/ui-audit/inventory.md` ResearchPage coverage table.

## Observed Behavior

- `ResearchStream` renders a `research-failed` SSE event via `failureGuidance(errorTag)` (`apps/web/src/components/ResearchStream.tsx:70-84`), producing distinct copy per variant:
  - `EvidenceContradictionError` → "The selected documents conflict on this question. Review the evidence before drawing a conclusion." (line 75).
  - `ResearchCitationValidationError` → "The answer was withheld because its supporting citation could not be verified." (line 77).
  - `RetrievalQueryError` → "The selected document evidence could not be retrieved. Retry the run." (line 79).
- No browser test exercises these three variants. `apps/web/e2e/walking-skeleton.spec.ts` mocks only `EvidenceInsufficientError` (line 183) and `UnsupportedSourceTypeError` (line 260); `grep` for the other three `errorTag` strings in that file returns no matches.
- No `ResearchStream` component test exists: `find` for `*ResearchStream*` under `apps/web` returns only `ResearchStream.tsx` (no `*.test.*`).
- `.local/ui-audit/inventory.md` ResearchPage coverage table (lines 117-119) marks all three variants as ❌ e2e / ❌ unit; section 3.3 lists them as reachable but not individually tested.

## Expected Behavior

- Per the Summary's expected regression: deterministic E2E cases for each error variant with light/dark responsive screenshots, exercising copy, recovery actions, focus, responsive layout, and theme parity — matching the coverage already present for `EvidenceInsufficientError` and `UnsupportedSourceTypeError`.

## Reproduction Steps

1. Setup: running web app + Playwright (`apps/web/e2e/walking-skeleton.spec.ts` harness via `support/app-server`).
2. The three variants are reachable only through a `research-failed` SSE event whose `data.errorTag` is one of `EvidenceContradictionError`, `ResearchCitationValidationError`, or `RetrievalQueryError` (error classes defined at `packages/domain/src/typed-errors.ts:91`, `:102`, `:81`).
3. Observed result: run `grep -n errorTag apps/web/e2e/walking-skeleton.spec.ts` → only `EvidenceInsufficientError` (line 183) and `UnsupportedSourceTypeError` (line 260) appear; the three subject variants have no E2E or component test.

## Scope / Blast Radius

- Affected: `apps/web` only — `ResearchPage` route and `ResearchStream` component rendering of `research-failed` guidance.
- No runtime, data, or backend impact; the worker/workflow sides already produce and unit-test these errors (`packages/workflows/test/document-research.test.ts:364-386`, `apps/worker/src/jobs/run-research.test.ts:219-251`).
- Gap is browser coverage for three error variants: `EvidenceContradictionError`, `ResearchCitationValidationError`, `RetrievalQueryError`.

## Suspected Root Cause

- Record current theories and assumptions.

## Confirmed Root Cause

- No browser test was authored for these three `research-failed` variants. The E2E suite (`walking-skeleton.spec.ts`) and component layer cover only two of the five `failureGuidance` branches (`EvidenceInsufficientError`, `UnsupportedSourceTypeError`); the remaining three switch cases (`ResearchStream.tsx:74-78`) were never exercised in a browser or component test. Decisive evidence: `grep` of the E2E file and the absence of any `*ResearchStream*` test file.

## Workaround

- None needed at runtime — the UI renders the correct guidance per `failureGuidance` for each `errorTag`. The gap is test coverage only. Current verification path is manual: drive a `research-failed` event via the `?demo=mixed-source` ResearchPage demo route or a hand-rolled SSE mock and inspect the rendered `alert-warning` banner.

## Permanent Fix Plan

- Add deterministic E2E cases (extend `walking-skeleton.spec.ts` or a new `research-error-variants.spec.ts`) that mock a `research-failed` SSE event per `errorTag` and assert each variant's `failureGuidance` copy from `ResearchStream.tsx:74-79`:
  - `EvidenceContradictionError` → "documents conflict".
  - `ResearchCitationValidationError` → "withheld because its supporting citation could not be verified".
  - `RetrievalQueryError` → "document evidence could not be retrieved".
- Capture light + dark + responsive-breakpoint screenshots for each variant via the existing demo matrix (`.local/ui-audit/run-demo-matrix.sh`) once the demo fixture exposes the three states, or via the E2E screenshots harness used for the other variants.
- Optionally add a `ResearchStream` component test asserting `failureGuidance` for all five `errorTag` values plus the default branch (lines 70-84).

## Regression Coverage Needed

- E2E: one case per variant asserting `errorTag` → guidance copy mapping (assert on the `role="alert"` `alert-warning` banner, as the existing insufficient/unsupported tests do).
- Screenshots: light + dark at mobile and desktop breakpoints per variant (parity with the existing matrix).
- Component test (optional but cheap): `failureGuidance` switch coverage for all five `errorTag`s and the default.
- Docs: update `.local/ui-audit/inventory.md` ResearchPage table (lines 117-119) and section 3.3 to mark the three variants ✅ once added.

## Related Notes

<!-- AGENT-START:bug-related-notes -->
- Phase: [[02_Phases/Phase_10_v1_usable_research_workspace/Phase|Phase 10 v1 usable research workspace]]
- Step: [[02_Phases/Phase_10_v1_usable_research_workspace/Steps/Step_07_complete-responsive-accessibility-and-theme-behavior|STEP-10-07 Complete Responsive Accessibility and Theme Behavior]]
- Session: [[05_Sessions/2026-07-28-204323-complete-responsive-accessibility-and-theme-behavior-codex|SESSION-2026-07-28-204323 Codex session for Complete Responsive Accessibility and Theme Behavior]]
<!-- AGENT-END:bug-related-notes -->

## Timeline

<!-- AGENT-START:bug-timeline -->
- 2026-07-28 - Reported.
<!-- AGENT-END:bug-timeline -->
