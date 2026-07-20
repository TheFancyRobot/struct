# Implementation Notes

- Capture durable findings learned during execution. Prefer short bullets with file paths, commands, and observed behavior.
- `packages/data-engine/src/result-summary.ts` produces an exact,
  deterministic, source-linked structured summary and rejects truncated or
  over-limit results instead of sampling them.
- `packages/research-engine/src/hybrid-synthesis.ts` admits only canonical
  `aligned` or `disclosed-mismatch` STEP-07-03 reconciliation results, rebuilds
  prompt identity during validation, and deterministically renders limitations.
- `packages/research-engine/src/quantitative-guardrails.ts` preserves numeric
  spellings without `Number` coercion, requires exact evidence/citation
  coverage and semantics, and rejects invented quantities, citation drift, and
  concealed unit, denominator, window, filter, cohort, version, or join-key
  mismatches.
- `packages/workflows/src/agents/research-execution.ts` and
  `packages/workflows/src/adapters/fred-runtime.ts` add only the existing
  focused Fred one-step, tool-free narrator entry. Deterministic code retains
  approval and persistence gates.
- Regression coverage includes exact decimals, huge integers, zero, null,
  semantic mismatch, contradiction, insufficiency, unauthorized joins, altered
  values, forged summaries, citation drift, deterministic replay, stale
  identity, and byte bounds.
- Root review bound limitations into reconciliation identity, made summary and
  synthesis byte ceilings cover the exact returned objects, and added replay
  regressions for forged limitations and payload-only size overflow.

## Related Notes

- Step: [[02_Phases/Phase_07_hybrid_cross_source_research/Steps/Step_04_build-hybrid-synthesis-with-quantitative-guardrails|STEP-07-04 Build Hybrid Synthesis with Quantitative Guardrails]]
- Phase: [[02_Phases/Phase_07_hybrid_cross_source_research/Phase|Phase 07 hybrid cross source research]]
