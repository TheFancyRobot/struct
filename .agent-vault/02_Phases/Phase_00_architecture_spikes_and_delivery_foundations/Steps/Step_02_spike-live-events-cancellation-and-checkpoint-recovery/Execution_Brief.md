# Execution Brief

## Exact Outcome

- Produce the concrete contracts, artifacts, and bounded implementation/design surfaces for Live Events Cancellation and Checkpoint Recovery that this step is responsible for before any broader follow-on work begins.

## Prerequisites

- Re-read [[02_Phases/Phase_00_architecture_spikes_and_delivery_foundations/Phase|Phase 00 architecture spikes and delivery foundations]] and confirm the step still matches the current roadmap sequence.
- Confirm the handoff from [[02_Phases/Phase_00_architecture_spikes_and_delivery_foundations/Steps/Step_01_spike-fred-runtime-and-workflow-integration|STEP-00-01 Spike Fred Runtime and Workflow Integration]] before widening scope.
- Keep deterministic work in typed Effect services, repositories, and tools; reserve Fred for agentic orchestration only.
- Treat the listed files as planned starting points; create only the smallest set needed to land the slice.

## Planned Starting Files

- These paths may not exist yet; use them as the first bounded implementation or design surface.
- `docs/spikes/live-events-cancellation-and-checkpoint-recovery.md`
- `packages/domain/src/research-events.ts`
- `apps/api/src/sse/research-events.ts`
- `packages/persistence/src/checkpoints.ts`
- `apps/worker/src/workflows/checkpoint-store.ts`

## Required Reading

- [[02_Phases/Phase_00_architecture_spikes_and_delivery_foundations/Phase|Phase 00 architecture spikes and delivery foundations]]
- [[01_Architecture/System_Overview|System Overview]]
- [[01_Architecture/Code_Map|Code Map]]
- [[01_Architecture/Agent_Workflow|Agent Workflow]]
- [[02_Phases/Phase_00_architecture_spikes_and_delivery_foundations/Steps/Step_01_spike-fred-runtime-and-workflow-integration|STEP-00-01 Spike Fred Runtime and Workflow Integration]]
- `docs/product-brief.md` sections 5-7, 13, 18-19, 21, 24, 26, and 29-31.

## Concrete Deliverables

- Define the `ResearchEvent` union, checkpoint record shape, and cancellation lifecycle needed for a durable research run.
- Prove how SSE delivery, append-only event persistence, and resume-from-checkpoint semantics line up for one interrupted run.
- Name the exact restart-safe invariants: idempotent event append, monotonic checkpoint progress, and observable cancellation outcomes.

## Smallest Bounded Checklist

- First, define the `ResearchEvent` union, checkpoint record shape, and cancellation lifecycle needed for a durable research run.
- Then, prove how SSE delivery, append-only event persistence, and resume-from-checkpoint semantics line up for one interrupted run.
- Next, name the exact restart-safe invariants: idempotent event append, monotonic checkpoint progress, and observable cancellation outcomes.
- Finish by leaving one observable typed path—test, route, worker flow, or UI state—that proves the slice is ready for the next dependent step.

## Constraints and Non-Goals

- Keep Phase 0 work decision-oriented: prove boundaries, not broad production scaffolding.
- Keep deterministic work in typed Effect services and adapters; use Fred only where agentic judgment is actually required.
- Record tradeoffs and rejected options explicitly so later implementation steps do not need to rediscover them.

## Related Notes

- Step: [[02_Phases/Phase_00_architecture_spikes_and_delivery_foundations/Steps/Step_02_spike-live-events-cancellation-and-checkpoint-recovery|STEP-00-02 Spike Live Events Cancellation and Checkpoint Recovery]]
- Phase: [[02_Phases/Phase_00_architecture_spikes_and_delivery_foundations/Phase|Phase 00 architecture spikes and delivery foundations]]

## Refinement Addendum

### Starting Points and Prerequisite Handoff

- Require STEP-00-01's compatibility matrix, Fred/product ownership table, run-ID correlation rule, and checkpoint hook decision.
- Use `docs/spikes/live-events-cancellation-and-checkpoint-recovery.md` and a disposable `spikes/research-durability/` package with deterministic fixtures, a child-process runner, and captured traces. Listed domain/API/worker paths are Phase 1 handoff targets only.
- Read `docs/architecture.md` sections 7 and 10; `docs/research-execution-model.md` sections 10, 11, 17, and 21; `docs/security-model.md` sections 11, 12, 14, 15, 17, and 18; and DEC-0007/DEC-0008.

### Required Contracts and Artifacts

1. Minimum public events: `research-started`, `plan-created`, `step-started`, `step-completed`, optional `answer-streaming`, and one effective terminal state among `research-completed`, `research-failed`, and `research-cancelled`.
2. Product run identity separate from Fred identity, plus event identity `(runId, attempt, sequence)` with monotonic sequence within an attempt.
3. At-least-once delivery contract covering dedupe, replay cursor, retention gaps, heartbeat, reconnect authorization, and slow consumers.
4. Compact product checkpoint shape: current step, completed-step references, budget use, cancel intent, retry/attempt, Fred correlation, and artifact references. A Fred checkpoint never substitutes for the product journal.
5. Crash-window matrix for domain commit, journal append, Fred checkpoint write, and client delivery, with reconciliation/idempotency rules.
6. Winner rule: a durable cancel recorded before the terminal domain commit wins; a later cancel is an audited no-op.
7. Handoff to STEP-01-05 naming the stable event/cursor/checkpoint contract and deferred durability work.

### Product-Local Defaults

- Disconnect does not cancel work; cancellation requires persisted intent.
- SSE heartbeat target: 15 seconds.
- Inline event payload target: 16 KiB; checkpoint target: 64 KiB; larger values use artifact references.
- Replay/reconnect rechecks authorization and exposes no secrets, credentials, internal stacks, or absolute host paths.

### Commands and Recovery Exercise

From `spikes/research-durability/`:

```bash
bun install --frozen-lockfile
bun test
bunx tsc -p tsconfig.json --noEmit
bun run scenario:restart
```

`scenario:restart` must interrupt one process after a persisted boundary, start a fresh process against the same durable fixture store, resume, and write a machine-readable trace. Same-process retry is not cross-process evidence.
