# Validation Plan

## Acceptance Checks

- Confirm this deliverable is present, testable where applicable, and bounded to the step: The `ResearchEvent` union, checkpoint record shape, and cancellation lifecycle needed for a durable research run.
- Confirm this deliverable is present, testable where applicable, and bounded to the step: Prove how SSE delivery, append-only event persistence, and resume-from-checkpoint semantics line up for one interrupted run.
- Confirm this deliverable is present, testable where applicable, and bounded to the step: Name the exact restart-safe invariants: idempotent event append, monotonic checkpoint progress, and observable cancellation outcomes.
- The step leaves the next dependent step with a stable typed boundary, not a placeholder or undocumented assumption.

## Planned Verification

- Plan a restart scenario where a run is interrupted mid-step, resumes from the last persisted checkpoint, and replays events without duplicates.
- Plan a cancellation scenario where the client disconnects, reconnects, and still observes the terminal cancellation state from persisted events.
- Planned command once these packages exist: `bun test packages/domain packages/persistence` plus the nearest package-level `bun run typecheck`.
- Planned app/integration coverage once the app surfaces exist: `bun test apps/api apps/worker` for the API/worker/web path touched here.

## Edge Cases

- Duplicate cancel requests and duplicate event delivery must converge on one final run state.
- A checkpoint created before a large tool result should store a reference, not inline payloads that bloat resume state.
- Cancellation requested during checkpoint persistence must produce a consistent winner and documented resolution rule.

## Regression Expectations

- This step should remain a clean successor to [[02_Phases/Phase_00_architecture_spikes_and_delivery_foundations/Steps/Step_01_spike-fred-runtime-and-workflow-integration|STEP-00-01 Spike Fred Runtime and Workflow Integration]] rather than reworking already-planned scope upstream.
- Do not narrow or contradict the product brief, architecture notes, or phase sequencing without an explicit follow-up decision note.
- Do not invent package APIs that imply implementation already exists; keep language and artifacts clearly planned or spike-scoped.
- Make sure later Phase 1 work can start from these outputs without re-litigating repository layout, security boundaries, or evaluation gates.

## Security / Observability / Evaluation Focus

- Model all imported content as untrusted evidence and keep prompt-injection defenses visible in the design outputs.
- Call out checkpoint, event, filesystem, and SQL trust boundaries wherever a spike touches them.
- Prefer observable, restart-safe designs over opaque runtime magic.
- Trace every restart, cancel, and replay decision with run/step identifiers so operators can reconstruct the timeline after failure.

## Related Notes

- Step: [[02_Phases/Phase_00_architecture_spikes_and_delivery_foundations/Steps/Step_02_spike-live-events-cancellation-and-checkpoint-recovery|STEP-00-02 Spike Live Events Cancellation and Checkpoint Recovery]]
- Phase: [[02_Phases/Phase_00_architecture_spikes_and_delivery_foundations/Phase|Phase 00 architecture spikes and delivery foundations]]

## Refined Acceptance Contract

### Required Scenario Matrix

The deterministic harness must cover:

1. client disconnects; worker continues; authorized client reconnects and catches up;
2. explicit cancel before the next cooperative boundary;
3. duplicate cancel requests;
4. process crash after checkpoint persistence but before client delivery;
5. process crash after a domain side effect but before journal/checkpoint reconciliation;
6. large tool result stored by artifact reference;
7. late cancel after a committed terminal state;
8. cursor gap or expired retention with an explicit resync response;
9. authorization change before reconnect; and
10. cancellation requested while checkpoint persistence is in flight.

### Measurable Checks

- Event sequence is monotonic per `(runId, attempt)` and replay/dedupe produces one effective terminal state.
- Duplicate-side-effect rate across retry/resume is 0%.
- A fresh process resumes from the durable fixture store without repeating committed work.
- An authorized reconnect reaches the current terminal state; an unauthorized reconnect receives no event data.
- Explicit cancellation is observed within 2 seconds of the next cooperative checkpoint on the recorded local machine. If an operation cannot expose such a checkpoint, record it as a blocker/topology requirement rather than weakening the test.
- No event exceeds the 16 KiB target and no checkpoint exceeds 64 KiB; large data is referenced by ID/hash/size.
- Disconnect alone never changes run state. Cancel/complete races follow the documented durable-commit winner rule.
- User-facing events contain no secrets, credentials, internal stacks, or absolute host paths.

### Manual Recovery Review

- Review every crash-window row for an idempotency key, reconciliation action, audit event, and operator-visible terminal/partial outcome.
- Confirm Fred workflow ID is correlation metadata rather than the sole public job identity.
- Confirm SSE is a projection of durable journal state, not an in-memory hook stream.

### Pass / Fail and Handoff

- **PASS:** `bun test`, typecheck, and the separate-process restart scenario pass; all ten scenarios have trace evidence; replay, cancel, and reconciliation rules are explicit; downstream event/checkpoint consumers are named.
- **FAIL:** progress is memory-only, delivery is claimed exactly-once, duplicate effects occur, large data is inline, authorization is not rechecked, or restart evidence stays in one process.
- The Outcome must link the scenario traces and hand the stable contract to STEP-01-05 and later durability work.