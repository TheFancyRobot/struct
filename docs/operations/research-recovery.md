# Research Recovery

Phase 05 recovery composes the product-owned PostgreSQL event journal and
artifact-reference checkpoint with Fred orchestration. Bun is the only host
runtime. DuckDB runs only in the authenticated, internal-network Node 24
Compose sidecar.

## Automated recovery classes

- Planning commit: reopen the same run and load the schema-decoded plan from
  `ResearchExecutionRepo.loadDurableState`; never ask the model to plan again.
- Tool/checkpoint commit: select `resume` or `finalize` from the committed
  checkpoint. The live gate executes a real dataset query, commits its
  content-addressed result artifact and checkpoint/event idempotently, then
  proves a replacement process makes zero dataset-provider calls. Completed
  nodes must not execute SQL, retrieval, or synthesis again.
- Cancellation: call `requestCancellation` with the same idempotency key.
  Replays return the stored decision and create no second terminal event.
- Provider failure: retain the typed failure tag and bounded retry history.
  Retry only failures allowed by the tool retry policy; permanent, exhausted,
  cancelled, or unsafe retries stop with operator-readable diagnostics.
- Sidecar failure: keep the Bun host serving, surface the typed transport
  failure, restart the isolated sidecar, wait for authenticated health, and
  retry only an uncommitted idempotent query.

## Operator recovery classes

- Configuration/authentication failures require correcting the credential or
  endpoint before retry.
- Invalid plan, graph, tool, capability, or budget failures require correcting
  input or policy; operators must not broaden grants or budgets to force a pass.
- Missing/corrupt artifact references and checkpoint identity mismatches are
  release-blocking integrity defects. Do not reconstruct them from model text.
- Terminal runs are immutable. Start a new run for a new question; never reset
  a completed, failed, or cancelled aggregate in place.

## Prompt and model-version resume policy

Resume the persisted normalized plan and checkpoint with the exact recorded
prompt contract, output schema, provider package, and model version. Do not
silently re-plan or switch models during resume. If the pinned model is
unavailable before a plan commits, record a typed planning failure. If it
becomes unavailable after a plan commits, retain the plan and stop for an
explicit operator decision; a replacement run may use a new model version, but
the existing run may not.

## Verification and thresholds

```sh
DATABASE_URL=postgres://struct:struct@127.0.0.1:5432/struct \
DATA_ENGINE_URL=http://127.0.0.1:4300 \
DATA_ENGINE_TOKEN=struct-local-data-engine-token \
ARTIFACT_STORAGE_ROOT=.local/artifacts \
bun test --timeout 60000 --max-concurrency 1 \
  apps/worker/test/research-replay.integration.test.ts
```

The release gate requires one aggregate terminal state, zero duplicate durable
effects, zero replayed completed tool actions, a by-reference checkpoint no
larger than 65,536 bytes, replay reconstruction within 1,000 ms, and sidecar
recovery within 10,000 ms. It also requires restart gates after plan commit,
after a dataset-query attempt but before its durable commit, after checkpoint
commit, and during cancellation. The July 20, 2026 reference run measured a
1,158-byte checkpoint, 12.099 ms replay reconstruction, and 259 ms sidecar
recovery. These wall-clock measurements stay outside the deterministic report
hash.
