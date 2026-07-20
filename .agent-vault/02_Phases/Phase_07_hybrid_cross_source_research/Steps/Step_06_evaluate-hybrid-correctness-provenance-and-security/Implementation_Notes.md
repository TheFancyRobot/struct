# Implementation Notes

- Capture durable findings learned during execution. Prefer short bullets with file paths, commands, and observed behavior.

## Deterministic Hybrid Release Gate — 2026-07-20

- Added a checked-in Phase 07 evaluation that executes the production
  `routeResearchPlan`, evidence normalization, reconciliation, and
  quantitative synthesis guards.
- The fixture covers document-only, dataset-only, recursive-only, mixed
  aligned, version/timezone mismatch, contradiction, and insufficiency cases.
  Document and dataset prompt injections remain untrusted data and cannot
  alter citations, route authority, or resource limits.
- Report status and pass/fail counts are derived from executed criteria.
  Resource evidence derives observed model/tool calls, concurrency,
  deterministic elapsed units, tokens, estimated cost, rows, claims, and
  artifact bytes against explicit ceilings.
- Verification checks JSON/schema, canonical newline, outer hash, then
  re-executes the authoritative evaluation. Recomputed-hash tampering of IDs,
  status, counts, criterion evidence/inventory, fixture/provenance hashes,
  taxonomy, report hash, or newlines is rejected.
- Failure taxonomy is backed by executed wrong-route, stale-citation,
  unsupported-reconciliation, and injection-containment outcomes.

## Related Notes

- Step: [[02_Phases/Phase_07_hybrid_cross_source_research/Steps/Step_06_evaluate-hybrid-correctness-provenance-and-security|STEP-07-06 Evaluate Hybrid Correctness Provenance and Security]]
- Phase: [[02_Phases/Phase_07_hybrid_cross_source_research/Phase|Phase 07 hybrid cross source research]]
