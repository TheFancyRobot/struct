# Implementation Notes

- Capture durable findings learned during execution. Prefer short bullets with file paths, commands, and observed behavior.
- `packages/domain/src/cross-source-evidence.ts` defines one lossless
  document/dataset/recursive envelope, explicit comparison semantics, and the
  five reconciliation outcomes without adding a model or executor.
- `packages/research-engine/src/normalize-evidence.ts` validates exact document
  locators, dataset query/citation/snapshot/row lineage, and Phase 06 recursive
  evidence identities before canonicalizing order, IDs, and duplicate
  limitations.
- `packages/research-engine/src/reconcile-findings.ts` discloses unit, window,
  timezone, version, filter, cohort, denominator, and join mismatches; retains
  contradictions; reports partial inputs as insufficient; and rejects
  unauthorized joins without guessing transformations.
- Root review added explicit authorized dataset-snapshot scope, canonicalized
  evidence IDs independently of filter/join ordering, bounded semantic strings,
  and collision-safe missing-value labels.

## Related Notes

- Step: [[02_Phases/Phase_07_hybrid_cross_source_research/Steps/Step_03_normalize-and-reconcile-cross-source-evidence|STEP-07-03 Normalize and Reconcile Cross-Source Evidence]]
- Phase: [[02_Phases/Phase_07_hybrid_cross_source_research/Phase|Phase 07 hybrid cross source research]]
