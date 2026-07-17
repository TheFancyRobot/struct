# Implementation Notes

- `spikes/research-durability/src/contracts.ts` defines the public `ResearchEvent` union, cursor identity, artifact references, and compact checkpoint record with `16 KiB` event and `64 KiB` checkpoint targets.
- `spikes/research-durability/src/research-durability.ts` now proves twelve deterministic scenarios, including reconnect replay, duplicate cancel, retention gaps, authorization changes, crash reconciliation, terminal-event recovery after append-before-state-write, and the cancel-wins-before-terminal-commit rule.
- The terminal recovery fix is journal-aware: if a crash lands after `research-completed` or `research-cancelled` is appended but before final state persistence, recovery reconciles the existing terminal journal event back into durable state instead of starting a new attempt and emitting a duplicate terminal event.
- `spikes/research-durability/src/restart-driver.ts` and `src/restart-child.ts` run the restart proof in two child processes and now reset prior fixture-store artifacts so repeated `scenario:restart` runs stay bounded to two attempts.
- `docs/spikes/live-events-cancellation-and-checkpoint-recovery.md` is the durable recommendation document and names the stable handoff for STEP-01-05.
- Validation command: `cd spikes/research-durability && bun install --frozen-lockfile && bun test && bunx tsc -p tsconfig.json --noEmit && bun run scenario:restart`.

## Related Notes

- Step: [[02_Phases/Phase_00_architecture_spikes_and_delivery_foundations/Steps/Step_02_spike-live-events-cancellation-and-checkpoint-recovery|STEP-00-02 Spike Live Events Cancellation and Checkpoint Recovery]]
- Phase: [[02_Phases/Phase_00_architecture_spikes_and_delivery_foundations/Phase|Phase 00 architecture spikes and delivery foundations]]
