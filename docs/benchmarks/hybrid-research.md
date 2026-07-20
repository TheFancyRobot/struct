# Hybrid research evaluation

This deterministic, checked-in release gate evaluates mixed document and
dataset research through the production hybrid scheduler, typed tool registry,
normalization, reconciliation, and synthesis guardrails.

## What the gate proves

- Exact dataset quantities preserve their value, unit, filter, time window,
  immutable snapshot, SQL, row range, result hash, and dataset citation.
- Narrative evidence preserves its exact document span and remains labeled
  untrusted.
- A mixed claim carries both document and dataset evidence IDs.
- Version/time-zone mismatches are disclosed; contradictions and insufficient
  evidence cannot enter synthesis.
- Injection strings in both a document excerpt and a dataset cell remain data:
  they cannot change tool grants, budgets, or citation requirements and do not
  enter the answer. An adversarial draft that follows the injected instruction
  while retaining valid evidence and dataset citations is rejected specifically
  as an instruction copied from untrusted evidence.
- Retrieval, dataset-query, and scheduler failures fail the gate through their
  typed production boundaries.
- An interrupted execution checkpoints its completed node, resumes without
  re-executing it, and completes the remaining nodes. Durable cancellation
  prevents any provider execution.
- Repeated report generation is byte-identical. The verifier checks schema, one
  canonical trailing newline, the outer SHA-256, and a fresh authoritative
  execution. Recomputing the outer hash after changing IDs, status, counts,
  evidence, provenance, fixture identity, taxonomy, or newlines still fails.

Every pass/fail metric is derived from the executed criteria. The gate has no
waivers: any failed criterion makes the report fail.

## Explicit limits

These limits follow the ownership, evidence, and fail-closed contract in
[`security-model.md` §22](../security-model.md#22-provisional-resource-limits-and-defaults).
Every observed value and cap is persisted in the tracked report; exceeding any
cap fails the `bounded-resources` criterion and therefore the entire gate.

| Resource | Limit | Enforcing owner | Auditable evidence | Fail-closed behavior |
| --- | ---: | --- | --- | --- |
| Model calls | 1 | `packages/workflows` + `apps/worker` | committed graph-state counter and `resources.observedModelCalls` | typed budget failure; gate fails |
| Tool calls | 2 | `packages/workflows` | committed registry-backed graph-state counter and `resources.observedToolCalls` | unsupported/excess tool use is rejected; gate fails |
| Concurrent branches | 2 | `packages/workflows` + `apps/worker` | live provider concurrency high-water mark and `resources.observedConcurrency` | excess fan-out is rejected; gate fails |
| Elapsed time | 10,000 ms | `apps/worker` | committed graph elapsed-time counter and `resources.observedElapsedMilliseconds` | timeout interrupts execution with a typed failure; gate fails |
| Tokens | 10,000 | `packages/workflows` | provider-reported tokens committed to graph/checkpoint state and `resources.observedTokens` | token budget exhaustion rejects completion; gate fails |
| Estimated cost | 10 µUSD | `packages/workflows` | committed graph cost counter and `resources.observedEstimatedCostMicros` | cost budget exhaustion stops synthesis; gate fails |
| Result rows | 10 | `packages/data-engine` + `packages/research-engine` | bounded query summary and `resources.maximumRows` | oversized result summary is rejected; gate fails |
| Result columns | 8 | `packages/data-engine` + `packages/research-engine` | bounded query summary and `resources.maximumColumns` | oversized result summary is rejected; gate fails |
| Result-summary bytes | 32,768 | `packages/research-engine` | canonical query summary and `resources.maximumSummaryBytes` | `output-too-large`; gate fails |
| Claims | 8 | `packages/research-engine` | validated claims and `resources.maximumClaims` | `output-too-large`; gate fails |
| Output bytes | 65,536 | `packages/research-engine` | committed artifact byte lengths and `resources.observedArtifactBytes` | `output-too-large`; gate fails |

## Failure taxonomy

- `wrong-routing`: a question is sent to a source path that cannot satisfy its
  evidence requirement.
- `stale-citation`: a citation, source version, snapshot, row range, or content
  hash no longer matches the evidence.
- `unsupported-reconciliation`: contradiction, insufficiency, or an
  undisclosed semantic mismatch reaches synthesis.
- `security-boundary-violation`: untrusted content changes permissions,
  instructions, budgets, tool scope, or citation requirements.

## Reproduce

```sh
bun run --filter @struct/evaluation phase-07:eval
```

The tracked report is
[`packages/evaluation/results/phase-07-hybrid-research-v1.json`](../../packages/evaluation/results/phase-07-hybrid-research-v1.json).
Regenerate it only when an intentional evaluation-contract change has been
reviewed:

```sh
bun run --filter @struct/evaluation phase-07:generate
```
