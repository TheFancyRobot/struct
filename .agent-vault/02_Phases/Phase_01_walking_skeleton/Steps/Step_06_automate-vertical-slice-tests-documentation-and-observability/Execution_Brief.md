# Execution Brief

## Exact Outcome

- Produce the concrete contracts, artifacts, and bounded implementation/design surfaces for Vertical Slice Tests Documentation and Observability that this step is responsible for before any broader follow-on work begins.

## Prerequisites

- Re-read [[02_Phases/Phase_01_walking_skeleton/Phase|Phase 01 walking skeleton]] and confirm the step still matches the current roadmap sequence.
- Confirm the handoff from [[02_Phases/Phase_01_walking_skeleton/Steps/Step_05_stream-persisted-progress-and-render-navigable-citation|STEP-01-05 Stream Persisted Progress and Render Navigable Citation]] before widening scope.
- Keep deterministic work in typed Effect services, repositories, and tools; reserve Fred for agentic orchestration only.
- Treat the listed files as planned starting points; create only the smallest set needed to land the slice.

## Planned Starting Files

- These paths may not exist yet; use them as the first bounded implementation or design surface.
- `apps/api/test/walking-skeleton.integration.test.ts`
- `apps/web/e2e/walking-skeleton.spec.ts`
- `packages/observability/src/tracing.ts`
- `packages/evaluation/src/walking-skeleton.ts`
- `docs/setup.md`

## Required Reading

- [[02_Phases/Phase_01_walking_skeleton/Phase|Phase 01 walking skeleton]]
- [[01_Architecture/System_Overview|System Overview]]
- [[01_Architecture/Code_Map|Code Map]]
- [[01_Architecture/Domain_Model|Domain Model]]
- [[01_Architecture/Agent_Workflow|Agent Workflow]]
- [[02_Phases/Phase_01_walking_skeleton/Steps/Step_05_stream-persisted-progress-and-render-navigable-citation|STEP-01-05 Stream Persisted Progress and Render Navigable Citation]]
- `docs/architecture.md` §11 (observability architecture), §12 (walking-skeleton slice)
- `docs/local-development.md` (local stack, ports, env vars)
- `docs/repository-contract.md` §2 (CI gate matrix)
- `docs/product-brief.md` sections 6-8, 10, 13, 17-19, 23, 26-27, and 29-31.

## Concrete Deliverables

- Add the first vertical-slice integration/e2e tests, basic tracing/logging hooks, and setup documentation that explain how to run the skeleton.
- Make the walking slice observable enough to diagnose ingest, retrieval, and citation failures without debugger-only access.
- Capture the exact demo path, prerequisites, and known gaps so Phase 02 builds on evidence rather than tribal knowledge.

## Concrete Context from Architecture and Decisions

### Integration test scope (architecture.md §12, repository-contract.md §2.2)

The integration test must prove the full walking-slice path:
1. Create a project (API → PostgreSQL)
2. Upload/register one text source (API → worker → source-storage → PostgreSQL)
3. Ingest the source (worker → normalization → artifact storage → event journal)
4. Start a research run (API → worker → Fred workflow → retrieval → synthesis)
5. Stream progress over SSE (API → web client)
6. Validate one citation (worker → citation validation → PostgreSQL)
7. Verify the answer survives restart (PostgreSQL persistence check)

Test framework: Bun's native test runner. Run via
`DATABASE_URL=... bun test` or a `bun run test:integration` alias that invokes
Bun-native tests.

### E2E test scope (frontend-architecture.md §7.3)

- Use a Bun-native test entry point with the smallest browser-driving dependency
  needed for the real web path.
- Cover the browser surface implemented by Phase 01: replay persisted research
  progress → view the completed answer → focus and open a citation → render its
  exact highlighted source context.
- Include keyboard navigation assertions (accessibility)
- Mock HTTP/SSE at the browser boundary so the UI test is deterministic and
  requires no provider keys.
- The `bun run test:e2e` script must invoke a Bun-native test entry point such
  as `bun test test/e2e`.

Project/source authoring screens are not part of the Phase 01 web surface and
must not be created solely for this test. The single PostgreSQL-backed vertical
slice integration test owns create project → register source → worker ingestion
→ real Fred adapter with deterministic provider → persisted SSE/citation →
database reconnect. Together, the integration and browser tests cover the
walking slice without duplicating later authoring UI.

### Observability (architecture.md §11)

- Correlated trace identity across: API request, command, worker job, Fred run/step, model call, retrieval, citation validation
- `packages/observability/src/tracing.ts` — basic OpenTelemetry wiring:
  - Span creation for each step of the walking slice
  - Structured logs with run ID, source ID, workspace ID
  - No secrets, API keys, or raw source text in logs (docs/local-development.md §3.4)
  - Metric counters for: runs started, runs completed, runs failed, citations validated
- Install `@opentelemetry/api`, `@opentelemetry/sdk-node`, `@opentelemetry/exporter-trace-otlp-http` in `packages/observability`
- For the walking slice, traces log to stdout (OTLP exporter is configured but not required to have a collector running)

### packages/evaluation scaffolding

**`packages/evaluation/` must be created with**:
- `package.json`:
  ```json
  {
    "name": "@struct/evaluation",
    "version": "0.0.1",
    "private": true,
    "scripts": {
      "corpus:smoke": "bun src/corpus-smoke.ts",
      "corpus:eval": "bun src/corpus-eval.ts",
      "bench": "bun src/benchmarks/run.ts"
    },
    "dependencies": {
      "effect": "3.22.0",
      "@struct/domain": "workspace:*"
    }
  }
  ```
- `tsconfig.json` extending root `tsconfig.base.json`
- `src/index.ts` — public surface (initially exports corpus spec types)
- `src/corpus-smoke.ts` — placeholder for small synthetic corpus subset
- `src/corpus-eval.ts` — placeholder for full ~25,000-file corpus evaluation
- `src/benchmarks/run.ts` — placeholder for performance benchmarks
- `test/` directory for unit tests

**Note**: The evaluation package is layer 3 (orchestration & eval). It may import `domain`, layers 1–2, but not apps or `workflows`.

### Setup documentation (docs/setup.md)

**Scope**: `docs/setup.md` is a **concise quickstart** (target: <100 lines) that links to canonical docs for details. It must NOT duplicate content from `docs/local-development.md` or `docs/repository-contract.md`.

**Structure**:
```markdown
# Quickstart

## Prerequisites
- Bun 1.3.13 and Docker (for PostgreSQL)
- See [local-development.md §4](./local-development.md) for platform-specific notes

## Setup
1. `bun install --frozen-lockfile`
2. `docker compose up -d postgres`
3. `bun run migrations:up`
4. `bun run dev` (starts web, api, worker concurrently)

## Environment
- Copy `.env.example` to `.env` and adjust as needed
- See [local-development.md §3](./local-development.md) for variable descriptions

## Testing
- `bun run test` — unit tests
- `bun run test:integration` — integration tests (requires PostgreSQL)
- `bun run test:e2e` — browser/e2e tests
- See [repository-contract.md §2](./repository-contract.md) for CI gate matrix

## Known Gaps
- No PDF/Office parsing (Phase 02)
- No datasets or vector search (Phase 02+)
- No directory recursion (Phase 03)
- See [roadmap.md](./roadmap.md) for full phase plan
```

**Rationale**: Consolidating into a single quickstart avoids confusion about which doc to read first. Detailed information (ports, volumes, reset behavior, platform fallbacks) remains in `docs/local-development.md` as the canonical reference.

### CI gate alignment (repository-contract.md §2.1)

This step ensures the walking slice passes the PR gate:
- `bun install --frozen-lockfile` → lockfile resolves
- `bun run typecheck` → TS 7.0.2 strict
- `bun run lint` + `lint:imports` → ESLint + boundary checks
- `bun run test` → unit tests
- `bun run build` → all apps build
- `bun run secrets:scan` → no committed secrets
- `bun run docs:lint` → docs link-check
- migration round-trip: `migrations:up && migrations:down && migrations:up`

### Authoritative Bun runtime boundary (2026-07-19)

- Maintained host applications, workspace packages, scripts, and tests use Bun
  only. Do not add or require Vitest, `tsx`, or Node for this step.
- Implement unit and integration coverage with Bun's native test runner.
  Canonical direct commands are `bun test` and, when PostgreSQL coverage is
  required, `DATABASE_URL=... bun test`. Root aliases such as
  `bun run test:integration` are permitted only when they invoke Bun-native
  tests.
- Implement the deterministic browser/E2E gate through a Bun-owned script and
  Bun-native test entry point (for example, `bun test test/e2e`).
  Browser-driving libraries may be dependencies, but Vitest browser mode is not
  the runner and `test:e2e` must not invoke `vitest`.
- Evaluation package executables run directly with Bun:
  `bun src/corpus-smoke.ts`, `bun src/corpus-eval.ts`, and
  `bun src/benchmarks/run.ts`.
- Quickstart prerequisites list Bun 1.3.13 and Docker for maintained host
  development; Node is not a host prerequisite. An explicitly isolated
  native-dependency container/service image may carry the runtime required by
  its adapter, pinned inside that image, without establishing a second
  workspace toolchain. Phase 04's planned DuckDB sidecar is the accepted
  instance; DuckDB must not run as a host child process or load its native
  adapter into a maintained host application.
- CI and completion evidence use the native Bun equivalents above, including
  serial execution for PostgreSQL-backed suites where shared database state
  requires it.

## Constraints and Non-Goals

- Optimize for a thin, end-to-end slice rather than broad but unexecutable scaffolding.
- Keep domain and infrastructure seams typed at the boundary and avoid leaking product behavior into Fred core.
- Each change should leave one user path closer to runnable with persistence, streaming, and citations all visible.

## Related Notes

- Step: [[02_Phases/Phase_01_walking_skeleton/Steps/Step_06_automate-vertical-slice-tests-documentation-and-observability|STEP-01-06 Automate Vertical Slice Tests Documentation and Observability]]
- Phase: [[02_Phases/Phase_01_walking_skeleton/Phase|Phase 01 walking skeleton]]
