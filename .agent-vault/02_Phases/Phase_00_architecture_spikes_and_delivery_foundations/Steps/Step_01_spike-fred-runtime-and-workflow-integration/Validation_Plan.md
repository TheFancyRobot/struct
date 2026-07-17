# Validation Plan

## Acceptance Checks

- Confirm this deliverable is present, testable where applicable, and bounded to the step: A spike note and ADR that pin down where Fred stops and product-local Effect services, repositories, and HTTP/worker adapters begin.
- Confirm this deliverable is present, testable where applicable, and bounded to the step: A narrow runtime harness that can execute one typed research graph without coupling business logic to Fred internals.
- Confirm this deliverable is present, testable where applicable, and bounded to the step: The minimum typed inputs/outputs, lifecycle hooks, and persistence touchpoints later phases should reuse.
- The step leaves the next dependent step with a stable typed boundary, not a placeholder or undocumented assumption.

## Planned Verification

- Review the proposed graph boundary against the product brief execution model and make sure every model/tool boundary can carry an Effect Schema contract.
- Plan a harness-level smoke test that proves one graph can be started, cancelled, and resumed without embedding product logic inside Fred core.
- Planned command once these packages exist: `bun test packages/fred-workflows packages/research-engine` plus the nearest package-level `bun run typecheck`.
- Planned app/integration coverage once the app surfaces exist: `bun test apps/worker` for the API/worker/web path touched here.

## Edge Cases

- Planner state that depends on opaque Fred internals would make later checkpoint/replay work impossible; call that out explicitly.
- The spike must address how streaming events behave if the workflow continues after the client disconnects.
- If the preferred boundary requires product logic inside Fred core, document the fallback and why it is unacceptable or acceptable.

## Regression Expectations

- Do not narrow or contradict the product brief, architecture notes, or phase sequencing without an explicit follow-up decision note.
- Do not invent package APIs that imply implementation already exists; keep language and artifacts clearly planned or spike-scoped.
- Make sure later Phase 1 work can start from these outputs without re-litigating repository layout, security boundaries, or evaluation gates.

## Security / Observability / Evaluation Focus

- Model all imported content as untrusted evidence and keep prompt-injection defenses visible in the design outputs.
- Call out checkpoint, event, filesystem, and SQL trust boundaries wherever a spike touches them.
- Prefer observable, restart-safe designs over opaque runtime magic.

## Related Notes

- Step: [[02_Phases/Phase_00_architecture_spikes_and_delivery_foundations/Steps/Step_01_spike-fred-runtime-and-workflow-integration|STEP-00-01 Spike Fred Runtime and Workflow Integration]]
- Phase: [[02_Phases/Phase_00_architecture_spikes_and_delivery_foundations/Phase|Phase 00 architecture spikes and delivery foundations]]

## Refined Acceptance Contract

### Automated and Manual Evidence

- `bun test` and `bunx tsc -p tsconfig.json --noEmit` pass in the isolated spike package using its frozen lockfile.
- The harness completes one typed run with one deterministic tool call and produces a machine-readable result/trace without a live model dependency; a separate optional live-provider check must be labeled non-gating.
- 100% of touched workflow, agent, and tool inputs/outputs have explicit Effect Schema contracts.
- There are zero imports from unpublished Fred internals and zero secrets or raw source payloads in persisted evidence.
- Inspect the code to confirm runtime execution is confined to entry/test boundaries and deterministic product policy is outside Fred core.
- Inspect serialized checkpoints: each is at most 64 KiB and any larger tool result is represented only by an artifact ID/hash/size reference.
- The compatibility matrix covers every public Fred surface named in this step and records the exact package version/commit evidence.

### Edge, Failure, and Recovery Checks

- Invalid typed input and invalid typed output fail with a typed validation error, not an unhandled exception.
- Deterministic tool failure remains distinguishable from provider, workflow, and checkpoint failure.
- Missing public capability produces a documented product-local fallback and owner; it must not be bypassed through an internal import.
- The harness closes Fred/runtime resources on success and failure and can be rerun without stale state.

### Pass / Fail and Handoff

- **PASS:** all automated checks pass; the compatibility/boundary/gap artifacts are complete; every gap has an owner and fallback; STEP-00-02 can implement against the named run/checkpoint/event hook boundary.
- **FAIL:** evidence is prose-only, a required behavior depends on unpublished internals, application policy is placed in Fred core, a large result is embedded inline, or cancellation/replay is claimed solved without STEP-00-02 evidence.
- Record commands, versions, result artifacts, limitations, and the exact next-step handoff in the Outcome note.