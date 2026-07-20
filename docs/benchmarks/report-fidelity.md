# Report Fidelity Evaluation

The Phase 08 report-fidelity gate is a deterministic bounded evaluation of the
shipped domain, research-engine normalization, report export, object-storage,
and API contracts. It is not a model-quality benchmark and does not call an
external service.

## Corpus

The canonical seed is `struct-report-fidelity-2026-07-20`. The 26 cases cover:

- document, dataset, recursive, and hybrid evidence;
- generated and user-authored revisions with immutable evidence;
- draft, valid, stale, broken, unauthorized, incompatible, superseded, and
  publishable citations;
- unsupported and contradicted claim rejection;
- source refresh/reindex drift and audited repair;
- restart/replay without duplicate revisions;
- deterministic export verification and download after storage reopen;
- authorization and prompt-injection containment; and
- explicit resource limits.

The evaluator calls the same Effect schemas, citation state machine, report
publication gate, evidence normalizer, report-export builder, and offline
verifier used by the product. Each of the eight citation-state cases constructs
the report input appropriate to each gate and records the actual Effect success
or typed failure from both publication preparation and export. The export probe
keeps the report shell publishable so it reaches the citation-policy guard;
only a `publishable` citation succeeds, while every other state returns
`citation-not-valid` with the blocking claim identity.
The API integration test calls the shipped route and local content-addressed
object store.

## Limits and result

| Measure | Maximum | Recorded evidence |
| --- | ---: | --- |
| Wall-clock runtime | 5,000 ms | Measured on every runner invocation and enforced with `Effect.timeout`; printed to stderr because host timing is intentionally outside the canonical semantic hash |
| Concurrency | 1 | 1 |
| Artifact bytes | 1,048,576 | Derived from the canonical bundle |
| Evaluation cases | 32 | 26 |

The tracked result is
`packages/evaluation/results/phase-08-report-fidelity-v1.json`. It records exact
case IDs, counts, observed evidence, per-case hashes, resource observations, and
an outer canonical hash. Serialization uses sorted canonical JSON with exactly
one trailing newline. The runner records the measured wall-clock duration as
`report-fidelity wall-clock <observed>ms/5000ms`; the test suite independently
asserts that measurement. Keeping host timing outside the artifact makes semantic
replay byte-identical without pretending a constant is elapsed time.

## Tamper resistance

The verifier parses the artifact through Effect Schema, validates the newline
contract, recomputes the outer hash, reruns the complete deterministic
evaluation, and compares canonical bytes. Tests independently mutate status,
counts, case IDs, claim evidence, source-version drift, repair history, export
digest, resource metrics, limits, outer hash, schema, and newline form.

This means an attacker cannot conceal semantic tampering by recomputing only the
outer hash.

## Commands

Verify the tracked artifact and focused tests:

```sh
bun run --filter @struct/evaluation phase-08:eval
```

Regenerate only after the implementation and expectations were intentionally
changed:

```sh
bun run --filter @struct/evaluation phase-08:generate
```

Run the API/storage round-trip:

```sh
bun test --max-concurrency 1 apps/api/test/report-export.integration.test.ts
```
