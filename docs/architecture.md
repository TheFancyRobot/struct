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
3. Create logical `Source` and pending `SourceVersion` records.
4. Discover files or accept uploaded artifact(s).
5. Build a deterministic manifest.
6. Hash and classify files with bounded concurrency.
7. Route by type: document extraction, structured-data staging, or direct file indexing.
8. Create document chunks, dataset snapshots, embeddings, and retrieval metadata.
9. Persist progress to checkpoints and the event journal.
10. Mark the source version complete, partial, failed, or cancelled.

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