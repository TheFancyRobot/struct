# Hybrid research evaluation

STEP-07-06 closes Phase 07 with a deterministic, checked-in release gate for
mixed document and dataset research. The fixture executes the production
normalization, reconciliation, and synthesis guardrails; it does not score
hard-coded prose.

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
  by dropping its required evidence and dataset citations is rejected by the
  production validator.
- Repeated execution is byte-identical. The verifier checks schema, one
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
| Model calls | 1 | `packages/workflows` + `apps/worker` | routed synthesis branch and `resources.observedModelCalls` | typed budget failure; gate fails |
| Tool calls | 2 | `packages/workflows` | authorized routed branches and `resources.observedToolCalls` | unsupported/excess tool use is rejected; gate fails |
| Concurrent branches | 2 | `packages/workflows` + `apps/worker` | dependency-free routed branches and `resources.observedConcurrency` | excess fan-out is rejected; gate fails |
| Elapsed time | 10,000 ms | `apps/worker` | bounded execution trace and `resources.observedElapsedMilliseconds` | timeout interrupts execution with a typed failure; gate fails |
| Tokens | 10,000 | `packages/workflows` | synthesis output accounting and `resources.observedTokens` | token budget exhaustion stops synthesis; gate fails |
| Estimated cost | 10 µUSD | `packages/workflows` | routed model/tool accounting and `resources.observedEstimatedCostMicros` | cost budget exhaustion stops synthesis; gate fails |
| Result rows | 10 | `packages/data-engine` + `packages/research-engine` | bounded query summary and `resources.maximumRows` | oversized result summary is rejected; gate fails |
| Result columns | 8 | `packages/data-engine` + `packages/research-engine` | bounded query summary and `resources.maximumColumns` | oversized result summary is rejected; gate fails |
| Result-summary bytes | 32,768 | `packages/research-engine` | canonical query summary and `resources.maximumSummaryBytes` | `output-too-large`; gate fails |
| Claims | 8 | `packages/research-engine` | validated claims and `resources.maximumClaims` | `output-too-large`; gate fails |
| Output bytes | 65,536 | `packages/research-engine` | canonical synthesis artifact and `resources.observedArtifactBytes` | `output-too-large`; gate fails |

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
