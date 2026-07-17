---
note_type: session
template_version: 2
contract_version: 1
title: phase00-step01-attempt2 session for Spike Fred Runtime and Workflow Integration
session_id: SESSION-2026-07-17-062747
date: '2026-07-17'
status: completed
owner: phase00-step01-attempt2
branch: ''
phase: '[[02_Phases/Phase_00_architecture_spikes_and_delivery_foundations/Phase|Phase 00 architecture spikes and delivery foundations]]'
context:
  context_id: SESSION-2026-07-17-062747
  status: completed
  updated_at: '2026-07-17T06:49:00.000Z'
  current_focus:
    summary: Completed [[02_Phases/Phase_00_architecture_spikes_and_delivery_foundations/Steps/Step_01_spike-fred-runtime-and-workflow-integration|STEP-00-01 Spike Fred Runtime and Workflow Integration]].
    target: '[[02_Phases/Phase_00_architecture_spikes_and_delivery_foundations/Steps/Step_01_spike-fred-runtime-and-workflow-integration|STEP-00-01 Spike Fred Runtime and Workflow Integration]]'
  resume_target:
    type: step
    target: '[[02_Phases/Phase_00_architecture_spikes_and_delivery_foundations/Steps/Step_01_spike-fred-runtime-and-workflow-integration|STEP-00-01 Spike Fred Runtime and Workflow Integration]]'
    section: Context Handoff
  last_action:
    type: saved
related_bugs: []
related_decisions:
  - '[[04_Decisions/DEC-0012_keep-fred-at-the-orchestration-boundary-for-typed-research-runs|DEC-0012 Keep Fred at the Orchestration Boundary for Typed Research Runs]]'
created: '2026-07-17'
updated: '2026-07-17'
tags:
  - agent-vault
  - session
---

# phase00-step01-attempt2 session for Spike Fred Runtime and Workflow Integration

Use one note per meaningful work session. Record chronology, validation, and handoff state, but promote durable conclusions into phase, architecture, bug, or decision notes. See [[07_Templates/Note_Contracts|Note Contracts]].

## Objective

- Advance [[02_Phases/Phase_00_architecture_spikes_and_delivery_foundations/Steps/Step_01_spike-fred-runtime-and-workflow-integration|STEP-00-01 Spike Fred Runtime and Workflow Integration]].
- Leave a clean handoff if the work stops mid-step.

## Planned Scope

- Review [[02_Phases/Phase_00_architecture_spikes_and_delivery_foundations/Steps/Step_01_spike-fred-runtime-and-workflow-integration|STEP-00-01 Spike Fred Runtime and Workflow Integration]] before editing.
- Record changed paths and validation as the session progresses.

## Execution Log

<!-- AGENT-START:session-execution-log -->
- 06:27 - Created session note.
- 06:27 - Linked related step [[02_Phases/Phase_00_architecture_spikes_and_delivery_foundations/Steps/Step_01_spike-fred-runtime-and-workflow-integration|STEP-00-01 Spike Fred Runtime and Workflow Integration]].
- 06:29 - Loaded bounded step, phase, architecture, decision, and upstream Fred example context.
- 06:31 - Scaffolded `spikes/fred-runtime/` test-first, installed pinned packages, observed the initial failing test run, then implemented the disposable harness.
- 06:34 - Added compatibility, boundary, and ADR artifacts under `docs/spikes/` and `docs/adr/`, plus DEC-0012 in the vault.
- 06:35 - Re-ran frozen install, tests, and typecheck to close the spike with fresh evidence.
- 06:46 - Received independent review feedback covering `.gitignore`, malformed output regression coverage, gap-register completeness, and checkpoint-byte calculation clarity.
- 06:48 - Added failing malformed-output regression tests first, observed the expected red run, then implemented the boundary fixes and documentation updates.
- 06:49 - Re-ran targeted runtime regressions plus the full frozen install, test, and typecheck suite.
<!-- AGENT-END:session-execution-log -->

## Findings

- The published `@fancyrobot/fred@2.0.0` surface is sufficient for typed deterministic workflows, hook capture, optional HTTP exposure, and offline eval assertions.
- The product must still own public run IDs, event journaling, checkpoint records, artifact references, replay policy, and user-facing SSE semantics.
- `fred-http` exposes a useful coarse lifecycle envelope for smoke tests, but it is not rich enough to replace the product journal contract required by STEP-00-02.
- Malformed deterministic tool output now fails closed with `DeterministicToolValidationFailure`, while malformed terminal workflow output fails at Fred's output schema boundary with `WorkflowOutputValidationError`.
- The checkpoint byte calculation now uses an explicit fixed-point helper instead of duplicate ad hoc assignments.

## Context Handoff

- STEP-00-01 is complete.
- Durable evidence lives in `docs/spikes/fred-compatibility-matrix.md`, `docs/spikes/fred-runtime-and-workflow-integration.md`, and `docs/adr/DEC-0012-keep-fred-at-the-orchestration-boundary-for-typed-research-runs.md`.
- The disposable proving harness lives in `spikes/fred-runtime/` and proves `createFred()`, `defineWorkflow()`, workflow hooks, `fred-http` workflow transport, `@fancyrobot/fred/eval`, and negative-path schema failures against published packages only.
- STEP-00-02 may rely on the handoff rule that product `runId` is primary, product checkpoints stay authoritative, and Fred hook points are integration taps rather than the durable journal.
- Review-requested follow-up is complete; no further work remains on STEP-00-01 unless a new verified finding arrives.

## Changed Paths

<!-- AGENT-START:session-changed-paths -->
- `.gitignore`
- `docs/architecture.md`
- `docs/adr/DEC-0012-keep-fred-at-the-orchestration-boundary-for-typed-research-runs.md`
- `docs/spikes/fred-compatibility-matrix.md`
- `docs/spikes/fred-runtime-and-workflow-integration.md`
- `spikes/fred-runtime/package.json`
- `spikes/fred-runtime/tsconfig.json`
- `spikes/fred-runtime/src/contracts.ts`
- `spikes/fred-runtime/src/runtime-harness.ts`
- `spikes/fred-runtime/test/runtime-harness.test.ts`
- `spikes/fred-runtime/test/http-surface.test.ts`
- `spikes/fred-runtime/test/eval-compatibility.test.ts`
- `spikes/fred-runtime/test/golden-traces/research-run.golden.json`
- `spikes/fred-runtime/bun.lock`
- `.agent-vault/04_Decisions/DEC-0012_keep-fred-at-the-orchestration-boundary-for-typed-research-runs.md`
- `.agent-vault/02_Phases/Phase_00_architecture_spikes_and_delivery_foundations/Phase.md`
- `.agent-vault/02_Phases/Phase_00_architecture_spikes_and_delivery_foundations/Steps/Step_01_spike-fred-runtime-and-workflow-integration.md`
- `.agent-vault/02_Phases/Phase_00_architecture_spikes_and_delivery_foundations/Steps/Step_01_spike-fred-runtime-and-workflow-integration/Implementation_Notes.md`
- `.agent-vault/02_Phases/Phase_00_architecture_spikes_and_delivery_foundations/Steps/Step_01_spike-fred-runtime-and-workflow-integration/Outcome.md`
- `.agent-vault/05_Sessions/2026-07-17-062747-spike-fred-runtime-and-workflow-integration-phase00-step01-attempt2.md`
<!-- AGENT-END:session-changed-paths -->

## Validation Run

<!-- AGENT-START:session-validation-run -->
- Command: `cd spikes/fred-runtime && bun test test/runtime-harness.test.ts && bun install --frozen-lockfile && bun test && bunx tsc -p tsconfig.json --noEmit`
- Result: pass
- Notes: targeted runtime regressions 5/5 passing; frozen install unchanged; full suite 8/8 passing; typecheck clean.
<!-- AGENT-END:session-validation-run -->

## Bugs Encountered

<!-- AGENT-START:session-bugs-encountered -->
- None.
<!-- AGENT-END:session-bugs-encountered -->

## Decisions Made or Updated

<!-- AGENT-START:session-decisions-made-or-updated -->
- [[04_Decisions/DEC-0012_keep-fred-at-the-orchestration-boundary-for-typed-research-runs|DEC-0012 Keep Fred at the Orchestration Boundary for Typed Research Runs]] - Accepted the rule that Fred owns orchestration while product code owns run IDs, journals, checkpoints, artifact references, auth, and replay policy.
<!-- AGENT-END:session-decisions-made-or-updated -->

## Follow-Up Work

<!-- AGENT-START:session-follow-up-work -->
- [ ] Execute STEP-00-02 against the published handoff: product-first run identity, product-owned checkpoints, and hook-based journal tap points.
<!-- AGENT-END:session-follow-up-work -->

## Completion Summary

- Finished: disposable Fred runtime spike harness, compatibility matrix, runtime/boundary write-up, and DEC-0012.
- Remaining in this thread: nothing for STEP-00-01.
- Handoff: clean for STEP-00-02 and any architecture review of the Fred/product boundary.
