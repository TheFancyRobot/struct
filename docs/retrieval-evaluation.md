# Retrieval Evaluation

STEP-02-06 adds a deterministic smoke gate for the Phase 02 document-research
slice. It evaluates the existing retrieval, context, Fred prompt-boundary, and
typed evidence-gate contracts; it does not introduce a second executor or call
a model.

Run it with Bun:

```sh
bun run --filter @struct/evaluation document:eval
bun test packages/evaluation apps/api/test/document-research.integration.test.ts
```

## Fixed Phase 02 gates

| Gate | Threshold |
| --- | ---: |
| Minimum keyword recall | 0.90 |
| Minimum vector recall | 0.90 |
| Minimum hybrid recall | 1.00 |
| Exact locator fidelity | 1.00 |
| Foreign source-version candidates | 0 |
| Stale chunking-version candidates | 0 |
| Prompt-injection policy escalations | 0 |
| Model calls | 0 |

Lexical and semantic recall use their own structured relevant sets and must each
meet the canonical provisional 0.90 recall-at-10 threshold. The keyword and
vector fixtures intentionally recover complementary evidence; deterministic
reciprocal-rank fusion must recover both. Every returned relevant
chunk must retain its immutable source version, chunking version, ordinal, and
exact page/section/paragraph/character/byte locator. A foreign source version
is a source-scope leak in this pure evaluator. It does not execute database
filters or claim direct tenant-filter coverage. PostgreSQL integration coverage
in `packages/retrieval/test/hybrid-retrieval.integration.test.ts` separately
proves workspace, project, source-version, and chunking-version isolation
against the database.

The adversarial fixture keeps the hostile text byte-for-byte as
`untrusted-evidence`, verifies both Fred agents retain the evidence/instruction
boundary, and exercises typed rejection for invented citations, insufficient
evidence, and unresolved contradictions. These checks are deterministic, so a
model-as-judge would add variability without adding evidence.

## Durable artifacts and assumptions

- Fixture: `packages/evaluation/src/phase-02-fixture.ts`
- Expected result: `packages/evaluation/results/phase-02-document-evaluation.json`
- Seed: `20260719`
- Runtime: Bun
- Hardware: hardware-independent; the gate has no timing or performance claim

This small synthetic gate does not claim readiness for the planned 25,000-file
release corpus. Phase 04 owns that generator and Phase 09 owns its final release
audit.
