# Validation Plan

## Acceptance Checks

- Confirm this deliverable is present, testable where applicable, and bounded to the step: The concrete contract for Repository Architecture Contracts and Local Stack in the first planned domain, persistence, or documentation files so downstream implementation does not need to rediscover the boundary.
- Confirm this deliverable is present, testable where applicable, and bounded to the step: Only the minimal API surface in `apps/api/package.json` needed to exercise this step end to end.
- Confirm this deliverable is present, testable where applicable, and bounded to the step: Worker-side execution in `apps/worker/package.json` to one resumable, observable path for this slice.
- The step leaves the next dependent step with a stable typed boundary, not a placeholder or undocumented assumption.

## Planned Verification

- Run the nearest repo-wide or package-targeted `bun run typecheck` command once the touched packages and apps exist.
- Planned app/integration coverage once the app surfaces exist: `bun test apps/api apps/web apps/worker` for the API/worker/web path touched here.
- Add a browser/e2e or component-level check that exercises the visible UI state introduced by this step and one failure presentation path.

## Edge Cases

- Partial progress, retries, or restarts should leave this step in a typed, inspectable state rather than a silent half-success.
- Version drift, missing required fields, or ambiguous identity rules should be called out in the contract instead of deferred to implementation guesswork.

## Regression Expectations

- This step should remain a clean successor to [[02_Phases/Phase_00_architecture_spikes_and_delivery_foundations/Steps/Step_03_spike-duckdb-bun-parquet-and-isolation-topology|STEP-00-03 Spike DuckDB Bun Parquet and Isolation Topology]] rather than reworking already-planned scope upstream.
- Do not narrow or contradict the product brief, architecture notes, or phase sequencing without an explicit follow-up decision note.
- Do not invent package APIs that imply implementation already exists; keep language and artifacts clearly planned or spike-scoped.
- Make sure later Phase 1 work can start from these outputs without re-litigating repository layout, security boundaries, or evaluation gates.

## Security / Observability / Evaluation Focus

- Model all imported content as untrusted evidence and keep prompt-injection defenses visible in the design outputs.
- Call out checkpoint, event, filesystem, and SQL trust boundaries wherever a spike touches them.
- Prefer observable, restart-safe designs over opaque runtime magic.

## Related Notes

- Step: [[02_Phases/Phase_00_architecture_spikes_and_delivery_foundations/Steps/Step_04_specify-repository-architecture-contracts-and-local-stack|STEP-00-04 Specify Repository Architecture Contracts and Local Stack]]
- Phase: [[02_Phases/Phase_00_architecture_spikes_and_delivery_foundations/Phase|Phase 00 architecture spikes and delivery foundations]]

## Refined Acceptance Contract

### Documentation Checks Available in Phase 0

Run from the repository root and record output:

```bash
git diff --check
rg -n "apps/|packages/|PostgreSQL|pgvector|DuckDB|Fred|migration|typecheck|nightly|pre-release" docs/architecture.md docs/implementation-plan.md docs/roadmap.md README.md docs/local-development.md docs/repository-contract.md 2>/dev/null || true
rg -n "Kafka|Kubernetes|dedicated vector|distributed workflow" docs .agent-vault/02_Phases/Phase_00_architecture_spikes_and_delivery_foundations
```

- Review all named paths as either `existing`, `created by STEP-01-01`, or `deferred`; no planned path may be described as already implemented.
- Cross-check Fred pins/boundaries, event/checkpoint ownership, DuckDB topology, security owners, and gate tiers against STEP-00-01/02/03/05/06 outcomes.
- Verify every local service has ownership, configuration source, health check, persistent/ephemeral volume policy, startup order, reset/recovery steps, and a non-Docker fallback or explicit blocker.
- Verify each migration store has exactly one owner/executor and documented forward, rollback, test, and recovery expectations.

### Junior Dry Run

Without inventing code, a reviewer unfamiliar with the project must be able to write down:

1. the Phase 1 directory/file creation order;
2. package dependency directions and forbidden imports;
3. which process owns API, long-running work, migrations, events, checkpoints, DuckDB, and artifacts;
4. local startup/shutdown/reset and secrets handling;
5. PR, nightly, and pre-release commands/gates; and
6. Apple Silicon/Linux/Docker-unavailable fallbacks.

Any unanswered item is a blocker or explicit deferral with an owner.

### Security, Performance, and Non-Goals

- Volume mounts and temp roots preserve STEP-00-03/05 isolation; local convenience may not widen production permissions.
- Performance budgets and corpus gates are named, but machine-specific threshold calibration stays with the owning spike/evaluation phase.
- Do not add browser/e2e checks for this docs-only step and do not run nonexistent `bun test apps/*` commands.

### Pass / Fail and Handoff

- **PASS:** documentation checks are clean; the dry run requires no hidden assumptions; all evidence tracks are reconciled; STEP-01-01 receives exact bootstrap targets and deferrals.
- **FAIL:** canonical scaffolding is created prematurely, service/migration/security ownership is ambiguous, a contract contradicts spike evidence, or acceptance depends on nonexistent package commands.