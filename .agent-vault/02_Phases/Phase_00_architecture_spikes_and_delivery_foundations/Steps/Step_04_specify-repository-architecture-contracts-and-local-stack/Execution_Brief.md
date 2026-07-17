# Execution Brief

## Exact Outcome

- Produce the concrete contracts, artifacts, and bounded implementation/design surfaces for Repository Architecture Contracts and Local Stack that this step is responsible for before any broader follow-on work begins.

## Prerequisites

- Re-read [[02_Phases/Phase_00_architecture_spikes_and_delivery_foundations/Phase|Phase 00 architecture spikes and delivery foundations]] and confirm the step still matches the current roadmap sequence.
- Confirm the handoff from [[02_Phases/Phase_00_architecture_spikes_and_delivery_foundations/Steps/Step_03_spike-duckdb-bun-parquet-and-isolation-topology|STEP-00-03 Spike DuckDB Bun Parquet and Isolation Topology]] before widening scope.
- Keep deterministic work in typed Effect services, repositories, and tools; reserve Fred for agentic orchestration only.
- Treat the listed files as planned starting points; create only the smallest set needed to land the slice.

## Planned Starting Files

- These paths may not exist yet; use them as the first bounded implementation or design surface.
- `package.json`
- `bunfig.toml`
- `tsconfig.base.json`
- `docker-compose.yml`
- `apps/web/package.json`
- `apps/api/package.json`
- `apps/worker/package.json`

## Required Reading

- [[02_Phases/Phase_00_architecture_spikes_and_delivery_foundations/Phase|Phase 00 architecture spikes and delivery foundations]]
- [[01_Architecture/System_Overview|System Overview]]
- [[01_Architecture/Code_Map|Code Map]]
- [[01_Architecture/Agent_Workflow|Agent Workflow]]
- [[02_Phases/Phase_00_architecture_spikes_and_delivery_foundations/Steps/Step_03_spike-duckdb-bun-parquet-and-isolation-topology|STEP-00-03 Spike DuckDB Bun Parquet and Isolation Topology]]
- `docs/product-brief.md` sections 5-7, 13, 18-19, 21, 24, 26, and 29-31.

## Concrete Deliverables

- Define the concrete contract for Repository Architecture Contracts and Local Stack in the first planned domain, persistence, or documentation files so downstream implementation does not need to rediscover the boundary.
- Expose only the minimal API surface in `apps/api/package.json` needed to exercise this step end to end.
- Constrain worker-side execution in `apps/worker/package.json` to one resumable, observable path for this slice.
- Use `apps/web/package.json` to expose only the UI states required to inspect this step’s output and failures.

## Smallest Bounded Checklist

- First, define the concrete contract for Repository Architecture Contracts and Local Stack in the first planned domain, persistence, or documentation files so downstream implementation does not need to rediscover the boundary.
- Then, expose only the minimal API surface in `apps/api/package.json` needed to exercise this step end to end.
- Next, constrain worker-side execution in `apps/worker/package.json` to one resumable, observable path for this slice.
- Finish by leaving one observable typed path—test, route, worker flow, or UI state—that proves the slice is ready for the next dependent step.

## Constraints and Non-Goals

- Keep Phase 0 work decision-oriented: prove boundaries, not broad production scaffolding.
- Keep deterministic work in typed Effect services and adapters; use Fred only where agentic judgment is actually required.
- Record tradeoffs and rejected options explicitly so later implementation steps do not need to rediscover them.

## Related Notes

- Step: [[02_Phases/Phase_00_architecture_spikes_and_delivery_foundations/Steps/Step_04_specify-repository-architecture-contracts-and-local-stack|STEP-00-04 Specify Repository Architecture Contracts and Local Stack]]
- Phase: [[02_Phases/Phase_00_architecture_spikes_and_delivery_foundations/Phase|Phase 00 architecture spikes and delivery foundations]]

## Refinement Addendum

### Documentation-First Starting Points

- Start with `docs/architecture.md`, `docs/implementation-plan.md`, `docs/roadmap.md`, and `README.md`; add `docs/local-development.md` or `docs/repository-contract.md` only when content does not belong in an existing canonical document.
- Listed manifests, config, compose, and app package files describe the future contract. Do not create them in Phase 0 except in a disposable tooling proof; STEP-01-01 owns canonical scaffolding.
- Reconcile STEP-00-01 Fred pins, STEP-00-02 event/checkpoint ownership, STEP-00-03 data topology, STEP-00-05 trust ownership, and STEP-00-06 gate tiers before completion.

### Required Contract Artifacts

1. Canonical tree, package responsibilities, allowed dependency directions, forbidden cycles/imports, and public/internal contract ownership.
2. Planned root command inventory for install, dev, build, typecheck, lint, unit, integration, e2e, migrations, corpus smoke, and benchmarks.
3. Fred pinning, lockfile ownership, and a dev-only local override policy excluded from releases.
4. Local service table for PostgreSQL/pgvector, artifact storage, API, worker, web, and any data sidecar: owner, port/socket, volume, health check, startup order, shutdown, and reset behavior.
5. Environment/secrets/example-file policy, safe volumes/temp roots, and log/event sanitization.
6. Migration ownership, ordering, forward/rollback policy, and the only app permitted to execute migrations.
7. CI gate matrix for PR, nightly, and pre-release, including security, recovery, evaluation, docs, and performance checks.
8. Apple Silicon/Linux notes, Docker-unavailable fallbacks, and explicit reproduction blockers.
9. Phase 1 handoff naming the exact initial files and intentional deferrals.

### Constraints and Manual Dry Run

- Empty manifests/directories are not architecture evidence. Do not add Kafka, Kubernetes, a dedicated vector database, or a distributed workflow engine.
- Preserve domain independence, worker ownership of durable work, API ownership of auth/contracts/SSE, and product-local Fred adapters.
- A first-day developer must be able to narrate bootstrap order, ownership, dependency rules, migration flow, and CI checks from the docs without guessing; record ambiguity as a blocker with an owner.
