---
note_type: bug
template_version: 2
contract_version: 1
title: Recursive Analysis Route Tests Assert Redacted Persistence Details
bug_id: BUG-0026
status: resolved
severity: sev-3
category: logic
reported_on: '2026-07-22'
fixed_on: '2026-07-22'
owner: root-orchestrator
created: '2026-07-22'
updated: '2026-07-22'
related_notes:
  - '[[02_Phases/Phase_06_recursive_corpus_analysis/Steps/Step_03_implement-deterministic-batch-extraction-and-evidence-artifacts|STEP-06-03 Implement Deterministic Batch Extraction and Evidence Artifacts]]'
tags:
  - agent-vault
  - bug
---

# BUG-0026 - Recursive Analysis Route Tests Assert Redacted Persistence Details

Use one note per bug. Capture reproduction, impact, root cause, workaround, and verification, then link back to the relevant phase, step, decision, or session. See [[07_Templates/Note_Contracts|Note Contracts]].

## Summary

- Recursive Analysis Route Tests Assert Redacted Persistence Details.
- Related notes: [[02_Phases/Phase_06_recursive_corpus_analysis/Steps/Step_03_implement-deterministic-batch-extraction-and-evidence-artifacts|STEP-06-03 Implement Deterministic Batch Extraction and Evidence Artifacts]].

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
The persistence-wide `QueryError` redaction hardening now discards caller-provided diagnostic messages. Two recursive-analysis route tests still expected those raw messages, so they failed despite correct safe production behavior. The first remediation only checked the generic sanitized error and weakened branch proof; the reviewed final remediation attaches fixed safe local reasons (`workspace-scope-mismatch`, `event-limit-exceeded`) to the two route failures and verifies them without exposing raw details.

## Workaround

- Describe any temporary mitigation and remaining risk.

## Permanent Fix Plan

- Describe the intended durable fix.

## Regression Coverage Needed

- List tests, fixtures, reproductions, alerts, or docs updates needed.
Implemented and reviewed coverage in `apps/api/src/routes/recursive-analysis.test.ts`: injected SQL/path markers must not appear in message, Effect cause string, or JSON; tests require the sanitized `QueryError` surface and the exact safe reason for both workspace-scope rejection and event-limit overflow. Independent spec and quality reviews passed. Focused recursive route and persistence redaction tests, API typecheck, and focused lint passed.

## Related Notes

<!-- AGENT-START:bug-related-notes -->
- Phase: [[02_Phases/Phase_06_recursive_corpus_analysis/Phase|Phase 06 recursive corpus analysis]]
- Step: [[02_Phases/Phase_06_recursive_corpus_analysis/Steps/Step_03_implement-deterministic-batch-extraction-and-evidence-artifacts|STEP-06-03 Implement Deterministic Batch Extraction and Evidence Artifacts]]
<!-- AGENT-END:bug-related-notes -->

## Timeline

<!-- AGENT-START:bug-timeline -->
- 2026-07-22 - Reported.
- 2026-07-22 - Verified with focused recursive route and persistence redaction tests, API typecheck, focused lint, and independent spec and quality reviews.
<!-- AGENT-END:bug-timeline -->
