# Validation Plan

## Acceptance Checks

- Confirm this deliverable is present, testable where applicable, and bounded to the step: The narrowest typed slice for Document Research UX and Citation Navigation that is callable by the next step without broadening scope.
- Confirm this deliverable is present, testable where applicable, and bounded to the step: Only the minimal API surface in `apps/api/src/routes/documents.ts`, `apps/api/src/routes/citations.ts` needed to exercise this step end to end.
- Confirm this deliverable is present, testable where applicable, and bounded to the step: `apps/web/src/app/projects/[projectId]/page.tsx`, `apps/web/src/components/DocumentSearchPane.tsx`, `apps/web/src/components/CitationInspector.tsx` to expose only the UI states required to inspect this step’s output and failures.
- The step leaves the next dependent step with a stable typed boundary, not a placeholder or undocumented assumption.

## Planned Verification

- Run the nearest repo-wide or package-targeted `bun run typecheck` command once the touched packages and apps exist.
- Planned app/integration coverage once the app surfaces exist: `bun test apps/api apps/web` for the API/worker/web path touched here.
- Add a browser/e2e or component-level check that exercises the visible UI state introduced by this step and one failure presentation path.

## Edge Cases

- Partial progress, retries, or restarts should leave this step in a typed, inspectable state rather than a silent half-success.
- Unsupported formats, stale chunk references, and citation-open failures should surface explicitly instead of degrading to uncited answers.

## Regression Expectations

- This step should remain a clean successor to [[02_Phases/Phase_02_document_research_and_hybrid_retrieval/Steps/Step_04_build-document-research-and-evidence-sufficiency-workflow|STEP-02-04 Build Document Research and Evidence Sufficiency Workflow]] rather than reworking already-planned scope upstream.
- Do not regress the Phase 1 walking slice while expanding format support and retrieval depth.
- Do not lose immutable source-version identity when normalizing documents, chunks, or saved findings.
- Keep citation opening and evidence sufficiency compatible with future mixed-source and report steps.

## Security / Observability / Evaluation Focus

- Ensure document parsers clearly surface unsupported or unsafe inputs rather than silently guessing.
- Keep retrieval traces inspectable enough to explain why a chunk or document was selected.
- Add adversarial retrieval and prompt-injection cases early, before the UX hides the provenance chain.
- Evaluation should verify provenance opening paths, contradiction reporting, and prompt-injection resistance for the evidence types touched here.

## Related Notes

- Step: [[02_Phases/Phase_02_document_research_and_hybrid_retrieval/Steps/Step_05_add-document-research-ux-and-citation-navigation|STEP-02-05 Add Document Research UX and Citation Navigation]]
- Phase: [[02_Phases/Phase_02_document_research_and_hybrid_retrieval/Phase|Phase 02 document research and hybrid retrieval]]
