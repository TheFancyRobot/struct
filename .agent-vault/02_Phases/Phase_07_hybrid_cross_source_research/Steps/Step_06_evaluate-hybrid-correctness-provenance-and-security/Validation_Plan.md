# Validation Plan

## Acceptance Checks

- Confirm this deliverable is present, testable where applicable, and bounded to the step: Evaluate mixed document+dataset research for quantitative correctness, citation provenance, contradiction handling, and prompt-injection resistance.
- Confirm this deliverable is present, testable where applicable, and bounded to the step: Prove that hybrid answers keep exact SQL-derived facts separate from qualitative synthesis and document evidence.
- Confirm this deliverable is present, testable where applicable, and bounded to the step: The failure taxonomy for hybrid runs: wrong routing, stale citations, unsupported reconciliation, and security boundary violations.
- The output includes a clear pass/fail signal, recorded defects or blockers, and the next action for anything intentionally left unresolved.

## Planned Verification

- Plan mixed-source test cases drawn from the demonstration scenario, including one question that requires exact computation plus document/code evidence.
- Plan adversarial tests where injected document or JSON content tries to alter tool permissions or suppress citation requirements.
- Planned command once these packages exist: `bun test packages/evaluation` plus the nearest package-level `bun run typecheck`.
- Planned app/integration coverage once the app surfaces exist: `bun test apps/api` for the API/worker/web path touched here.

## Edge Cases

- Hybrid answers that produce correct prose but wrong numbers should be classified as failures, not partial wins.
- Cross-source contradictions must remain inspectable after synthesis instead of being merged into one confidence score.
- A source refresh between branch execution and synthesis must trigger version checks before final citation validation passes.

## Regression Expectations

- This step should remain a clean successor to [[02_Phases/Phase_07_hybrid_cross_source_research/Steps/Step_05_deliver-mixed-source-demo-and-explorable-report|STEP-07-05 Deliver Mixed-Source Demo and Explorable Report]] rather than reworking already-planned scope upstream.
- Do not weaken dataset guardrails or document provenance while combining them in one workflow.
- Keep branch execution bounded and replayable; hybrid behavior should not turn into an untraceable super-agent.
- Maintain compatibility with later durable findings and report composition steps.

## Security / Observability / Evaluation Focus

- Ensure mixed-source prompts cannot grant wider tool access than the individual branch tools already allow.
- Keep contradiction handling and reconciliation observable enough to debug incorrect synthesis.
- Validate that final answers still cite exact SQL, rows, files, and document spans where appropriate.
- Evaluation should verify provenance opening paths, contradiction reporting, and prompt-injection resistance for the evidence types touched here.

## Related Notes

- Step: [[02_Phases/Phase_07_hybrid_cross_source_research/Steps/Step_06_evaluate-hybrid-correctness-provenance-and-security|STEP-07-06 Evaluate Hybrid Correctness Provenance and Security]]
- Phase: [[02_Phases/Phase_07_hybrid_cross_source_research/Phase|Phase 07 hybrid cross source research]]
