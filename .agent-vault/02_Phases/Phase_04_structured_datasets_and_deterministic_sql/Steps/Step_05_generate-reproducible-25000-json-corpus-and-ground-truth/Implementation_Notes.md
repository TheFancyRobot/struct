# Implementation Notes

- Capture durable findings learned during execution. Prefer short bullets with file paths, commands, and observed behavior.
- `packages/evaluation/src/corpus.ts` implements a Bun-only deterministic
  generator, fixed v1 seed/version, four JSON schema families, an independent
  non-SQL oracle, exact result/snapshot hashes, row identities, v1
  source-version citations, controlled security/drift/recovery cases,
  fail-closed cleanup, and full artifact verification.
- `packages/evaluation/src/corpus-generate.ts` and
  `corpus-compare-hashes.ts` expose generation and verify-before-compare
  commands. The root/package scripts preserve the Phase 02 smoke gate and add
  the 250-record generator smoke.
- `packages/evaluation/results/phase-04-corpus-v1.json` is the compact
  checked-in evidence. Generated records stay outside git.
- Full profile shape: 12,000 call logs + 6,000 telemetry + 4,000 transactions
  + 3,000 inventory items = exactly 25,000 JSON record files. Four generated
  metadata files are excluded from that scale count.
- Full self-review traced scripts, exports, Phase 02 smoke consumers,
  manifest/ground-truth/question schemas, cleanup and verifier paths, docs,
  exact percentage units, source-version lineage, and all generated evidence
  hashes before final validation.

## Related Notes

- Step: [[02_Phases/Phase_04_structured_datasets_and_deterministic_sql/Steps/Step_05_generate-reproducible-25000-json-corpus-and-ground-truth|STEP-04-05 Generate Reproducible 25000 JSON Corpus and Ground Truth]]
- Phase: [[02_Phases/Phase_04_structured_datasets_and_deterministic_sql/Phase|Phase 04 structured datasets and deterministic sql]]
