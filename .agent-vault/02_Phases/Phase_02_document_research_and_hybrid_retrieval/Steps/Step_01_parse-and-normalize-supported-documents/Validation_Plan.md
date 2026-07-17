# Validation Plan

## Acceptance Checks

- Confirm this deliverable is present, testable where applicable, and bounded to the step: The narrowest typed slice for and Normalize Supported Documents that is callable by the next step without broadening scope.
- Confirm this deliverable is present, testable where applicable, and bounded to the step: `packages/document-processing/src/parsers/pdf.ts`, `packages/document-processing/src/parsers/markdown.ts`, `packages/document-processing/src/parsers/text.ts` to preserve parse/normalize/chunk provenance instead of collapsing documents into opaque text blobs.
- Confirm this deliverable is present, testable where applicable, and bounded to the step: Worker-side execution in `apps/worker/src/jobs/parse-document.ts` to one resumable, observable path for this slice.
- The step leaves the next dependent step with a stable typed boundary, not a placeholder or undocumented assumption.

## Planned Verification

- Planned command once these packages exist: `bun test packages/document-processing` plus the nearest package-level `bun run typecheck`.
- Planned app/integration coverage once the app surfaces exist: `bun test apps/worker` for the API/worker/web path touched here.

## Edge Cases

- Partial progress, retries, or restarts should leave this step in a typed, inspectable state rather than a silent half-success.
- Unsupported formats, stale chunk references, and citation-open failures should surface explicitly instead of degrading to uncited answers.

## Regression Expectations

- This step should remain a clean successor to [[02_Phases/Phase_01_walking_skeleton/Steps/Step_06_automate-vertical-slice-tests-documentation-and-observability|STEP-01-06 Automate Vertical Slice Tests Documentation and Observability]] rather than reworking already-planned scope upstream.
- Do not regress the Phase 1 walking slice while expanding format support and retrieval depth.
- Do not lose immutable source-version identity when normalizing documents, chunks, or saved findings.
- Keep citation opening and evidence sufficiency compatible with future mixed-source and report steps.

## Security / Observability / Evaluation Focus

- Ensure document parsers clearly surface unsupported or unsafe inputs rather than silently guessing.
- Keep retrieval traces inspectable enough to explain why a chunk or document was selected.
- Add adversarial retrieval and prompt-injection cases early, before the UX hides the provenance chain.
- Evaluation should verify provenance opening paths, contradiction reporting, and prompt-injection resistance for the evidence types touched here.

## Related Notes

- Step: [[02_Phases/Phase_02_document_research_and_hybrid_retrieval/Steps/Step_01_parse-and-normalize-supported-documents|STEP-02-01 Parse and Normalize Supported Documents]]
- Phase: [[02_Phases/Phase_02_document_research_and_hybrid_retrieval/Phase|Phase 02 document research and hybrid retrieval]]
