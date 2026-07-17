# Execution Brief

## Exact Outcome

- Produce the concrete contracts, artifacts, and bounded implementation/design surfaces for Evaluation Corpus Specification and Quality Gates that this step is responsible for before any broader follow-on work begins.

## Prerequisites

- Re-read [[02_Phases/Phase_00_architecture_spikes_and_delivery_foundations/Phase|Phase 00 architecture spikes and delivery foundations]] and confirm the step still matches the current roadmap sequence.
- Confirm the handoff from [[02_Phases/Phase_00_architecture_spikes_and_delivery_foundations/Steps/Step_05_specify-security-threat-model-and-trust-boundaries|STEP-00-05 Specify Security Threat Model and Trust Boundaries]] before widening scope.
- Keep deterministic work in typed Effect services, repositories, and tools; reserve Fred for agentic orchestration only.
- Treat the listed files as planned starting points; create only the smallest set needed to land the slice.

## Planned Starting Files

- These paths may not exist yet; use them as the first bounded implementation or design surface.
- `docs/evaluation-corpus.md`
- `packages/evaluation/src/corpus/generate.ts`
- `packages/evaluation/src/questions/index.ts`
- `packages/evaluation/src/gates.ts`
- `.github/workflows/ci.yml`

## Required Reading

- [[02_Phases/Phase_00_architecture_spikes_and_delivery_foundations/Phase|Phase 00 architecture spikes and delivery foundations]]
- [[01_Architecture/System_Overview|System Overview]]
- [[01_Architecture/Code_Map|Code Map]]
- [[01_Architecture/Agent_Workflow|Agent Workflow]]
- [[02_Phases/Phase_00_architecture_spikes_and_delivery_foundations/Steps/Step_05_specify-security-threat-model-and-trust-boundaries|STEP-00-05 Specify Security Threat Model and Trust Boundaries]]
- `docs/product-brief.md` sections 5-7, 13, 18-19, 21, 24, 26, and 29-31.

## Concrete Deliverables

- Define the concrete contract for Evaluation Corpus Specification and Quality Gates in the first planned domain, persistence, or documentation files so downstream implementation does not need to rediscover the boundary.
- Add deterministic evaluation or benchmark artifacts in `packages/evaluation/src/corpus/generate.ts`, `packages/evaluation/src/questions/index.ts`, `packages/evaluation/src/gates.ts` so this step can be judged without hand-waving.
- Capture the durable contract or operator guidance in `docs/evaluation-corpus.md` rather than burying it in session-only notes.

## Smallest Bounded Checklist

- First, define the concrete contract for Evaluation Corpus Specification and Quality Gates in the first planned domain, persistence, or documentation files so downstream implementation does not need to rediscover the boundary.
- Then, add deterministic evaluation or benchmark artifacts in `packages/evaluation/src/corpus/generate.ts`, `packages/evaluation/src/questions/index.ts`, `packages/evaluation/src/gates.ts` so this step can be judged without hand-waving.
- Next, capture the durable contract or operator guidance in `docs/evaluation-corpus.md` rather than burying it in session-only notes.
- Finish by capturing the deterministic fixture, benchmark, or gate evidence that will let the validation plan judge the slice without guesswork.

## Constraints and Non-Goals

- Keep Phase 0 work decision-oriented: prove boundaries, not broad production scaffolding.
- Keep deterministic work in typed Effect services and adapters; use Fred only where agentic judgment is actually required.
- Record tradeoffs and rejected options explicitly so later implementation steps do not need to rediscover them.

## Related Notes

- Step: [[02_Phases/Phase_00_architecture_spikes_and_delivery_foundations/Steps/Step_06_establish-evaluation-corpus-specification-and-quality-gates|STEP-00-06 Establish Evaluation Corpus Specification and Quality Gates]]
- Phase: [[02_Phases/Phase_00_architecture_spikes_and_delivery_foundations/Phase|Phase 00 architecture spikes and delivery foundations]]

## Refinement Addendum

### Specification-Only Starting Point

- Create `docs/evaluation-corpus.md` and link it to `docs/evaluation-strategy.md`. Do not create `packages/evaluation` or `.github/workflows/ci.yml` in Phase 0.
- Read `docs/evaluation-strategy.md` and `docs/security-model.md` completely; `docs/architecture.md` sections 7-10 and 14; DEC-0011 and DEC-0009; `docs/product-brief.md` sections 13, 21, 24-27, and 29-31; and STEP-00-05's finalized handoff.

### Required Specification Objects

Define field tables and examples for:

1. corpus manifest: corpus/generator versions, seed, source counts, schema families, hashes, and stable identifiers;
2. generator configuration and seed policy: one canonical seed per version and no model/provider calls during generation;
3. `v1`/`v2` changes: additions, deletions, identity changes, schema drift, injection changes, and mitigation/code changes;
4. question manifests split into exact, semantic, mixed, provenance, adversarial, recovery, and performance classes;
5. exact ground truth for counts, percentages, filters, groups, joins, dates, distinct/null cases, and deltas;
6. semantic ground truth with themes, evidence, minority findings, contradictions, and limitations;
7. provenance truth for file/page/section, JSON Pointer, stable record, SQL/result snapshot, source version, log line, and code range;
8. adversarial truth mapping every STEP-00-05 abuse category to a safe expected outcome;
9. PR/nightly/pre-release gate matrix; and
10. benchmark metadata for CPU, memory, storage, OS, Bun/Node/DuckDB, concurrency, and corpus shape.

### Corpus and Handoff Constraints

- Corpus data is fully synthetic: no real PII, credentials, or secrets. Hostile strings are inert fixtures.
- Specify approximately 25,000 JSON files plus linked logs, Markdown, PDFs, code, a data dictionary, schema families, duplicates, rare findings, contradictions, and deterministic trends.
- Published outputs must reproduce from the canonical seed and be content-addressed or covered by manifest hashes.
- Hand Phase 4 a planned generator CLI, output layout, smoke/full profiles, generate-twice/hash-compare check, loaders, gate evaluator, and result artifact layout without claiming those files already exist.
