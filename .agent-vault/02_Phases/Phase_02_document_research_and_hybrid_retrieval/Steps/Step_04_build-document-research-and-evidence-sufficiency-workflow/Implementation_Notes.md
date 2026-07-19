# Implementation Notes

- Capture durable findings learned during execution. Prefer short bullets with file paths, commands, and observed behavior.
- `packages/retrieval/src/build-context.ts` converts one bounded hybrid result into typed untrusted evidence while preserving chunk/document/source-version identity, chunking version, ordinal, full document locator, exact citation locator, and visible channel/fusion scores.
- `packages/research-engine/src/evidence-sufficiency.ts` defines fixed budgets (7 nodes, 1 tool call, 3 model calls, 0 retries), validates assessment citations, rejects insufficiency, requires concrete surfaced contradictions, and validates final citations.
- `packages/fred-workflows/src/graphs/document-research.ts` keeps planning, evidence judgment, and synthesis in core Fred while deterministic retrieval and gates remain product-owned Effect boundaries.
- `packages/fred-workflows/test/document-research.test.ts` executes a real providerless function workflow through `createFred().workflows.define/run`; no Fred-core bypass was introduced.
- `packages/fred-workflows/src/adapters/fred-runtime.ts` enforces one shared elapsed deadline and preserves known typed node failures through Fred wrapper causes for durable worker events.
- `apps/worker/src/jobs/run-research.test.ts` proves exact durable failure tags for insufficiency, contradiction, and citation rejection.

## Related Notes

- Step: [[02_Phases/Phase_02_document_research_and_hybrid_retrieval/Steps/Step_04_build-document-research-and-evidence-sufficiency-workflow|STEP-02-04 Build Document Research and Evidence Sufficiency Workflow]]
- Phase: [[02_Phases/Phase_02_document_research_and_hybrid_retrieval/Phase|Phase 02 document research and hybrid retrieval]]
