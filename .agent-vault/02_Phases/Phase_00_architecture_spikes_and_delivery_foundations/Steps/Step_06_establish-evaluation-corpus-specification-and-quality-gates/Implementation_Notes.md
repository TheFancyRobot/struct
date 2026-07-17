# Implementation Notes

## Durable Findings

- The step is **spec-only**. Execution Brief Refinement Addendum and Validation Plan forbid `packages/evaluation` and `.github/workflows/ci.yml` in Phase 0; the generator/test commands in the Validation Plan are explicitly "future commands… not Phase 0 commands against nonexistent packages." Phase 0 creates `docs/evaluation-corpus.md` only.
- STEP-00-05's `docs/security-model.md` §25 handoff is the authoritative adversarial input: it maps every ABUSE-01…15 category to expected safe behavior + required observable evidence. Consumed verbatim in `docs/evaluation-corpus.md` §10 with a per-category inert-fixture anchor and gate tier.
- DEF-05 (gate-tier numeric thresholds) was the deferred risk owned by STEP-00-06; finalized in `docs/evaluation-corpus.md` §11. `repository-contract.md` §2 already fixed the *check set + ownership*; STEP-00-06 finalizes the *thresholds* and keeps tiers aligned with `security-model.md` §22 calibration phases.
- Reproducibility is a hard contract: one canonical seed per version (`v1=5d4c02a1f3b8e617`, `v2=6e5d13b204c9f728`), `GeneratorConfig.forbidModelCalls`/`forbidNetwork`, no `Math.random`/`crypto.randomBytes`/time/PID/UUID, SHA-256 content-addressing, and a planned generate-twice/hash-compare gate.
- Stable record identity = `sha256(schemaFamilyId + ":" + sha256(canonicalBusinessKey))`, not row index — this is what makes v1→v2 refresh, stale-citation, and change-summary tests deterministic (§2.1, §5).
- Model-as-judge is never the sole authority for deterministic answers (§11.3): deterministic metrics N=1 exact; perf metrics N≥3 median+p95 with a 25% flakiness reporting rule; semantic/retrieval model judges are secondary cross-checks only.
- Scale discipline: `smoke` (~250 files) may never support a 25,000-file claim; only `full` (~24,260 files) is release authority (§14.2).
- `docs/evaluation-strategy.md` already contained the strategy (dimensions/layers/metrics/release criteria); the new doc operationalizes it into a single content-addressed asset with typed schemas, ground truth, and thresholds — it does not contradict the strategy.

## Commands / Behavior Observed

- `rg -n "25000|25,000|seed|manifest|ground truth|v1|v2|prompt-injection|citation|duplicate-side-effect|hardware" docs/evaluation-strategy.md docs/evaluation-corpus.md | wc -l` → 187.
- `rg -c "ABUSE-0X" docs/evaluation-corpus.md` for X=1..15 → all present (1..6 hits each).
- `ls package.json bun.lock packages tsconfig*.json .github/workflows` → all absent (docs-only repo). `bun --version` → 1.3.13; `rg --version` → 15.1.0.

## Related Notes

- Step: [[02_Phases/Phase_00_architecture_spikes_and_delivery_foundations/Steps/Step_06_establish-evaluation-corpus-specification-and-quality-gates|STEP-00-06 Establish Evaluation Corpus Specification and Quality Gates]]
- Phase: [[02_Phases/Phase_00_architecture_spikes_and_delivery_foundations/Phase|Phase 00 architecture spikes and delivery foundations]]
