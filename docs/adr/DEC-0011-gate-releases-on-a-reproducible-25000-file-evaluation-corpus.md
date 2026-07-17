# DEC-0011: Gate Releases on a Reproducible 25,000-File Evaluation Corpus

## Status

Accepted.

## Context

The product must prove correctness, resilience, and scale against the actual workload it is designed for: large mixed-source research, including directories with roughly 25,000 JSON files. Manual demos and model-as-judge checks alone are not enough to validate exact SQL behavior, provenance, refresh semantics, recursive analysis coverage, and prompt-injection resistance.

## Decision

Create a reproducible evaluation corpus generator and treat its outputs as a release gate. The corpus must include structured-file scale, schema variation, known trends, contradictions, prompt-injection strings, associated documents, associated code, and deterministic ground truth. Major phases and especially v1 release readiness are blocked until the relevant evaluation suites pass.

## Alternatives

- Validate the product with ad hoc hand-built examples only.
- Rely on a much smaller corpus that does not represent target scale.
- Use only qualitative review or model scoring without deterministic assertions.

## Consequences

- Delivery gets a hard quality bar for exact answers, citation fidelity, and large-corpus behavior.
- The team must invest early in corpus generation, fixtures, and regression automation.
- Release velocity may slow in the short term, but confidence in correctness and reproducibility rises substantially.
- Performance and coverage regressions become easier to detect before they reach users.

## Related Phase

- [PHASE-04 Structured Datasets and Deterministic SQL](../../.agent-vault/02_Phases/Phase_04_structured_datasets_and_deterministic_sql/Phase.md)
