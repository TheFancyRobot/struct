# Live Events Cancellation and Checkpoint Recovery Spike

## Goal

Prove the smallest product-owned contract for durable research progress, cancellation, replay, and restart recovery before Phase 1 creates canonical `apps/` and `packages/` code.

## Result

The spike shows that the product should own a compact **run journal + checkpoint + SSE projection** contract on top of Fred orchestration:

1. **Journal:** append-only research events with stable `(runId, attempt, sequence)` identity.
2. **Checkpoint:** compact run state for the current step, completed step references, budget use, cancel intent, Fred correlation, and artifact references.
3. **Projection:** authorized SSE replay from the durable journal, with cursor-based reconnect, explicit retention-gap handling, and at-least-once delivery.
4. **Recovery:** a fresh process can resume from the durable store after a crash without replaying a committed side effect, and terminal journal entries can be reconciled back into durable state without duplicating terminal events.
5. **Cancellation:** disconnect alone never cancels work; only persisted cancel intent can win, and it wins only when recorded before the terminal commit.

This remains a **product-local adapter**. Fred hook points remain correlation inputs, not the user-facing durability contract.

## Disposable Harness

- Harness root: `spikes/research-durability/`
- Typed contracts: `spikes/research-durability/src/contracts.ts`
- Scenario engine: `spikes/research-durability/src/research-durability.ts`
- Separate-process restart driver: `spikes/research-durability/src/restart-driver.ts`
- Scenario coverage: `spikes/research-durability/test/research-durability.test.ts`
- Restart trace command: `bun run scenario:restart`
- Generated trace artifact: `spikes/research-durability/artifacts/restart-scenario.trace.json`

The harness is intentionally disposable. It proves Phase 1 boundaries without claiming to be production code.

## Stable Public Research Event Contract

Minimum public event union proved by the spike:

| Event | Purpose | Required payload |
| --- | --- | --- |
| `research-started` | Run accepted and durable | question, sourceVersionId, heartbeatSeconds |
| `plan-created` | One bounded plan is persisted | stepIds, budgetPolicy |
| `step-started` | A step entered execution | stepId, optional resumedFromAttempt |
| `step-completed` | A step committed an observable result | stepId, artifactRef, checkpointCursor |
| `answer-streaming` | UI may render provisional answer text | delta, done |
| `research-completed` | Successful terminal state | reportArtifactId |
| `research-failed` | Safe terminal failure | code, message |
| `research-cancelled` | Durable cancel won before terminal commit | reason, winner |

Contract rules:

- Event identity is `(runId, attempt, sequence)` plus cursor `cursor:<attempt>:<sequence>`.
- Sequence is monotonic within an attempt.
- Delivery is **at least once**; consumers deduplicate by identity/cursor.
- Event payloads stay under **16 KiB** and reference large artifacts by ID/hash/size.
- SSE is a projection of journal state, not an in-memory hook stream.

## Stable Checkpoint Record

The proved compact checkpoint shape is:

- `runId`
- `attempt`
- `currentStep`
- `completedStepRefs`
- `budgetSnapshot`
- `cancelRequested`
- `fredCorrelation`
- `artifactRefs`
- `lastEventSequence`
- `serializedBytes`

Checkpoint rules:

- Keep serialized size under **64 KiB**.
- Store large intermediate data only as artifact references.
- Fred workflow identity is correlation metadata, not the public run ID.
- The product checkpoint remains authoritative even when Fred resume is also used.

## Cancellation Lifecycle

Winner rule proved by the harness:

1. Client disconnect does nothing to run state.
2. Explicit cancel persists durable intent in the run state.
3. Workers check cancel at cooperative boundaries and during checkpoint-safe transitions.
4. If cancel is recorded **before** the terminal commit, the terminal event is `research-cancelled`.
5. Duplicate cancel requests are audited no-ops.
6. A cancel arriving **after** terminal completion is an audited no-op and does not rewrite history.

## Scenario Matrix

The deterministic harness covers all ten required scenarios plus two explicit terminal-append recovery regressions:

| Scenario | Proof |
| --- | --- |
| client disconnects, worker continues, authorized reconnect catches up | journal replay returns remaining events and terminal state |
| explicit cancel before next cooperative boundary | durable cancel intent wins and terminal event is `research-cancelled` |
| duplicate cancel requests | exactly one cancellation terminal event; duplicate request is audited |
| process crash after checkpoint persistence but before client delivery | attempt 2 resumes from durable store without replaying committed work |
| process crash after a domain side effect but before reconciliation | recovery reconciles durable side effect into checkpoint + journal |
| large tool result stored by artifact reference | checkpoint/event payloads stay small while artifact bytes exceed checkpoint budget |
| late cancel after terminal state | final state stays completed; late cancel is audited no-op |
| cursor gap / expired retention | reconnect gets explicit `resync-required` response |
| authorization change before reconnect | reconnect is denied and receives no event data |
| cancel during checkpoint persistence | cancel intent wins before terminal commit |
| crash after appending `research-completed` but before final state write | recovery reconciles the existing terminal journal event instead of emitting a duplicate |
| crash after appending `research-cancelled` but before final state write | recovery reconciles the existing terminal cancel event instead of emitting a duplicate |

## Crash-Window Matrix

| Failure window | Durable fact already written | Recovery rule |
| --- | --- | --- |
| after domain side effect, before checkpoint/journal reconciliation | side effect marker only | resume attempt reuses committed effect and writes missing checkpoint/events |
| after checkpoint persistence, before client delivery | compact checkpoint + side effect marker | resume attempt replays terminal journal events without rerunning effect |
| during checkpoint persistence with concurrent cancel | cancel intent + partial pre-terminal state | cancel wins if durable before terminal commit |
| after appending `research-completed`, before final state persistence | terminal journal event plus pre-terminal durable state | reconcile state from the existing terminal journal event; do not emit a second terminal event |
| after appending `research-cancelled`, before final state persistence | terminal cancel journal event plus pre-terminal durable state | reconcile state from the existing terminal journal event; do not emit a second terminal event |
| after terminal completion | terminal event and final run status | later cancel is audited no-op |

## Product-Local Defaults Confirmed

- Public run identity is product `runId`; Fred IDs stay correlated but secondary.
- SSE heartbeat target remains **15 seconds**.
- Event payload target remains **16 KiB**.
- Checkpoint payload target remains **64 KiB**.
- Reconnect re-checks authorization every time.
- Slow/expired reconnects receive an explicit resync path rather than silent data loss.

## Stable Handoff to STEP-01-05

STEP-01-05 may rely on these outputs without reopening this spike:

- A stable public research event set with cursor identity and terminal semantics.
- At-least-once replay with client dedupe by cursor/identity. Canonical
  persistence must allocate cursors in commit-visible order; a plain
  PostgreSQL sequence is insufficient because sequence allocation is not
  transactional.
- Product-owned checkpoint authority with bounded artifact references.
- The winner rule: persisted cancel intent beats terminal completion only when recorded first.
- `resync-required` and `forbidden` reconnect outcomes as explicit API/SSE boundary behavior.

## Deferred Work

Still deferred to later phases:

- canonical API route implementations in `apps/api`
- canonical worker repositories and persistence adapters in `packages/persistence`
- real Fred hook-to-journal adapter wiring in production workflows
- retention-window policy tuning and operator controls
- multi-step progress trees beyond this single bounded step proof

## Validation Evidence

Run from `spikes/research-durability/`:

```bash
bun install --frozen-lockfile
bun test
bun --bun tsc -p tsconfig.json --noEmit
bun run scenario:restart
```

Expected evidence:

- all twelve deterministic scenarios pass
- restart scenario uses two distinct processes
- duplicate side-effect rate remains `0`
- one effective terminal event exists per scenario
- event and checkpoint payload budgets stay within target
- generated machine-readable trace lands at `artifacts/restart-scenario.trace.json`

## Reuse vs Discard

- **Reuse conceptually:** event identity, checkpoint shape, cancel winner rule, replay outcomes, and crash-window reconciliation rules.
- **Reimplement canonically in Phase 1:** repositories, transaction boundaries, worker orchestration, and public API/SSE routes.
- **Discard directly:** the disposable spike harness itself once Phase 1 absorbs the contract.
