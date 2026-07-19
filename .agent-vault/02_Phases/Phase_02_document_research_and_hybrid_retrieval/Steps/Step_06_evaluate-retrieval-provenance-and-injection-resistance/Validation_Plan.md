# Validation Plan

## Acceptance Checks

- Confirm this deliverable is present, testable where applicable, and bounded to the step: An evidence-backed validation pass for Retrieval Provenance and Injection Resistance, with explicit pass/fail criteria and durable output artifacts.
- Confirm this deliverable is present, testable where applicable, and bounded to the step: Only the minimal API surface in `apps/api/test/document-research.integration.test.ts` needed to exercise this step end to end.
- Confirm this deliverable is present, testable where applicable, and bounded to the step: Deterministic evaluation or benchmark artifacts in `packages/evaluation/src/document-retrieval.ts`, `packages/evaluation/src/prompt-injection.ts` so this step can be judged without hand-waving.
- The output includes a clear pass/fail signal, recorded defects or blockers, and the next action for anything intentionally left unresolved.

## Planned Verification

- Refined gate: executable corpus smoke/evaluation commands with fixed thresholds and regression fixtures for keyword/vector/hybrid recall, locator fidelity, cross-tenant isolation, stale-version provenance, unsupported evidence, contradiction handling, and source-text prompt injection; finish with every maintained repository and Vault gate clean.
- Planned command once these packages exist: `bun test packages/evaluation` plus the nearest package-level `bun run typecheck`.
- Planned app/integration coverage once the app surfaces exist: `bun test apps/api` for the API/worker/web path touched here.
- Run the evaluation/benchmark fixture for this slice and store the corpus, seed, or hardware assumptions alongside the result.

## Edge Cases

- Partial progress, retries, or restarts should leave this step in a typed, inspectable state rather than a silent half-success.
- Unsupported formats, stale chunk references, and citation-open failures should surface explicitly instead of degrading to uncited answers.

## Regression Expectations

- This step should remain a clean successor to [[02_Phases/Phase_02_document_research_and_hybrid_retrieval/Steps/Step_05_add-document-research-ux-and-citation-navigation|STEP-02-05 Add Document Research UX and Citation Navigation]] rather than reworking already-planned scope upstream.
- Do not regress the Phase 1 walking slice while expanding format support and retrieval depth.
- Do not lose immutable source-version identity when normalizing documents, chunks, or saved findings.
- Keep citation opening and evidence sufficiency compatible with future mixed-source and report steps.

## Security / Observability / Evaluation Focus

- Ensure document parsers clearly surface unsupported or unsafe inputs rather than silently guessing.
- Keep retrieval traces inspectable enough to explain why a chunk or document was selected.
- Add adversarial retrieval and prompt-injection cases early, before the UX hides the provenance chain.
- Evaluation should verify provenance opening paths, contradiction reporting, and prompt-injection resistance for the evidence types touched here.

## Related Notes

- Step: [[02_Phases/Phase_02_document_research_and_hybrid_retrieval/Steps/Step_06_evaluate-retrieval-provenance-and-injection-resistance|STEP-02-06 Evaluate Retrieval Provenance and Injection Resistance]]
- Phase: [[02_Phases/Phase_02_document_research_and_hybrid_retrieval/Phase|Phase 02 document research and hybrid retrieval]]
