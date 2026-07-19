# Implementation Notes

- Capture durable findings learned during execution. Prefer short bullets with file paths, commands, and observed behavior.
- `packages/evaluation/src/document-retrieval.ts` evaluates channel-specific lexical/semantic recall, complementary hybrid recall, exact locator fidelity, source-version scope, and stale chunking with finite fail-closed metrics.
- `packages/evaluation/src/prompt-injection.ts` directly exercises production context labels, Fred prompt constants, and typed evidence gates with zero model calls.
- `packages/evaluation/src/phase-02-fixture.ts` and `packages/evaluation/results/phase-02-document-evaluation.json` are the durable seed/result pair.
- Pure evaluation does not claim database tenant filtering; the real PostgreSQL hybrid integration suite is the tenant/workspace/project isolation evidence.

## Related Notes

- Step: [[02_Phases/Phase_02_document_research_and_hybrid_retrieval/Steps/Step_06_evaluate-retrieval-provenance-and-injection-resistance|STEP-02-06 Evaluate Retrieval Provenance and Injection Resistance]]
- Phase: [[02_Phases/Phase_02_document_research_and_hybrid_retrieval/Phase|Phase 02 document research and hybrid retrieval]]
