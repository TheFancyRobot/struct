# Fred Compatibility Matrix

## Scope

STEP-00-01 validates the smallest public Fred surface the product can safely consume in Phase 1. Evidence is limited to published packages, public exports, a disposable spike harness in `spikes/fred-runtime/`, and pinned upstream examples from the local Fred checkout at commit `b964f3480c177ba3e3805cb66356c1e0f3f30cce`.

## Environment Evidence

- `bun --version` → `1.3.13`
- `bun pm view @fancyrobot/fred version` → `2.0.0`
- `bun pm view @fancyrobot/fred-http version` → `1.0.0`
- Local Fred checkout inspected for examples only → `b964f3480c177ba3e3805cb66356c1e0f3f30cce`

## Compatible Public Surface

| Package | Version | Public surface / API | Proving test | Observed result | Limitation / note | Product consumer |
| --- | --- | --- | --- | --- | --- | --- |
| `@fancyrobot/fred` | `2.0.0` | `createFred()` | `spikes/fred-runtime/test/runtime-harness.test.ts` | Runtime boots without provider config for deterministic function workflows. | Product must still own app-level config, auth, and persistence. | `apps/worker`, `packages/fred-workflows` |
| `@fancyrobot/fred` | `2.0.0` | `defineWorkflow()` with typed `input` / `output` schemas | `spikes/fred-runtime/test/runtime-harness.test.ts` | One typed research workflow executes and returns a validated `finalOutput`. Invalid input is rejected before node execution, and malformed terminal output is rejected with `WorkflowOutputValidationError`. | This spike proves one bounded happy-path graph plus schema-boundary regression checks only. | `packages/fred-workflows`, `packages/research-engine` |
| `@fancyrobot/fred` | `2.0.0` | Workflow hooks: `beforePipeline`, `beforeStep`, `afterStep`, `afterPipeline`, `onStepError` | `spikes/fred-runtime/test/runtime-harness.test.ts` | Hook callbacks fire in stable order and are sufficient as integration tap points. | Hook order alone is not a durable product event log. | `apps/worker`, `packages/observability` |
| product-owned tool schema boundary | spike-local | `DeterministicToolOutputSchema` decode in the deterministic Effect service | `spikes/fred-runtime/test/runtime-harness.test.ts` | A malformed deterministic tool payload fails closed with `DeterministicToolValidationFailure`. | This is product-owned validation, not Fred core behavior. | `packages/research-engine`, `packages/fred-workflows` |
| `@fancyrobot/fred` | `2.0.0` | `@fancyrobot/fred/eval` golden-trace assertions | `spikes/fred-runtime/test/eval-compatibility.test.ts` | Local golden-trace assertions run offline and decode the same Effect schemas as the harness. | This validates regression tooling, not runtime durability. | `packages/evaluation` |
| `@fancyrobot/fred-http` | `1.0.0` | `withHttp()` workflow endpoints with JSON + SSE envelopes | `spikes/fred-runtime/test/http-surface.test.ts` | Default JSON endpoints and ordered SSE lifecycle events work with scoped API keys. | The SSE event envelope is coarse and not the final product journal contract. | Optional smoke/admin exposure only |

## Deferred / Not Yet Proven in This Step

| Surface | Current decision | Owner / follow-up |
| --- | --- | --- |
| Durable cancellation | Product-local design until measured in a restart-safe spike. | STEP-00-02 |
| Cross-process checkpoint resume | Treat as unproven. Use Fred identity only as correlation metadata. | STEP-00-02 |
| Large outputs by reference | Product-owned artifact references remain mandatory. | STEP-00-02 |
| Typed tool-failure propagation | Preserve tagged domain/tool failures and reject malformed tool payloads at the product-owned schema boundary. | STEP-00-02 / Phase 1 runtime packages |
| Capability-aware routing | Keep product-local policy outside Fred core until the need is proven. | Later Phase 0 / Phase 5 |
| Bounded parallel decomposition | Start with explicit product-managed fan-out and only upstream a generic Fred abstraction with a portable repro. | Phase 5 |
| Provider routing for live model work | Consume through Fred's public provider registry only when agentic phases begin. | Phase 1+ |

## Phase-1 Consumption Rule

Consume only the surfaces above from published packages. Do not import unpublished Fred internals, do not let `fred-http` define the user-facing research event contract, and do not let Fred checkpoints replace the product journal or checkpoint record.
