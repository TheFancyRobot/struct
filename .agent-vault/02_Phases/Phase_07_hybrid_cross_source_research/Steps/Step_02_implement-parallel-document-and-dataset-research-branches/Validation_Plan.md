# Validation Plan

## Acceptance Checks

- Confirm this deliverable is present, testable where applicable, and bounded to the step: The narrowest typed slice for Parallel Document and Dataset Research Branches that is callable by the next step without broadening scope.
- Confirm this deliverable is present, testable where applicable, and bounded to the step: update typed domain modules for `Branch Execution` in `packages/domain/src/branch-execution.ts`.
- Confirm this deliverable is present, testable where applicable, and bounded to the step: The orchestration or synthesis rules in `packages/research-engine/src/run-hybrid-branches.ts` without moving deterministic work out of services/tools.
- The step leaves the next dependent step with a stable typed boundary, not a placeholder or undocumented assumption.

## Planned Verification

- Planned command once these packages exist: `bun test packages/domain packages/fred-workflows packages/research-engine` plus the nearest package-level `bun run typecheck`.
- Planned app/integration coverage once the app surfaces exist: `bun test apps/worker` for the API/worker/web path touched here.

## Edge Cases

- Partial progress, retries, or restarts should leave this step in a typed, inspectable state rather than a silent half-success.
- Unsupported formats, stale chunk references, and citation-open failures should surface explicitly instead of degrading to uncited answers.
- Read-only violations, schema mismatch, oversized result sets, and engine/resource limits should fail before producing misleading results.

## Regression Expectations

- This step should remain a clean successor to [[02_Phases/Phase_07_hybrid_cross_source_research/Steps/Step_01_define-hybrid-question-decomposition-and-source-routing|STEP-07-01 Define Hybrid Question Decomposition and Source Routing]] rather than reworking already-planned scope upstream.
- Do not weaken dataset guardrails or document provenance while combining them in one workflow.
- Keep branch execution bounded and replayable; hybrid behavior should not turn into an untraceable super-agent.
- Maintain compatibility with later durable findings and report composition steps.

## Security / Observability / Evaluation Focus

- Ensure mixed-source prompts cannot grant wider tool access than the individual branch tools already allow.
- Keep contradiction handling and reconciliation observable enough to debug incorrect synthesis.
- Validate that final answers still cite exact SQL, rows, files, and document spans where appropriate.
- Keep exact-computation outputs tied to query text, result snapshots, and stable dataset citations so later synthesis cannot blur them.

## Related Notes

- Step: [[02_Phases/Phase_07_hybrid_cross_source_research/Steps/Step_02_implement-parallel-document-and-dataset-research-branches|STEP-07-02 Implement Parallel Document and Dataset Research Branches]]
- Phase: [[02_Phases/Phase_07_hybrid_cross_source_research/Phase|Phase 07 hybrid cross source research]]
