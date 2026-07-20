# Implementation Notes

- Capture durable findings learned during execution. Prefer short bullets with file paths, commands, and observed behavior.
- Added `packages/domain/src/recursive-analysis.ts` and `research-finding.ts` as the exported Effect Schema boundary for recursive requests, decomposition lineage, partitions, batches, immutable evidence, structured findings, coverage, contradictions, sufficiency, aggregations, and deterministic terminal reasons.
- Added SHA-256 branded identities and canonical UTF-8 ordering/hash inputs in `packages/research-engine/src/aggregation-schema.ts`; identities include contract version, immutable source versions, plan/objective signature, and relevant policy while excluding timestamps, attempts, worker identity, checkpoint attempt state, and display prose.
- Initial requests carry `checkpoint: null`; resumed requests may carry a Phase 05 checkpoint only when run/plan/version identity matches.
- Typed validation rejects malformed limits, forged hashes, duplicate identities, cycles, orphan parents, incomplete root lineage, invalid child lineage, excess fan-out/depth, impossible coverage, omitted/unknown evidence or contradictions, and false sufficiency/completion.
- No scheduler, persistence migration, extraction, Fred workflow, API, UI, or compatibility layer was added.

## Related Notes

- Step: [[02_Phases/Phase_06_recursive_corpus_analysis/Steps/Step_01_define-recursive-decomposition-and-aggregation-contracts|STEP-06-01 Define Recursive Decomposition and Aggregation Contracts]]
- Phase: [[02_Phases/Phase_06_recursive_corpus_analysis/Phase|Phase 06 recursive corpus analysis]]
