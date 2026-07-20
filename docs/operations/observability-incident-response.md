# Observability and incident response

This is the v1 operator contract for the Bun API and worker plus the existing
Compose PostgreSQL and authenticated data-engine services. It requires no
external telemetry vendor. JSON logs, OpenTelemetry spans, Prometheus text
metrics, durable run/job events, and the commands already in this repository
are the evidence sources.

## Signal and privacy contract

Every instrumented boundary uses the same `@struct/observability` path and the
bounded dimensions `boundary`, `outcome`, `classification`, and `error.tag`.
Correlation fields are request, workspace, project, run, job, source, and
report IDs. IDs may appear in logs and spans but never metric labels. Metric
names are fixed at build time, such as `struct_database_failure_total` and
`struct_sse_success_total`, so user input cannot increase cardinality.

Support diagnostics are JSON schema version `1`, at most 4,096 UTF-8 bytes,
and contain only event, boundary, outcome, classification, correlation IDs,
duration, safe error tag, and redacted bounded details. Never attach source
content, source names or paths, prompts, SQL, authorization headers, cookies,
credentials, provider requests/responses, or raw nested error causes. The
redactor replaces sensitive keys and credential/email patterns, limits strings
to 160 characters, arrays to 10 items, objects to 24 fields, and nesting to
three levels.

Failed and interrupted operations retain their original Effect exit for the
caller, but exporters receive only a successful telemetry envelope carrying
the sanitized `outcome`, `classification`, and `error.tag` attributes. Raw
error messages, causes, and stacks are never delegated to automatic span error
serialization.

`GET /healthz` proves only that the process can answer. `GET /readyz` proves
that the process has completed startup and its required database is reachable.
The data-engine's authenticated `/healthz` is checked separately by
`bun run ops database:verify`. Never use liveness as a rollout or rollback
gate; `bun run ops application:verify` uses readiness.

## Dashboard and alerts

Use four panels with a five-minute window:

1. Availability: API/worker `/readyz`, PostgreSQL Compose health, and
   authenticated data-engine health.
2. Lifecycle: fixed success/failure counters for request, workspace, run, job,
   tool, database, sidecar, SSE, and report boundaries.
3. Durable work: ready/running job counts, oldest heartbeat age, terminal run
   classifications, cancellation age, and retry exhaustion from persisted
   job/run events.
4. Capacity: compare observed durations with the measured v1 limits: document
   retrieval 2 s, structured query 5 s, bounded research 10 s, report fidelity
   5 s, SSE batches of 100 within 2 s, and recursive 25,000-file work within
   600 s. The canonical evidence is
   `packages/evaluation/results/v1-performance-resilience-v1.json`.

Alert only on actionable, bounded conditions:

| Alert | Trigger | First action |
| --- | --- | --- |
| Dependency unavailable | readiness or Compose health fails for 60 s | identify DB or data-engine, then use its runbook |
| Worker stalled | running job heartbeat is older than configured stale limit for two polls | inspect durable job events, then restart one worker |
| Research stuck | run exceeds its typed elapsed budget without a terminal event | request cancellation and verify one terminal disposition |
| SSE reconnect storm | more than 10 reconnects for one run in 5 minutes or a 100-event poll exceeds 2 s | verify API readiness and cursor progress |
| Backup failure | backup exits nonzero or archive validation fails | retain last known-good archive; do not reset/restore |
| Secret exposure | any secret scanner or redaction canary matches | contain access and rotate the exact exposed credential |

## Database outage runbook

Detection: API or worker `/readyz` returns 503 with `database` classified
`dependency-unavailable`, while `/healthz` remains 200. Diagnose with
`docker compose ps` and `bun run ops database:verify`. Contain by pausing
new commands; do not reset the greenfield database merely to clear an outage.
Recover with `docker compose restart postgres`, wait for Compose health, then
run `bun run ops database:verify` and `bun run ops application:verify`.
Verify that the same run/job IDs resume or reach one typed terminal event and
that duplicate durable effects remain zero.

## Worker stall runbook

Detection: a running job heartbeat exceeds `WORKER_JOB_STALE_MS` for two poll
intervals without terminal progress. Diagnose the correlated job/run events
and worker readiness; do not inspect source content. Contain by stopping the
single stalled worker. Recover by starting one replacement worker; stale-job
recovery owns the durable lease. Verify a renewed heartbeat and exactly one
completed, failed, or cancelled terminal event.

## Sidecar outage runbook

Detection: authenticated data-engine health fails or sidecar boundary failures
are classified `dependency-unavailable`. Diagnose with `docker compose ps` and
`bun run ops database:verify`. Contain by allowing the typed dataset tool
failure to stop the affected run; do not bypass deterministic SQL. Recover with
`docker compose restart data-engine` and re-run dependency verification.
Verify an authenticated health response and a deterministic query smoke test;
the original failure must retain its correlation IDs.

## Stuck or cancelled research runbook

Detection: a run exceeds its typed elapsed budget, has a stale heartbeat, or a
cancellation request lacks a terminal event. Diagnose its persisted plan,
checkpoint, cancellation status, and bounded event tags. Contain by using the
existing idempotent cancellation endpoint once. Recover by allowing the worker
to checkpoint/finalize or persist `cancelled`; replace a stalled worker only
after its lease becomes stale. Verify one terminal classification and no
post-terminal events or duplicate citations.

## SSE reconnect storm runbook

Detection: more than 10 reconnects for one run in five minutes, repeated
`sse.failure`, or a 100-event bounded poll above 2 s. Diagnose API readiness,
the last event cursor, heartbeat frames, and durable cursor progress. Contain
by backing off the client; never reconnect without the last cursor. Recover
after readiness and cursor reads stabilize. Verify cursor-resume delivers no
duplicate event IDs and each pull remains capped at 100 events.

## Backup or restore failure runbook

Detection: `bun run ops database:backup` or restore/recovery proof exits
nonzero, checksum/archive validation fails, or restored fingerprints differ.
Contain by preserving the last known-good `.dump` and artifact snapshot; never
promote a partial archive. Diagnose credentials, free disk, archive confinement,
and `pg_restore --list`. Recover only with a validated archive using the exact
guarded command in `docs/operations/deployment-recovery.md`. Verify the seeded
fingerprint, artifact hashes, append-only guards, dependency health, and
application readiness.

## Secret exposure runbook

Detection: `bun run secrets:scan`, a redaction canary, or a reviewer finds a
credential/provider payload in code, logs, traces, diagnostics, or artifacts.
Contain by restricting access to the affected output and stopping further
export. Identify the exact secret class without copying its value. Rotate and
revoke the credential at its owner, remove the exposed output, and re-run
`bun run secrets:scan`. Verify the old credential is rejected, the new one
works through readiness, and an adversarial support diagnostic contains only
`[REDACTED]`/`[TRUNCATED]` markers.

## Game-day verification

Run `bun test --max-concurrency 1 packages/observability/src/game-day.test.ts`.
It injects each failure classification without changing Compose state, verifies
liveness/readiness separation, checks all seven runbook contracts and measured
budget references, and proves diagnostic redaction and size limits.
