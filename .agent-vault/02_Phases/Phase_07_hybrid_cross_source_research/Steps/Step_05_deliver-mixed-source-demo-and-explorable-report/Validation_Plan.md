# Validation Plan

## Acceptance Checks

- Confirm this deliverable is present, testable where applicable, and bounded to the step: The narrowest typed slice for Mixed-Source Demo and Explorable Report that is callable by the next step without broadening scope.
- Confirm the existing SolidJS research page/stream or one adjacent focused component exposes every required output and failure state.
- Confirm a deterministic mixed-source browser fixture and Playwright suite judge the functional, accessible, responsive experience.
- The step leaves the next dependent step with a stable typed boundary, not a placeholder or undocumented assumption.

## Planned Verification

- Planned command once these packages exist: `bun test packages/evaluation` plus the nearest package-level `bun run typecheck`.
- Planned app/integration coverage once the app surfaces exist: `bun test apps/web` for the API/worker/web path touched here.
- Add a browser/e2e or component-level check that exercises the visible UI state introduced by this step and one failure presentation path.
- Run the evaluation/benchmark fixture for this slice and store the corpus, seed, or hardware assumptions alongside the result.

## Edge Cases

- Partial progress, retries, or restarts should leave this step in a typed, inspectable state rather than a silent half-success.
- Cancellation, duplicate actions, replay after restart, and stale source-version assumptions should produce deterministic terminal states.

## Regression Expectations

- This step should remain a clean successor to [[02_Phases/Phase_07_hybrid_cross_source_research/Steps/Step_04_build-hybrid-synthesis-with-quantitative-guardrails|STEP-07-04 Build Hybrid Synthesis with Quantitative Guardrails]] rather than reworking already-planned scope upstream.
- Do not weaken dataset guardrails or document provenance while combining them in one workflow.
- Keep branch execution bounded and replayable; hybrid behavior should not turn into an untraceable super-agent.
- Maintain compatibility with later durable findings and report composition steps.

## Security / Observability / Evaluation Focus

- Ensure mixed-source prompts cannot grant wider tool access than the individual branch tools already allow.
- Keep contradiction handling and reconciliation observable enough to debug incorrect synthesis.
- Validate that final answers still cite exact SQL, rows, files, and document spans where appropriate.
- Evaluation should verify provenance opening paths, contradiction reporting, and prompt-injection resistance for the evidence types touched here.

## Related Notes

- Step: [[02_Phases/Phase_07_hybrid_cross_source_research/Steps/Step_05_deliver-mixed-source-demo-and-explorable-report|STEP-07-05 Deliver Mixed-Source Demo and Explorable Report]]
- Phase: [[02_Phases/Phase_07_hybrid_cross_source_research/Phase|Phase 07 hybrid cross source research]]

## Refined PR Gate — 2026-07-20

- Thoroughly test via Playwright: progress, drilldown, document citations, dataset provenance, contradiction disclosure, cancellation, recovery, loading/empty/failure states, keyboard/focus/labels/landmarks, and no console/page errors.
- Capture exactly 1440x900, 1024x768, and 390x844 in light and dark; visually inspect all six for overflow, clipping, overlap, density, controls/focus, theme leakage, and hierarchy, fixing every defect.
- Verify explicit theme persistence, no persistence of OS-derived theme, and synchronized `html`/app-root themes.
- Run focused Solid tests, `bun run test:e2e`, `bun run typecheck`, `bun run lint`, `bun run lint:imports`, full `bun test`, and vault doctor.
- Inspect UI/API consumers, reactive lifecycle, SSE cleanup/reconnect, unsafe HTML, URLs/locators, provenance, responsive CSS, accessibility, security, and secrets. Zero known defects may remain.
