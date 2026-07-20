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

| Resource | Limit |
| --- | ---: |
| Model calls | 1 |
| Tool calls | 2 |
| Concurrent branches | 2 |
| Elapsed time | 10,000 ms |
| Tokens | 10,000 |
| Estimated cost | 10 µUSD |
| Result rows | 10 |
| Result columns | 8 |
| Result-summary bytes | 32,768 |
| Claims | 8 |
| Output bytes | 65,536 |

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
