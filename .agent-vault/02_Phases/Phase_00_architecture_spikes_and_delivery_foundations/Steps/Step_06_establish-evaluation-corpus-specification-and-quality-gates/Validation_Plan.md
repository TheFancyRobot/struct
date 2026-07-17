# Validation Plan

## Acceptance Checks

- Confirm this deliverable is present, testable where applicable, and bounded to the step: The concrete contract for Evaluation Corpus Specification and Quality Gates in the first planned domain, persistence, or documentation files so downstream implementation does not need to rediscover the boundary.
- Confirm this deliverable is present, testable where applicable, and bounded to the step: Deterministic evaluation or benchmark artifacts in `packages/evaluation/src/corpus/generate.ts`, `packages/evaluation/src/questions/index.ts`, `packages/evaluation/src/gates.ts` so this step can be judged without hand-waving.
- Confirm this deliverable is present, testable where applicable, and bounded to the step: The durable contract or operator guidance in `docs/evaluation-corpus.md` rather than burying it in session-only notes.
- The step leaves the next dependent step with a stable typed boundary, not a placeholder or undocumented assumption.

## Planned Verification

- Planned command once these packages exist: `bun test packages/evaluation` plus the nearest package-level `bun run typecheck`.
- Run the evaluation/benchmark fixture for this slice and store the corpus, seed, or hardware assumptions alongside the result.

## Edge Cases

- Partial progress, retries, or restarts should leave this step in a typed, inspectable state rather than a silent half-success.
- A green-looking summary with missing evidence, flaky metrics, or inaccessible states should fail the step until the gap is explicit.

## Regression Expectations

- This step should remain a clean successor to [[02_Phases/Phase_00_architecture_spikes_and_delivery_foundations/Steps/Step_05_specify-security-threat-model-and-trust-boundaries|STEP-00-05 Specify Security Threat Model and Trust Boundaries]] rather than reworking already-planned scope upstream.
- Do not narrow or contradict the product brief, architecture notes, or phase sequencing without an explicit follow-up decision note.
- Do not invent package APIs that imply implementation already exists; keep language and artifacts clearly planned or spike-scoped.
- Make sure later Phase 1 work can start from these outputs without re-litigating repository layout, security boundaries, or evaluation gates.

## Security / Observability / Evaluation Focus

- Model all imported content as untrusted evidence and keep prompt-injection defenses visible in the design outputs.
- Call out checkpoint, event, filesystem, and SQL trust boundaries wherever a spike touches them.
- Prefer observable, restart-safe designs over opaque runtime magic.

## Related Notes

- Step: [[02_Phases/Phase_00_architecture_spikes_and_delivery_foundations/Steps/Step_06_establish-evaluation-corpus-specification-and-quality-gates|STEP-00-06 Establish Evaluation Corpus Specification and Quality Gates]]
- Phase: [[02_Phases/Phase_00_architecture_spikes_and_delivery_foundations/Phase|Phase 00 architecture spikes and delivery foundations]]

## Refined Acceptance Contract

### Initial Gate Matrix

The specification must encode these initial non-negotiable release gates:

- deterministic exact-answer accuracy: 100%;
- citation-open success: 100%;
- stale-citation detection after refresh: 100%;
- unsupported computed-claim rate: 0%;
- successful prompt-injection policy escalation: 0%; and
- duplicate-side-effect rate after retry/resume: 0%.

Retrieval, rare-evidence, contradiction, minority-finding, latency, cost, and cancellation thresholds must be tracked from the first run. They may be baseline-calibrated later, but the spec must name the metric, dataset, owner, variance policy, and phase that freezes the gate.

### Specification Completeness Checks

- Every question class has deterministic or structured semantic ground truth, required provenance, failure expectations, and an owning gate tier.
- Every STEP-00-05 abuse category has at least one inert fixture and expected safe outcome.
- `v1` and `v2` changes exercise additions, deletions, schema drift, stable identity, refresh, stale citation, changed mitigations, and code-status changes.
- The manifest includes generator/corpus versions, canonical seed, counts, schema families, hashes, and benchmark environment fields.
- Smoke, full/nightly, and pre-release profiles are explicit; a toy smoke corpus may not support a 25k scale claim.
- Flaky or model-scored metrics have a documented repetition/variance rule; model-as-judge is never the only authority for deterministic answers.

### Current and Future Validation

Run now:

```bash
git diff --check
rg -n "25000|25,000|seed|manifest|ground truth|v1|v2|prompt-injection|citation|duplicate-side-effect|hardware" docs/evaluation-strategy.md docs/evaluation-corpus.md
```

The Phase 4 implementation contract must include an equivalent of:

```bash
bun run corpus:generate -- --profile smoke --seed <canonical> --out .tmp/corpus-a
bun run corpus:generate -- --profile smoke --seed <canonical> --out .tmp/corpus-b
bun run corpus:compare-hashes .tmp/corpus-a/manifest.json .tmp/corpus-b/manifest.json
bun test packages/evaluation
bunx tsc -p packages/evaluation/tsconfig.json --noEmit
```

These future commands are specification requirements, not Phase 0 commands against nonexistent packages.

### Security, Privacy, Performance, and Handoff

- Corpus content is synthetic and contains no real PII/secrets; injection strings remain inert data.
- Benchmark claims always store CPU, memory, storage, OS, runtime/engine versions, concurrency, corpus profile, and raw results.
- The handoff names generator CLI/schema locations, outputs, hashes, question loaders, gate evaluator, artifact retention, and known unsupported source types.

### Pass / Fail

- **PASS:** the corpus/ground-truth/gate contracts are complete, deterministic seed/hash behavior is specified, all security handoff cases map to fixtures, and downstream implementation can proceed without inventing schemas or thresholds.
- **FAIL:** ground truth or provenance is missing, a 25k claim relies on toy data, real sensitive data is required, deterministic gates depend only on a model judge, or recovery/security checks are omitted.