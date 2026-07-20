# Execution Brief

## Exact Outcome

- Produce the concrete contracts, artifacts, and bounded implementation/design surfaces for Deterministic Batch Extraction and Evidence Artifacts that this step is responsible for before any broader follow-on work begins.

## Prerequisites

- Re-read [[02_Phases/Phase_06_recursive_corpus_analysis/Phase|Phase 06 recursive corpus analysis]] and confirm the step still matches the current roadmap sequence.
- Confirm the handoff from [[02_Phases/Phase_06_recursive_corpus_analysis/Steps/Step_02_implement-bounded-corpus-partitioning-and-scheduling|STEP-06-02 Implement Bounded Corpus Partitioning and Scheduling]] before widening scope.
- Keep deterministic work in typed Effect services, repositories, and tools; reserve Fred for agentic orchestration only.
- Treat the listed files as planned starting points; create only the smallest set needed to land the slice.

## Planned Starting Files

- These paths may not exist yet; use them as the first bounded implementation or design surface.
- `packages/retrieval/src/batch-select.ts`
- `packages/research-engine/src/evidence-artifacts.ts`
- `packages/source-storage/src/analysis-artifacts.ts`
- `apps/worker/src/jobs/build-partition-artifacts.ts`

## Required Reading

- [[02_Phases/Phase_06_recursive_corpus_analysis/Phase|Phase 06 recursive corpus analysis]]
- [[01_Architecture/Agent_Workflow|Agent Workflow]]
- [[01_Architecture/Domain_Model|Domain Model]]
- [[02_Phases/Phase_06_recursive_corpus_analysis/Steps/Step_02_implement-bounded-corpus-partitioning-and-scheduling|STEP-06-02 Implement Bounded Corpus Partitioning and Scheduling]]
- `docs/product-brief.md` sections 14-15, 18-19, 22-25, 26-27, and 29-31.

## Concrete Deliverables

- Implement the narrowest typed slice for Deterministic Batch Extraction and Evidence Artifacts that is callable by the next step without broadening scope.
- Land the retrieval boundary in `packages/retrieval/src/batch-select.ts` so ranking, filtering, and provenance remain inspectable and typed.
- Capture the orchestration or synthesis rules in `packages/research-engine/src/evidence-artifacts.ts` without moving deterministic work out of services/tools.
- Constrain worker-side execution in `apps/worker/src/jobs/build-partition-artifacts.ts` to one resumable, observable path for this slice.

## Smallest Bounded Checklist

- First, implement the narrowest typed slice for Deterministic Batch Extraction and Evidence Artifacts that is callable by the next step without broadening scope.
- Then, land the retrieval boundary in `packages/retrieval/src/batch-select.ts` so ranking, filtering, and provenance remain inspectable and typed.
- Next, capture the orchestration or synthesis rules in `packages/research-engine/src/evidence-artifacts.ts` without moving deterministic work out of services/tools.
- Finish by leaving one observable typed path—test, route, worker flow, or UI state—that proves the slice is ready for the next dependent step.

## Constraints and Non-Goals

- Use recursive decomposition only for semantic analysis; exact computation remains deterministic and out of scope for summarization.
- Every partition and merge stage must preserve evidence IDs, coverage, counterevidence, and limitations.
- Avoid summary-of-summaries degradation by reopening original evidence before asserting final claims.

## Related Notes

- Step: [[02_Phases/Phase_06_recursive_corpus_analysis/Steps/Step_03_implement-deterministic-batch-extraction-and-evidence-artifacts|STEP-06-03 Implement Deterministic Batch Extraction and Evidence Artifacts]]
- Phase: [[02_Phases/Phase_06_recursive_corpus_analysis/Phase|Phase 06 recursive corpus analysis]]

## Refined Execution Contract

- Target-rooted reading: this brief and `Validation_Plan.md`; STEP-06-01 Outcome; STEP-06-02 Outcome; Phase 06; source-storage artifact contracts; `packages/evaluation/src/corpus.ts`; data-engine query/evidence contracts; DEC-0005, DEC-0006, DEC-0009, and DEC-0011.
- Implement deterministic batch filtering, field projection, grouping, exact aggregation, and extraction into bounded typed evidence artifacts keyed by the STEP-06-01 identities. Preserve source version, normalized path, record/field locator, schema family, transformation/query identity, counts, exclusions, truncation, and hashes.
- Store artifacts content-addressably and commit metadata idempotently so completed batches are reused across retry/resume and partial failures do not expose uncommitted artifacts.
- Keep Bun as the host runtime. Any DuckDB work must traverse the existing authenticated isolated Node 24 LTS `data-engine`/gateway Compose boundary with allowlisted read-only operations and sandboxed roots.
- Add fixtures for malformed/hostile JSON, schema variation, empty matches, duplicate content, ordering variation, truncation, storage failure, sidecar restart, cancellation, and artifact reuse.
- Downstream check: confirm scheduler identities round-trip, Fred-facing artifacts are bounded and untrusted-labeled, citation/provenance consumers retain exact locators, and existing Phase 04 query evidence remains valid.
- Explicit non-goals: no qualitative model judgment, recursive synthesis, UI, new host runtime, raw unrestricted SQL/filesystem access, compatibility layer, or full-corpus release gate.
