# Implementation Notes

- Capture durable findings learned during execution. Prefer short bullets with file paths, commands, and observed behavior.

## Session 1 — Documentation contract (step-00-04-implementor)

### Upstream evidence reconciled
- STEP-00-01 (completed): Fred pins `@fancyrobot/fred@2.0.0` + `@fancyrobot/fred-http@1.0.0`; Bun 1.3.13, Node v24.15.0, TS 7.0.2; local Fred ref commit `b964f3480c177ba3e3805cb66356c1e0f3f30cce`; product owns runId/journals/checkpoints/auth/replay; `fred-http` SSE is coarse transport only. Gap register: typed tool-failure propagation (Phase 1), bounded parallel decomposition + capability-aware routing (Phase 5).
- STEP-00-02 (completed): product owns append-only research event journal; event identity `(runId, attempt, sequence)`, cursor `cursor:<attempt>:<sequence>`; SSE reconnect outcomes `events`/`resync-required`/`forbidden`; cancel-before-terminal winner rule; checkpoints < 64 KiB, large outputs by reference; restart proof exit `86`→`0`, duplicate side-effect rate `0`.
- STEP-00-03 (completed): DuckDB topology **`worker`** selected — isolated child process, JSON-over-stdio IPC, spawned by `apps/worker` (NOT a Docker service). Hardening order: `allow_community_extensions=false` + `allow_unsigned_extensions=false` → `SET allowed_directories=['<sandboxRoot>']` → `SET enable_external_access=false`. Atomic Parquet promote (`<dest>.tmp-<pid>-<ts>` then rename), byte cap, `memory_limit`/`threads`/wall-clock timeout. `direct` rejected (native crash not containable). `@duckdb/node-api` 1.5.4-r.1; rowsHash `73d08d56…` reproducible.

### Dependency-graph correction (important)
- The Execution Brief said "reconcile STEP-00-05/06 before completion," but the actual vault dependency graph shows STEP-00-05 `depends_on` STEP-00-04 and STEP-00-06 `depends_on` STEP-00-05. So 05/06 are **downstream dependents**, not prerequisites. Their constraints were reconciled against the existing `docs/security-model.md` / `docs/evaluation-strategy.md` / DEC-0009 / DEC-0011, and 05/06 were named as finalizing owners (explicit deferral with owner) in `docs/repository-contract.md` §3.4. This is consistent with the Validation Plan's allowance: "Any unanswered item is a blocker or explicit deferral with an owner."

### Deliverables landed (docs-only)
- `docs/architecture.md` — added §4.2 dependency direction rules + forbidden imports, §4.3 public/internal contract ownership, §4.4 Fred pinning/lockfile/dev-override policy, §6.5 migration ownership/ordering/rollback (sole executor = `apps/api`).
- `docs/local-development.md` (new) — local service table (PG/pgvector, artifact storage, API, worker, web, DuckDB worker child) with owner/port/volume/health/startup/shutdown/reset; env/secrets/example-file policy; safe volumes/temp roots; log/event sanitization; Apple Silicon/Linux notes; Docker-unavailable fallback; reproduction blockers.
- `docs/repository-contract.md` (new) — root command inventory; CI gate matrix (PR/nightly/pre-release incl. security/recovery/evaluation/docs/perf); Phase 1 handoff (exact initial files + deferrals + explicitly excluded infrastructure).
- `README.md` — bootstrap quick-start, planned layout, canonical-doc index (was empty).
- `docs/implementation-plan.md` + `docs/roadmap.md` — cross-references to the new contract docs.

### Constraints respected
- NO premature scaffolding: no `package.json`, `bunfig.toml`, `tsconfig.base.json`, `docker-compose.yml`, `apps/`, or `packages/` created. All paths marked `existing`, `created by STEP-01-01`, or `deferred`.
- NO git mutation: `git diff --check` substituted with read-only `rg` whitespace checks (no trailing whitespace / tabs).
- Excluded infrastructure (Kafka, Kubernetes, dedicated vector DB, distributed workflow engine) recorded as rejected in `docs/repository-contract.md` §3.3, not adopted.

### Validation observed
- Combined keyword `rg` across the 6 canonical docs: 171 matches (coverage present for `apps/`, `packages/`, PostgreSQL, pgvector, DuckDB, Fred, migration, typecheck, nightly, pre-release).
- Excluded-infrastructure `rg`: all matches in rejection context (product-brief constraint, DEC-0004 rejected option, repository-contract excluded list, constraint statements) — none adopted.
- Whitespace: clean (no trailing whitespace, no tabs).
- Junior dry run: all six items answerable from docs (file order, dependency directions, process ownership, startup/reset/secrets, CI gates, platform fallbacks).

## Related Notes

- Step: [[02_Phases/Phase_00_architecture_spikes_and_delivery_foundations/Steps/Step_04_specify-repository-architecture-contracts-and-local-stack|STEP-00-04 Specify Repository Architecture Contracts and Local Stack]]
- Phase: [[02_Phases/Phase_00_architecture_spikes_and_delivery_foundations/Phase|Phase 00 architecture spikes and delivery foundations]]
