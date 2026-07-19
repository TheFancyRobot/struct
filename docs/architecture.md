# Architecture

This document defines the Phase 0 architecture contract for the Fred-native research workspace described in [product-brief.md](./product-brief.md). It is intentionally implementation-oriented: it fixes the boundaries that must stay stable while leaving room to iterate on internals during the walking skeleton and later phases.

## 1. Product thesis

The product is a trustworthy research workspace, not a generic chatbot.

Its core operating rule is:

> Documents are retrieved. Datasets are queried. Directories are navigated. Large corpora are recursively analyzed.

That rule drives every architectural choice:

- exact answers come from deterministic engines, not model guesswork;
- qualitative synthesis comes from bounded Fred workflows, not ad hoc prompting;
- provenance is attached to immutable source versions, not mutable source identities;
- citations are first-class domain objects, not presentation metadata;
- long-running work is durable, resumable, cancellable, and observable.

## 2. Stable architecture decisions

The canonical records live in `.agent-vault/04_Decisions/`; concise human-readable mirrors live in [`docs/adr/`](./adr/).

| ID | Decision | Architectural effect |
| --- | --- | --- |
| DEC-0001 | Consume stable Fred packages from a standalone monorepo. | Product releases pin public Fred packages; local links are development-only. |
| DEC-0002 | Prefer product-local adapters before Fred core changes. | Product delivery does not depend on upstreaming application policy; only proven generic gaps become Fred candidates. |
| DEC-0003 | Use TypeScript, Bun, and Effect with explicit runtime boundaries. | Domain services remain Effect-native with typed failures; Promise/runtime execution stays at app and adapter edges. |
| DEC-0004 | Use PostgreSQL full-text search and pgvector for initial retrieval. | Retrieval stays behind a replaceable service while v1 avoids another distributed store. |
| DEC-0005 | Use DuckDB and Parquet for the deterministic data plane. | Structured data remains first-class and exact; the in-process/isolated topology is Phase 0 spike-gated. |
| DEC-0006 | Make source versions immutable and provenance typed. | Refresh never retargets historical research or citations. |
| DEC-0007 | Compose a product job/event journal with Fred checkpoints. | Product durability, SSE replay, cancellation, and audit state remain distinct from workflow checkpoints. |
| DEC-0008 | Own the typed API and live research event stream. | `fred-http` may be selectively reused, but its coarse workflow SSE is not the product progress contract. |
| DEC-0009 | Sandbox filesystem roots and allowlist read-only SQL. | Host paths and analytical execution are deterministic deny-by-default security boundaries. |
| DEC-0010 | Use focused Fred agents with deterministic Effect tools. | Agents plan and synthesize; hashing, retrieval, SQL, persistence, authorization, and citation validation remain tools/services. |
| DEC-0011 | Gate releases on a reproducible approximately 25,000-file corpus. | Exactness, semantic coverage, provenance, injection resistance, and recovery are measured before release. |
| DEC-0012 | Keep Fred at the orchestration boundary for typed research runs. | Fred owns workflow execution and hooks; product code owns run IDs, journals, checkpoints, auth, and replay policy. |

### 2.1 Current Fred integration baseline

Phase 0 must verify the pinned compatibility matrix, but planning is based on the current public package surface inspected at Fred commit `b964f3480c177ba3e3805cb66356c1e0f3f30cce` and the published releases available during planning:

- `@fancyrobot/fred@2.0.0` supplies `createFred`, typed agents and Effect-Schema tools, `defineWorkflow`, pipeline/graph builders, workflow run/resume/pending APIs, provider registration, hooks, subagents, Effect integration, checkpoint stores, OpenTelemetry helpers, and evaluation/replay/suite primitives;
- `@fancyrobot/fred-http@1.0.0` is an optional Bun-only enhancer with workflow endpoints, auth/OpenAPI support, and coarse SSE lifecycle events;
- provider packages are selected through Fred's provider registry and remain runtime configuration rather than domain dependencies;
- the Fred CLI and BAML/Convex adapters are development or optional integrations, not required production foundations;
- DEC-0012 constrains product integration to that public orchestration surface: product durability and event semantics remain local responsibilities even when Fred transport helpers are reused.

Known gaps are deliberately assigned to Phase 0 spikes: granular live workflow progress, public durable cancellation, cross-process checkpoint behavior, large outputs by reference, typed tool-failure propagation, capability-aware per-step model routing, and bounded parallel decomposition. The default is a product-owned adapter or policy layer. A Fred change is considered only if the gap is generic, portable, and useful beyond this product.

## 3. System context

### 3.1 Actors

- **Research user** — creates projects, adds sources, asks questions, inspects evidence, saves findings, exports reports.
- **API runtime** — authenticates requests, authorizes access, persists commands, serves queries, and streams state.
- **Worker runtime** — executes ingestion, refresh, indexing, retrieval preparation, research runs, report generation, and recovery.
- **Fred orchestration layer** — plans and coordinates bounded research execution.
- **Deterministic services** — filesystem inspection, document parsing, schema inference, SQL validation, SQL execution, citation validation, persistence.
- **Storage engines** — PostgreSQL, artifact storage, DuckDB, Parquet, embedding provider, model providers.

### 3.2 Trust boundaries

1. **Browser/UI boundary** — untrusted client input enters the system.
2. **API boundary** — authentication, authorization, rate limiting, and input schema validation happen here.
3. **Worker boundary** — long-running effects execute with persisted identity, budgets, and cancellation.
4. **Registered filesystem boundary** — only explicitly registered roots may be traversed.
5. **Model boundary** — models never receive authority; they only receive bounded context and return proposals/synthesis.
6. **Data-engine boundary** — DuckDB can inspect approved staged artifacts only through a constrained adapter.

## 4. Repository architecture

The preferred repository shape remains:

```text
apps/
├── web
├── api
└── worker

packages/
├── domain
├── persistence
├── source-storage
├── ingestion
├── document-processing
├── retrieval
├── data-engine
├── research-engine
├── fred-workflows
├── evaluation
├── observability
└── shared-ui
```

### 4.1 Package responsibilities

| Package | Primary responsibility | Must not do |
| --- | --- | --- |
| `apps/web` | Research UI, source browser, evidence inspector, report editor, SSE consumption | Direct DB access or workflow orchestration |
| `apps/api` | Typed HTTP APIs, auth boundary, query/command handling, SSE endpoint | Heavy ingestion or long-running model work |
| `apps/worker` | Durable workflows, indexing, embeddings, research execution, recovery | UI concerns or direct browser rendering |
| `packages/domain` | Identifiers, schemas, invariants, typed errors, event/value contracts | Runtime-specific I/O |
| `packages/persistence` | Repositories, migrations, transactions, projections, checkpoint records | Business decisions that belong in domain/workflows |
| `packages/source-storage` | Original artifacts, extracted artifacts, manifests, content-addressed storage | Authorization bypasses |
| `packages/ingestion` | Source classification, discovery, hashing, extraction routing, refresh planning | Final answer synthesis |
| `packages/document-processing` | Parsing, normalization, sections, chunks, provenance anchors | Storage policy decisions |
| `packages/retrieval` | FTS, vector search, reranking, filters, dedupe, context assembly | SQL execution |
| `packages/data-engine` | Dataset catalog, schema profiling, SQL validation/execution, result snapshots | Unrestricted code execution or mutable queries |
| `packages/research-engine` | Intent classification, plan composition, evidence sufficiency, contradiction handling, synthesis contracts | Low-level storage access without repositories |
| `packages/fred-workflows` | Fred agents, tools, prompts, graphs, workflow adapters | Product persistence internals |
| `packages/evaluation` | Corpus generation, benchmark harnesses, deterministic assertions, regression reporting | Production request handling |
| `packages/observability` | Trace/log/metric wiring and correlation | Product logic |

### 4.2 Dependency direction rules

Package dependency flows downward only. No package may depend on an app, and no app may depend on another app. The canonical layers are:

| Layer | Packages | May depend on |
| --- | --- | --- |
| 0 — leaf | `domain` | nothing internal; Effect/Schema only |
| 1 — storage & wiring | `persistence`, `source-storage`, `observability`, `shared-ui` | `domain` |
| 2 — processing | `ingestion`, `document-processing`, `retrieval`, `data-engine` | `domain`, layer 1 |
| 3 — orchestration & eval | `research-engine`, `fred-workflows`, `evaluation` | `domain`, layers 1–2 |
| 4 — applications | `apps/web`, `apps/api`, `apps/worker` | any package; never another app |

Allowed directions (downward only, acyclic):

- `apps/worker` is the only app that imports `fred-workflows`, `research-engine`, `ingestion`, and `data-engine` execution paths; it also imports `source-storage` for finalized artifact writes.
- `apps/api` imports `domain`, `persistence`, `retrieval` (query side only), `source-storage` staging helpers for upload handoff, and `observability`; it must not import `fred-workflows`, `research-engine`, `ingestion`, `data-engine`, or `apps/worker`.
- `apps/web` imports `domain`, `shared-ui`, and `observability` only; it must not import `persistence`, `retrieval`, `data-engine`, `research-engine`, `fred-workflows`, or any other app.
- `fred-workflows` imports `research-engine`, `domain`, and `observability`; it must not import `persistence` internals (DEC-0012).
- `research-engine` imports `retrieval`, `data-engine`, `persistence`, `domain`, and `observability`; it must not import `fred-workflows` (one-directional: `fred-workflows → research-engine`).
- `data-engine` and `retrieval` are separate planes: `retrieval` must not import `data-engine` and `data-engine` must not import `retrieval`.

Forbidden cycles and imports:

- No app may import another app (`apps/web` ↔ `apps/api` ↔ `apps/worker` are forbidden).
- No package may import any `apps/*` package.
- `domain` may import nothing internal; it is the leaf.
- No package may import deep internal modules of another package; only the package's public root surface (`index.ts`) is consumable.
- An import-boundary check (e.g. `dependency-cruiser` or `eslint-plugin-import` rules) enforces these directions and is a required root command (see [`docs/repository-contract.md`](./repository-contract.md)).

### 4.3 Public and internal contract ownership

Each package owns one public surface and keeps the rest internal.

| Package | Public contract (exported from root) | Internal (not importable cross-package) |
| --- | --- | --- |
| `domain` | identifiers, Effect Schemas, typed errors, value/event contracts, invariants | nothing internal — this is the canonical type source |
| `persistence` | repository interfaces, migration runner contract | SQL schema files, connection pool internals, migration SQL bodies |
| `source-storage` | artifact store interface, content-addressed reference types | local FS adapter, S3 adapter internals |
| `ingestion` | ingestion plan/manifest types, source-classification contract | extractor routing internals |
| `document-processing` | parsed artifact, section, chunk, provenance-anchor types | parser implementations |
| `retrieval` | search request/result types, context-assembly contract | index tuning, reranker adapter internals |
| `data-engine` | dataset catalog, SQL validation contract, query result snapshot types | DuckDB worker child, hardening internals |
| `research-engine` | research plan, evidence-sufficiency, synthesis contract types | plan revision internals |
| `fred-workflows` | agent/tool/graph/workflow definitions and run boundary | Fred runtime wiring, hook capture internals |
| `evaluation` | corpus spec, benchmark harness, gate assertion contract | generator internals |
| `observability` | trace/log/metric wiring interfaces | exporter/sink internals |
| `shared-ui` | UI component contracts, design tokens | component internals |

Ownership rules:

- `packages/domain` is the single source of canonical Effect Schemas and identifiers. Other packages re-export or consume; they must not redefine a schema that `domain` already owns.
- `apps/api` owns the HTTP API contract: request/response schemas and SSE event shapes. `apps/web` consumes a generated typed client, never internal handlers.
- `apps/worker` owns the durable execution contract: job/run identity, checkpoint record, journal appender, and the DuckDB worker-child lifecycle.
- Cross-package consumption of a deep path (e.g. `packages/persistence/src/sql/...`) is a contract violation even if it compiles.

### 4.4 Fred pinning, lockfile, and dev-only override policy

This concretizes DEC-0001 and the STEP-00-01 compatibility evidence.

- **Pinned production versions** (recorded in the root lockfile; no floating ranges in release dependencies):
  - `@fancyrobot/fred@2.0.0` — workflow execution, typed agents/tools, hooks, checkpoints, eval primitives.
  - `@fancyrobot/fred-http@1.0.0` — optional Bun-only enhancer for smoke/admin surfaces only; never the product event contract (DEC-0008, DEC-0012).
- **Toolchain baseline:** Bun `1.3.13` and TypeScript `7.0.2`. Bun is the sole runtime for maintained host applications, workspace packages, scripts, and tests. Versions are pinned via `engines`, `tsconfig.base.json`, and CI image tags. An explicitly isolated DuckDB or other native-dependency process/container may use the runtime required by its adapter, provided that runtime remains inside the documented process/container boundary and does not become a second host-workspace toolchain. Any maintained-host toolchain upgrade or new runtime exception requires an ADR update.
- **Provider packages** are resolved through Fred's provider registry as runtime configuration, never added as domain or compile-time dependencies.
- **Lockfile ownership:** the root `bun.lock` is the single source of truth for resolved versions. Releases use published registry pins; the lockfile is committed and reproduced with `bun install --frozen-lockfile`.
- **Dev-only local override (excluded from releases):** a developer may link a local Fred checkout (planning reference commit `b964f3480c177ba3e3805cb66356c1e0f3f30cce`) through a gitignored `.env.local` / dev-script mechanism only. The local link must never be written to the committed lockfile and must be stripped before any release build. A CI check verifies the release lockfile resolves to the published pins, not a `file:` link.
- **Boundary:** Fred owns workflow graph execution, typed workflow IO validation, hook callbacks, and coarse SSE lifecycle. Product code owns run identity, journals, checkpoint records, artifact references, auth, replay, retrieval, persistence, citation validation, SQL, and security (DEC-0012; STEP-00-01 gap register).

## 5. Runtime topology

### 5.1 Web application (`apps/web`)

The web app is a focused research surface, not an open-ended chat shell.

Primary responsibilities:

- project and source navigation;
- directory tree browsing;
- ingestion status and retries;
- research thread and run views;
- streaming progress and final answers;
- citation/evidence inspector;
- SQL/result explanation panels;
- saved findings and report editing/export.

Preferred UI layout:

- **left panel:** projects, sources, manifests, dataset/document badges, source filters;
- **center panel:** conversation, streaming progress, final answer, tables, follow-ups;
- **right panel:** evidence inspector, citation details, source preview, JSON pointer/rows/SQL, limitations.

### 5.2 API application (`apps/api`)

The API is the only public command/query boundary.

Responsibilities:

- authenticate the caller;
- enforce workspace/project/source authorization;
- validate all request payloads with Effect Schema;
- translate user actions into durable commands;
- persist command metadata and idempotency keys;
- expose typed query APIs for projects, sources, runs, findings, reports, citations, query details;
- stream job/run events over SSE;
- sanitize errors and redact sensitive infrastructure details.

Non-goals:

- doing directory walks inline with HTTP requests;
- executing long-running model/tool workflows inside request handlers;
- letting clients assemble raw SQL or raw filesystem reads.

### 5.3 Worker application (`apps/worker`)

The worker is the durable execution boundary.

Responsibilities:

- recursive directory discovery;
- manifest creation and refresh planning;
- document extraction and chunking;
- structured dataset import/materialization;
- embedding jobs;
- Fred-driven research execution;
- recursive corpus analysis;
- citation validation;
- report generation;
- retry, cancellation, checkpoint, and resume.

The worker owns progress state because the API process must stay restart-safe and latency-oriented.

## 6. Data and storage architecture

### 6.1 PostgreSQL as the primary system of record

PostgreSQL is the canonical store for:

- workspaces, projects, and memberships;
- logical sources and immutable source versions;
- directory manifests and file-entry metadata;
- document metadata, chunk metadata, and retrieval indexes;
- dataset catalogs and snapshot metadata;
- research threads, runs, plans, steps, findings, reports, and citations;
- ingestion/research checkpoints and idempotency records;
- append-only event journal entries;
- projections used by APIs and SSE cursors.

PostgreSQL also hosts:

- **full-text search** for lexical retrieval;
- **pgvector** for initial vector retrieval;
- metadata filters joining sources, versions, paths, and entity scopes.

This is deliberately conservative: it keeps the first versions operationally simple while still supporting hybrid retrieval.

### 6.2 Artifact storage

Artifact storage is abstracted behind `packages/source-storage`.

Stored artifacts include:

- original uploaded files;
- registered directory file copies or references as policy allows;
- extracted document text and structural artifacts;
- generated manifests;
- staged Parquet files;
- large tool outputs stored by reference;
- exported reports.

The development adapter uses the local filesystem. Production uses an S3-compatible abstraction. The rest of the product must depend on stable object references rather than raw host paths.

### 6.3 DuckDB + Parquet as the structured-data engine

DuckDB is used only through `packages/data-engine` for deterministic structured analysis.

It is responsible for:

- inspecting schema families;
- staging/importing compatible structured files;
- compacting many small records into Parquet when beneficial;
- validating a read-only SQL subset;
- executing bounded queries;
- emitting reproducible query result snapshots and citations.

It is not a general execution sandbox. It must not gain arbitrary filesystem, network, extension, or process access.

### 6.4 Content-addressing and immutable versions

Three immutability rules anchor the system:

1. **`SourceVersion` is immutable.** Refresh creates a new version.
2. **`DatasetSnapshot` is immutable.** Re-import or regrouping creates a new snapshot.
3. **`QueryResultSnapshot` is immutable.** A persisted result references the exact validated SQL, parameters, engine version, and result hash.

This preserves reproducibility, makes citations stable, and prevents historical research from silently changing.

### 6.5 Migration ownership, ordering, and rollback policy

- **Ownership:** `packages/persistence` owns migration files and the schema definition. `apps/api` is the sole executor of migrations — it owns the connection pool, the schema boundary, and the typed migration CLI. No other app or package may run migrations; `apps/worker` consumes the schema and never mutates it.
- **Baseline ordering:** the first migration creates the `pgvector` extension (`CREATE EXTENSION IF NOT EXISTS vector`) before any table or index migration. Subsequent migrations run in strict timestamped order. Full-text search indexes and `pgvector` HNSW/IVFFlat indexes migrate after their owning tables.
- **Forward:** `bun run migrations:up` (executed by `apps/api`) applies all pending migrations in order.
- **Rollback:** `bun run migrations:down` (executed by `apps/api`) reverts exactly one migration. A migration must be reversible or explicitly marked irreversible with a recorded reason; irreversible, data-losing migrations require an ADR.
- **Test contract:** `migrations:up && migrations:down && migrations:up` against an ephemeral PostgreSQL instance must be idempotent and leave a clean schema. This round-trip is a required CI gate (see [`docs/repository-contract.md`](./repository-contract.md)).
- **Upgrade indexing:** the text-index migration durably queues every existing
  `SourceVersion` from its stored manifest ref, tenant scope, and immutable
  content hash. A worker reconstructs the index from normalized artifacts with
  bounded retries; unavailable artifacts remain explicitly observable in
  `source_text_reindex_jobs` and never masquerade as a completed empty index.
- **Recovery policy:** forward-only is the production default. Rollback is permitted in dev and CI for reversible migrations only. No production rollback may be executed without a matching ADR for irreversible steps.
- **Executor uniqueness:** a CI/static check verifies that migration-runner imports live only in `apps/api`; any migration import in `apps/worker` or `apps/web` fails the gate.

## 7. Product event journal and SSE model

The system needs both durable progress and live UX. The contract is:

- workers emit canonical domain events into an append-only **product event journal**;
- the API exposes SSE streams as filtered projections over that journal plus current run/job state;
- clients can reconnect using an event cursor and replay missed events;
- final objects are not considered user-visible complete until terminal validation succeeds.

### 7.1 Why a journal exists

A journal solves several problems at once:

- recovery after API or worker restarts;
- replayable progress for the UI;
- auditability of ingestion and research behavior;
- easier debugging than ephemeral log-only progress;
- stable projection inputs for job detail APIs.

### 7.2 Canonical event families

**Ingestion events**

- `ingestion-requested`
- `manifest-created`
- `file-discovered`
- `file-classified`
- `file-processed`
- `file-skipped`
- `file-failed`
- `dataset-materialized`
- `embeddings-created`
- `ingestion-completed`
- `ingestion-failed`
- `ingestion-cancelled`

Exhausted stale ingestion recovery changes the job to `failed` and inserts one
sanitized `ingestion-failed` event in the same PostgreSQL transaction. The
event ID is deterministic for the job attempt, so restart/recovery replay is
idempotent; an event-insert failure rolls back the status change.

**Research events**

- `research-started`
- `plan-created`
- `step-started`
- `retrieval-completed`
- `query-validated`
- `query-completed`
- `partition-progress`
- `finding-created`
- `evidence-insufficient`
- `plan-revised`
- `citations-validated`
- `answer-streaming`
- `research-completed`
- `research-failed`
- `research-cancelled`

### 7.3 Event design constraints

Journal events must be:

- typed with Effect Schema;
- append-only;
- partitionable by workspace/project/run/job identity;
- small enough for durable storage and replay;
- linked to larger artifacts by reference;
- safe to expose in sanitized form to clients.

## 8. Ingestion architecture

Ingestion is a resumable workflow, not a single request.

### 8.1 High-level flow

1. Accept a source registration command.
2. Validate workspace ownership and registered root permissions.
3. Create the logical `Source` record, stage accepted upload bytes under `ARTIFACT_STORAGE_ROOT`, enqueue an `ingestion` `job_queue` row, and append `ingestion-requested` without storing raw source text or host paths in payloads.
4. Let workers atomically claim pending ingestion jobs with `FOR UPDATE SKIP LOCKED`; retry stale `in-progress` jobs through the existing status/attempt columns. Every claimed-worker write is fenced by the exact incremented attempt: stale workers cannot create a `SourceVersion`, append progress, or move job state after recovery gives ownership to a newer attempt.
5. Hash and classify files with bounded concurrency.
6. Route by type: document extraction, structured-data staging, or direct file indexing.
7. Build a deterministic source-version manifest after raw and normalized artifacts are written.
8. Create immutable `SourceVersion` records only after the manifest artifact ref and normalized `sha256:<hex>` content hash exist and while the creating ingestion attempt still owns its row lock; source-version failure state lives in `job_queue` plus `event_journal`, not in placeholder pending rows.
9. Create document chunks, dataset snapshots, embeddings, and retrieval metadata.
10. Persist progress to checkpoints and the event journal. Progress events lock and verify the current attempt; completion/retry/failure transitions append their corresponding terminal attempt event in the same transaction. Expected typed ownership loss is a stale-worker no-op, while infrastructure failure remains fatal to polling.

### 8.2 Ingestion design rules

- never make one model call per file;
- prefer deterministic parsing, sampling, schema inference, and batched analysis;
- allow partial success while preserving file-level error state;
- support incremental refresh using hashes, extractor version, and embedding version;
- preserve lineage from normalized artifacts back to original source files and pointers.

## 9. Research architecture

Research execution is described in detail in [research-execution-model.md](./research-execution-model.md). At the architectural level, the key rule is separation of concerns:

- **Fred** plans and coordinates;
- **Effect services** inspect, validate, and execute;
- **PostgreSQL** stores durable run state and retrieval metadata;
- **DuckDB** answers exact structured questions;
- **the journal + SSE** makes progress observable;
- **citation validation** gates final answer completion.

### 9.1 Agent vs tool split

Agents are allowed to:

- classify intent;
- choose research strategy;
- decide whether evidence is sufficient;
- interpret qualitative evidence;
- synthesize and explain results;
- identify contradictions, limitations, and follow-ups.

Agents are not allowed to:

- read arbitrary host paths;
- invent schemas or fields;
- execute arbitrary SQL or arbitrary code;
- bypass workspace authorization;
- override budgets or cancellation;
- skip citation validation.

## 10. Bounded execution and durability

All long-running execution must satisfy the same contract.

### 10.1 Durability primitives

- workflow/run/job identity;
- idempotency keys;
- append-only journal events;
- compact checkpoints for current step and progress;
- artifact references for large intermediate outputs;
- deterministic replay of completed step outputs where safe.

### 10.2 Safety limits

Bound every run by:

- maximum steps;
- maximum model calls;
- maximum tool calls;
- maximum tokens;
- maximum elapsed time;
- maximum estimated cost;
- maximum concurrent partitions;
- query time/memory/output limits;
- duplicate-action detection;
- no-progress detection.

The Fred walking-slice elapsed-time limit is end-to-end: client creation,
provider setup, registration, workflow execution, and cleanup share one absolute
deadline. Cleanup receives only the remaining budget; after expiry it receives
a fixed 10 ms emergency release cap so a hanging finalizer cannot start a fresh
workflow-sized timeout. Clients that resolve after their creation deadline are
still released through that capped path.

### 10.3 Failure handling

The architecture assumes failures are normal:

- workers can restart mid-run;
- models can time out or rate limit;
- file extraction can partially fail;
- SQL can fail validation or execution;
- citation validation can reject a final claim;
- users can cancel in-progress work.

Every workflow therefore needs an explicit terminal state model: `completed`, `failed`, `cancelled`, or `partial` where appropriate.

## 11. Observability architecture

Observability is a product feature, not only an ops concern.

Each significant unit of work should have correlated trace identity across:

- API request;
- command creation;
- worker job;
- Fred run/step;
- model call;
- retrieval request;
- SQL validation/execution;
- citation validation;
- report export.

Required signal types:

- structured logs for discrete events and failures;
- traces for causal debugging;
- metrics for throughput, latency, cost, error rate, and quality;
- projection-friendly journal events for user-facing progress.

## 12. Walking-skeleton slice

The first implementation slice should prove the architecture rather than chase breadth.

STEP-01-04 implements the research half of this slice with:

- `source_text_index`, a PostgreSQL generated-`tsvector` index keyed by immutable `SourceVersion`;
- `packages/retrieval`, which enforces workspace/project/source-version scope and bounded lexical results; phrase/proximity candidates are revalidated only as byte-for-byte contiguous source windows, preserving original coordinates, distance, order, and repeated-lexeme multiplicity, while non-positional distributed terms may use exact multi-range locators; all selected evidence is at most 1200 characters;
- `packages/research-engine`, which owns the fixed one-tool/one-model plan and citation sufficiency gates;
- `packages/fred-workflows`, pinned to `@fancyrobot/fred@2.0.0`, with one search function node, one answer-synthesizer agent, and one citation-validation node;
- `POST /research/runs` plus a durable worker job that persists answers, citations, run state, and replayable research events.

Minimum end-to-end path:

1. create a project;
2. add one text source;
3. ingest it through the worker;
4. persist a source version;
5. run one Fred workflow;
6. call one deterministic retrieval tool;
7. synthesize one answer;
8. validate one citation;
9. persist the run and stream progress via SSE.

If this slice is not working, later features are premature.

## 13. Open questions that deserve spikes, not premature abstraction

These are important, but the architecture intentionally keeps them behind replaceable adapters:

- direct Bun/Node DuckDB integration quality vs a narrow sidecar service;
- embedding provider and reranker selection;
- exact Postgres index strategies after real corpus measurements;
- whether report generation needs a dedicated rendering/export worker path;
- whether deep research needs separate worker queues or only budget classes.

## 14. What must not change without an ADR update

The following are core contracts:

- source versions and result snapshots are immutable;
- exact dataset answers come from deterministic tools, not model estimation;
- source content is untrusted and cannot change permissions or instructions;
- long-running work is durable, bounded, and cancellable;
- citations are validated before finalization;
- the API remains a typed boundary and the worker remains the durable execution boundary.

Those constraints are the foundation for every later phase.
