# Validation Plan

## Acceptance Checks

- Confirm this deliverable is present, testable where applicable, and bounded to the step: The concrete contract for Hybrid Question Decomposition and Source Routing in the first planned domain, persistence, or documentation files so downstream implementation does not need to rediscover the boundary.
- Confirm this deliverable is present, testable where applicable, and bounded to the step: update typed domain modules for `HybridPlan` in `packages/domain/src/hybrid-plan.ts`.
- Confirm this deliverable is present, testable where applicable, and bounded to the step: The orchestration or synthesis rules in `packages/research-engine/src/route-sources.ts`, `packages/research-engine/src/question-decomposition.ts` without moving deterministic work out of services/tools.
- The step leaves the next dependent step with a stable typed boundary, not a placeholder or undocumented assumption.

## Planned Verification

- Planned command once these packages exist: `bun test packages/domain packages/research-engine` plus the nearest package-level `bun run typecheck`.
- Review the paired doc/ADR/runbook output to confirm it matches the code-facing contract and names operator/developer prerequisites explicitly.

## Edge Cases

- Partial progress, retries, or restarts should leave this step in a typed, inspectable state rather than a silent half-success.
- Cancellation, duplicate actions, replay after restart, and stale source-version assumptions should produce deterministic terminal states.

## Regression Expectations

- This step should remain a clean successor to [[02_Phases/Phase_06_recursive_corpus_analysis/Steps/Step_06_evaluate-25000-file-recursive-analysis-and-recovery|STEP-06-06 Evaluate 25000-File Recursive Analysis and Recovery]] rather than reworking already-planned scope upstream.
- Do not weaken dataset guardrails or document provenance while combining them in one workflow.
- Keep branch execution bounded and replayable; hybrid behavior should not turn into an untraceable super-agent.
- Maintain compatibility with later durable findings and report composition steps.

## Security / Observability / Evaluation Focus

- Ensure mixed-source prompts cannot grant wider tool access than the individual branch tools already allow.
- Keep contradiction handling and reconciliation observable enough to debug incorrect synthesis.
- Validate that final answers still cite exact SQL, rows, files, and document spans where appropriate.
- Evaluation should verify provenance opening paths, contradiction reporting, and prompt-injection resistance for the evidence types touched here.

## Related Notes

- Step: [[02_Phases/Phase_07_hybrid_cross_source_research/Steps/Step_01_define-hybrid-question-decomposition-and-source-routing|STEP-07-01 Define Hybrid Question Decomposition and Source Routing]]
- Phase: [[02_Phases/Phase_07_hybrid_cross_source_research/Phase|Phase 07 hybrid cross source research]]
