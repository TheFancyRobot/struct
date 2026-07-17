# Fred Runtime and Workflow Integration Spike

## Goal

Prove the smallest reusable Fred boundary for one typed research run before Phase 1 creates canonical `apps/` and `packages/` code.

## Result

The published Fred surface is sufficient for:

1. booting a deterministic runtime with `createFred()`;
2. defining a typed workflow with `defineWorkflow()`;
3. running one deterministic Effect-backed tool inside that workflow;
4. observing stable hook points around pipeline and step execution;
5. exposing optional JSON / SSE workflow transport through `@fancyrobot/fred-http`; and
6. regression-testing the contract with `@fancyrobot/fred/eval`.

The published Fred surface is **not** yet sufficient evidence for the product to outsource durable cancellation, product event journaling, cross-process resume, or large-output persistence. Those stay product-owned until STEP-00-02 proves a restart-safe contract.

## Disposable Harness

- Harness root: `spikes/fred-runtime/`
- Main runtime boundary: `spikes/fred-runtime/src/runtime-harness.ts`
- Typed contracts: `spikes/fred-runtime/src/contracts.ts`
- Runtime proof: `spikes/fred-runtime/test/runtime-harness.test.ts`
- HTTP proof: `spikes/fred-runtime/test/http-surface.test.ts`
- Eval proof: `spikes/fred-runtime/test/eval-compatibility.test.ts`

Harness shape:

```text
Schema-validated input
  -> Fred workflow entry
  -> deterministic Effect service/tool
  -> compact checkpoint metadata with artifact reference
  -> typed terminal recommendation
```

The harness deliberately keeps the deterministic policy in an Effect service and treats Fred as the orchestration shell around it.

## Fred vs Product Ownership Boundary

| Concern | Fred owns | Product owns | Decision |
| --- | --- | --- | --- |
| Workflow graph execution | Step scheduling and node execution | Workflow registration policy and durable product semantics | Use Fred directly |
| Typed workflow IO | Runtime schema validation at workflow boundaries | Canonical domain schema definitions and versioning | Product defines schemas; Fred enforces them |
| Deterministic tools | Invocation boundary only | Retrieval, persistence, citation validation, SQL, security, and artifact handling | Keep deterministic work in Effect services |
| Run identity | Internal workflow run ID | Public `ResearchRunId`, journal cursor, attempt, idempotency, and audit identifiers | Product run ID is primary |
| Checkpoints | Workflow-level hook / checkpoint integration points | Compact checkpoint record, artifact references, replay policy, and winner rules | Product journal and checkpoint stay authoritative |
| Progress events | Hook callbacks and optional coarse SSE lifecycle | Append-only product event journal, SSE projection, auth rechecks, replay cursors | `fred-http` is not the product event bus |
| HTTP transport | Optional endpoint exposure via `withHttp()` | Typed public API, auth model, request shaping, research UX, and reconnection semantics | Reuse selectively, not as the core product API |
| Observability | Hook/event touchpoints | Correlated domain spans, metrics, audit events, and user-facing progress | Product-owned traces wrap Fred activity |
| Evaluation | Golden-trace tooling | Corpus generation, quality gates, and release policy | Reuse `@fancyrobot/fred/eval` |

## Typed Reuse Contract for Later Phases

Later phases may rely on these stable outputs from this spike:

- A typed workflow can return a validated `finalOutput` from public Fred APIs.
- Workflow hooks provide viable product-local integration tap points: `beforePipeline`, `beforeStep`, `afterStep`, `afterPipeline`, `onStepError`.
- A compact checkpoint should carry only identifiers, bounded metadata, and artifact references; never inline large tool payloads.
- `fred-http` can expose a deterministic workflow for smoke testing or controlled admin surfaces, but its coarse lifecycle SSE must not become the product journal contract.
- Golden traces can validate boundary behavior offline with the same Effect schemas used at runtime.

## Gap Register

| Gap | Classification | Safe default | Owner |
| --- | --- | --- | --- |
| Granular research progress events | product-local adapter | Product journal emits domain events from worker-owned state changes. | STEP-00-02 |
| Durable cancellation | product-local adapter | Persist cancel intent and poll at cooperative boundaries. | STEP-00-02 |
| Cross-process resume | product-local adapter | Keep product checkpoint shape separate from Fred identity. | STEP-00-02 |
| Large outputs by reference | product-local adapter | Persist artifact ID/hash/size only in checkpoints. | STEP-00-02 |
| Typed tool-failure propagation | product-local adapter | Preserve tagged domain/tool failures and fail closed on schema mismatches instead of coercing malformed results. | STEP-00-02 / Phase 1 runtime packages |
| Bounded parallel decomposition | deferred | Start with explicit serial or tightly bounded product-managed fan-out; do not assume generic Fred-native decomposition semantics yet. | Phase 5 |
| Capability-aware routing | deferred | Start with explicit product policy and bounded models. | Phase 5 |
| Generic upstream ergonomics around durable checkpoint stores | candidate generic Fred contribution | Only propose after a portable repro exists. | Future Fred upstream work |

## STEP-00-02 Handoff

STEP-00-02 may assume the following without reopening STEP-00-01:

- **Run correlation rule:** product `runId` is the public identity; Fred run identity is correlation metadata only.
- **Checkpoint ownership:** the authoritative durable record is product-owned, not a Fred-internal checkpoint.
- **Hook decision:** capture lifecycle transitions from `beforePipeline`, `beforeStep`, `afterStep`, `afterPipeline`, and `onStepError` into product-local observability and journals.
- **Inline payload budget:** keep checkpoints under 64 KiB and move larger values to artifact references.
- **HTTP decision:** coarse `fred-http` SSE is acceptable for smoke tests but insufficient as the user-facing progress contract.

## Observed Validation Failures

The harness now records two negative-path boundary checks:

- `tool-invalid-output: malformed result` forces a malformed deterministic tool payload through the product-owned tool schema boundary and fails with `DeterministicToolValidationFailure`.
- `workflow-invalid-output: malformed terminal result` bypasses the local decode and forces a malformed terminal object through Fred's workflow output schema, which fails with `WorkflowOutputValidationError`.

Those checks live in `spikes/fred-runtime/test/runtime-harness.test.ts` and exist to prevent silent coercion of malformed typed outputs.

## Validation Evidence

Run from `spikes/fred-runtime/`:

```bash
bun --version
node --version
npm view @fancyrobot/fred version
npm view @fancyrobot/fred-http version
bun install --frozen-lockfile
bun test
bunx tsc -p tsconfig.json --noEmit
```

Observed result:

- Bun `1.3.13`
- Node `v24.15.0`
- `@fancyrobot/fred` `2.0.0`
- `@fancyrobot/fred-http` `1.0.0`
- frozen install: no changes
- tests: `8 pass / 0 fail`
- typecheck: pass

## Reuse vs Discard

- **Reuse conceptually:** schema boundaries, hook points, HTTP envelope lessons, eval pattern, and the run/checkpoint ownership rule.
- **Reimplement canonically in Phase 1:** actual worker workflow registration, product repositories, public APIs, journal appenders, and persistence adapters.
- **Discard directly:** the spike package itself once Phase 1 absorbs the contract into the real monorepo packages.
