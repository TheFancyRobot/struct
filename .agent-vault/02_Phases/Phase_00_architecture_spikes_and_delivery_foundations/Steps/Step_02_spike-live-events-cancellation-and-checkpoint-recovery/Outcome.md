# Outcome

- Result: completed.
- Deliverables landed:
  - `docs/spikes/live-events-cancellation-and-checkpoint-recovery.md`
  - `spikes/research-durability/` proving harness
  - `spikes/research-durability/artifacts/restart-scenario.trace.json`
- Proven boundary:
  - product code owns the append-only research event journal, cursor replay, authorization rechecks, cancel intent, and compact checkpoint record;
  - Fred workflow identity remains correlation metadata rather than the public run identity; and
  - large intermediate outputs stay artifact-referenced instead of being embedded in events or checkpoints.
- Scenario coverage completed:
  - twelve deterministic scenarios now prove reconnect replay, duplicate cancel, retention gaps, auth changes, large-artifact references, cross-process resume, crash-window reconciliation, and terminal-event recovery after append-before-state-write;
  - the restart proof runs in two distinct processes with exit codes `86` then `0` and duplicate side-effect rate `0`.
- Reviewer follow-up completed:
  - terminal recovery is now journal-aware, so a crash after appending `research-completed` or `research-cancelled` reconciles the existing terminal event into durable state instead of emitting a duplicate terminal event on resume.
- STEP-01-05 handoff:
  - use public event identity `(runId, attempt, sequence)` and cursor form `cursor:<attempt>:<sequence>`;
  - derive SSE from the durable journal with explicit `events`, `resync-required`, and `forbidden` reconnect outcomes; and
  - honor the winner rule that only a cancel persisted before terminal commit becomes `research-cancelled`.

## Validation Evidence

- Command set run from `spikes/research-durability/`:
  - `bun install --frozen-lockfile`
  - `bun test`
  - `bunx tsc -p tsconfig.json --noEmit`
  - `bun run scenario:restart`
- Observed results:
  - frozen install unchanged
  - test suite: `15 pass / 0 fail`
  - typecheck: pass
  - generated restart trace: attempt count `2`, process exit codes `86` then `0`, duplicate side-effect rate `0`

## Follow-Up

- STEP-01-05 should consume the published event/cursor/checkpoint contract when building the canonical API and worker streaming path.

## Related Notes

- Step: [[02_Phases/Phase_00_architecture_spikes_and_delivery_foundations/Steps/Step_02_spike-live-events-cancellation-and-checkpoint-recovery|STEP-00-02 Spike Live Events Cancellation and Checkpoint Recovery]]
- Phase: [[02_Phases/Phase_00_architecture_spikes_and_delivery_foundations/Phase|Phase 00 architecture spikes and delivery foundations]]
