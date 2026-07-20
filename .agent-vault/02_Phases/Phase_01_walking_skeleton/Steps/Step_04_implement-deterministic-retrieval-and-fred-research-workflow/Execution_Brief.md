# Execution Brief

## Exact Outcome

- Produce the concrete contracts, artifacts, and bounded implementation/design surfaces for Deterministic Retrieval and Fred Research Workflow that this step is responsible for before any broader follow-on work begins.

## Prerequisites

- Re-read [[02_Phases/Phase_01_walking_skeleton/Phase|Phase 01 walking skeleton]] and confirm the step still matches the current roadmap sequence.
- Confirm the handoff from [[02_Phases/Phase_01_walking_skeleton/Steps/Step_03_implement-single-text-source-ingestion-and-artifact-storage|STEP-01-03 Implement Single Text Source Ingestion and Artifact Storage]] before widening scope.
- Keep deterministic work in typed Effect services, repositories, and tools; reserve Fred for agentic orchestration only.
- Treat the listed files as planned starting points; create only the smallest set needed to land the slice.

## Planned Starting Files

- These paths may not exist yet; use them as the first bounded implementation or design surface.
- `packages/retrieval/src/search-text.ts`
- `packages/research-engine/src/run-walking-skeleton.ts`
- `packages/workflows/src/graphs/walking-skeleton.ts`
- `apps/api/src/routes/research.ts`
- `apps/worker/src/jobs/run-research.ts`

## Required Reading

- [[02_Phases/Phase_01_walking_skeleton/Phase|Phase 01 walking skeleton]]
- [[01_Architecture/System_Overview|System Overview]]
- [[01_Architecture/Code_Map|Code Map]]
- [[01_Architecture/Domain_Model|Domain Model]]
- [[01_Architecture/Agent_Workflow|Agent Workflow]]
- [[02_Phases/Phase_01_walking_skeleton/Steps/Step_03_implement-single-text-source-ingestion-and-artifact-storage|STEP-01-03 Implement Single Text Source Ingestion and Artifact Storage]]
- `docs/architecture.md` §9 (research architecture), §10 (bounded execution and durability), §9.1 (agent vs tool split)
- DEC-0010: Focused Fred agents with deterministic Effect tools
- DEC-0012: Fred at orchestration boundary; product owns run IDs, journals, checkpoints
- DEC-0001: Fred packages pinned at `@fancyrobot/fred@2.0.0`; `@fancyrobot/fred-http@1.0.0` optional
- `docs/architecture.md` §2.1 (Fred integration baseline, pinned versions)
- `docs/product-brief.md` sections 6-8, 10, 13, 17-19, 23, 26-27, and 29-31.

## Concrete Deliverables

- Implement the smallest retrieval service that can search the stored text source deterministically and hand evidence into one Fred workflow.
- Define a typed research graph for the walking slice with explicit plan/result schemas and no hidden tool contracts.
- Wire one API route and one worker job so a research request becomes a persisted run with bounded retrieval and synthesis.

## Concrete Context from Architecture and Decisions

### New packages to scaffold (deferred from STEP-01-01 per repository-contract.md §3.2)

**Scaffolding order** (each package must be created in this sequence to respect dependency layers):

1. `packages/retrieval/` — full-text search, vector search, reranking, context assembly (layer 2)
2. `packages/research-engine/` — research plans, evidence sufficiency, synthesis contracts (layer 3)
3. `packages/workflows/` — Fred agents, tools, graphs, prompts, workflow adapters (layer 3)

**Package creation checklist for each**:
- `package.json` with correct name, version, dependencies (must respect layer rules from architecture.md §4.2)
- `tsconfig.json` extending root `tsconfig.base.json`
- `src/index.ts` as public surface
- `test/` directory for unit tests

**workflows package.json must include**:
```json
{
  "name": "@struct/workflows",
  "version": "0.0.1",
  "private": true,
  "dependencies": {
    "effect": "3.22.0",
    "@fancyrobot/fred": "2.0.0",
    "@struct/domain": "workspace:*",
    "@struct/research-engine": "workspace:*",
    "@struct/observability": "workspace:*"
  }
}
```

**Critical**: The `@fancyrobot/fred` dependency must be pinned to exactly `2.0.0` (not `^2.0.0` or `~2.0.0`). This is a DEC-0001 requirement. Run `bun install` after creating the package.json to verify the lockfile resolves correctly.

**Test timeout override**: Fred workflow tests use `bun:test`. Apply a bounded
per-test timeout only to the cases that intentionally exercise asynchronous
agent execution; do not add a second test runner or runner-specific config.

### Retrieval service scope (walking-slice minimum)

- Use PostgreSQL full-text search (architecture.md §6.1, DEC-0004) — `tsvector`/`tsquery`
- Search against the normalized text stored by STEP-01-03's ingestion
- Return typed `Evidence` records with source-version ID and text locator (char offset or line range)
- No vector search or reranking in the walking slice (deferred to Phase 02)
- The retrieval service is a deterministic Effect tool, NOT an agent capability

### Fred workflow scope (DEC-0010, DEC-0012, architecture.md §9.1)

- One Fred agent: "answer synthesizer" — receives retrieved evidence, produces a cited answer
- One deterministic tool: `searchText` — calls the retrieval service with typed input/output schemas
- The agent does NOT call arbitrary tools or bypass retrieval (architecture.md §9.1)
- Workflow: `question → searchText tool → agent synthesis → citation-validated answer`
- Product owns run identity, journal events, checkpoint records (DEC-0012)

### Model mock strategy (for deterministic tests)

- **Test mock:** Create a `MockModelProvider` that implements Fred's provider interface and returns a fixed, deterministic response for a given question + evidence input. Register it via Fred's provider registry in test setup.
- **No real provider keys required** for unit/integration tests. The mock returns a pre-canned answer with a citation locator that points to a known passage in the fixture text.
- **CI gate:** All tests in `packages/workflows` and `packages/research-engine` must pass without `FRED_*` provider keys. Only manual smoke tests require real keys.
- **Implementation:** The mock provider is a test fixture in `packages/workflows/test/fixtures/mock-provider.ts`, not production code.

### Research run flow (architecture.md §12, narrowed)

1. API receives research request with a question
2. API creates a `ResearchThread` (if new) and a `ResearchRun` (pending)
3. API dispatches a research job to the worker
4. Worker runs the Fred workflow: calls retrieval tool, invokes agent, validates citations
5. Worker persists the run result and emits research events to `event_journal`
6. Worker marks the run `completed` (or `failed` if citation validation fails)

### Event journal events (architecture.md §7.2, narrowed)

- `research-started` — emitted by API/worker when run begins
- `retrieval-completed` — emitted after retrieval tool returns evidence
- `citations-validated` — emitted after citation validation passes
- `research-completed` — emitted when answer is finalized
- `research-failed` — emitted on failure (insufficient evidence, validation failure, model error)

### Bounded execution (architecture.md §10.2)

- Max steps: 5 (plan → retrieve → synthesize → validate → finalize)
- Max model calls: 1 (synthesis only)
- Max tool calls: 1 (retrieval)
- Max elapsed time: configurable via `Config.number('RESEARCH_MAX_ELAPSED_MS')` with default 60000
- No recursive decomposition or multi-step planning in the walking slice

### Fred package integration

- `@fancyrobot/fred@2.0.0` is added as a dependency in `packages/workflows/package.json` during package scaffolding (see above).
- Do NOT add `@fancyrobot/fred-http` — it is optional and not needed for the walking slice (DEC-0008).
- Fred's `createFred`, `defineWorkflow`, and typed tool registration are the integration surface.
- The Fred workflow adapter in `packages/workflows/src/adapters/` bridges Fred's workflow execution to the product's job queue and event journal.

## Constraints and Non-Goals

- Optimize for a thin, end-to-end slice rather than broad but unexecutable scaffolding.
- Keep domain and infrastructure seams typed at the boundary and avoid leaking product behavior into Fred core.
- Each change should leave one user path closer to runnable with persistence, streaming, and citations all visible.

## Related Notes

- Step: [[02_Phases/Phase_01_walking_skeleton/Steps/Step_04_implement-deterministic-retrieval-and-fred-research-workflow|STEP-01-04 Implement Deterministic Retrieval and Fred Research Workflow]]
- Phase: [[02_Phases/Phase_01_walking_skeleton/Phase|Phase 01 walking skeleton]]
