# Implementation Notes

- Capture durable findings learned during execution. Prefer short bullets with file paths, commands, and observed behavior.

- 2026-07-20 - Added a typed, edge-addressable provenance graph for report claims, origins, and exact document, dataset-query, and recursive evidence identities. Graph invariants require one origin, exact evidence-mode coverage, one fact per edge, consistent report/claim revisions, and no orphan edges.
- Citation reopening is scoped and fail-closed. Resolver defects propagate, while expected target failures become typed validation facts. Publication requires a complete valid graph for the exact report revision.
- Recursive evidence artifacts now persist a deterministic bounded excerpt produced by `renderRecursiveEvidenceExcerpt`; reopening verifies artifact digest, length, media type, source-version visibility, locator/source identity, and the canonical excerpt. There is no compatibility fallback.
- The direct greenfield `0016_provenance_graph` schema stores immutable graph roots, typed edges, and validation facts. Composite foreign keys bind edges to the exact report claim, claim revision, and optional evidence row.
- Validation is bounded before resolver I/O: more than 4,096 graph edges fails with `CitationValidationLimitExceeded`.

## Related Notes

- Step: [[02_Phases/Phase_08_citation_backed_reports_and_durable_findings/Steps/Step_02_implement-citation-validation-and-provenance-graph|STEP-08-02 Implement Citation Validation and Provenance Graph]]
- Phase: [[02_Phases/Phase_08_citation_backed_reports_and_durable_findings/Phase|Phase 08 citation backed reports and durable findings]]
