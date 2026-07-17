# Research Execution Model

This document defines how research questions become durable, bounded, evidence-backed runs. It is the behavioral contract for the product's Fred orchestration layer, deterministic tools, checkpoints, product event journal, and SSE updates.

Related documents:

- [architecture.md](./architecture.md)
- [domain-model.md](./domain-model.md)
- [citation-and-provenance.md](./citation-and-provenance.md)
- [evaluation-strategy.md](./evaluation-strategy.md)

## 1. Goals

The research runtime must:

- answer questions across documents, datasets, directories, and code;
- separate exact computation from probabilistic synthesis;
- keep model behavior bounded, typed, and observable;
- persist enough state to cancel, retry, and resume safely;
- stream meaningful progress without exposing raw internal reasoning;
- produce only citation-backed final outputs.

## 2. Core execution rule

A research run is a **durable sequence of typed decisions and deterministic actions**.

The runtime is not allowed to behave like an unconstrained agent loop. Instead, every run must move through explicit phases, consume tracked budgets, persist operational facts, and terminate in a known state.

## 3. High-level lifecycle

The canonical lifecycle is:

```text
receive-question
    ↓
resolve-workspace/project/thread/source-scope
    ↓
load-source-version catalog
    ↓
classify-intent and choose mode budgets
    ↓
build typed research plan
    ↓
execute plan steps
    ├── retrieval
    ├── directory navigation
    ├── schema inspection
    ├── deterministic SQL
    ├── direct source reading
    ├── recursive corpus analysis
    └── mixed-source synthesis prep
    ↓
evaluate evidence sufficiency
    ├── sufficient → verify evidence
    └── insufficient → bounded plan revision
    ↓
detect contradictions and limitations
    ↓
synthesize answer/report output
    ↓
validate citations
    ↓
persist terminal artifacts and stream completion
```

Every arrow implies journal events, status transitions, and checkpoint updates.

## 4. Run modes

The product supports two research modes from day one.

### 4.1 Quick answer

Optimized for fast bounded research.

Typical characteristics:

- smaller step budget;
- smaller model/tool budget;
- less recursive decomposition;
- narrower retrieval depth;
- shorter final synthesis.

### 4.2 Deep research

Optimized for completeness while remaining bounded.

Typical characteristics:

- explicit multi-step plan;
- broader source inspection;
- more evidence sufficiency passes;
- recursive partition analysis where needed;
- richer limitations/conflict reporting;
- report-oriented output shape.

Mode changes the budgets and default plan depth, not the evidence standard.

## 5. Intent classification

Intent classification is the first model-mediated decision after the source catalog is loaded.

### 5.1 Minimum intent categories

- direct source lookup
- document semantic question
- directory navigation
- exact dataset computation
- dataset record retrieval
- dataset trend/comparison
- corpus-wide synthesis
- contradiction detection
- cross-source comparison
- codebase research
- mixed document-and-dataset research
- report generation
- follow-up question grounded in a previous run

### 5.2 Intent output contract

Intent classification must return a typed object rather than free-form advice.

```ts
interface ResearchIntent {
  category:
    | "direct-source-lookup"
    | "document-semantic-question"
    | "directory-navigation"
    | "exact-dataset-computation"
    | "dataset-record-retrieval"
    | "dataset-trend-comparison"
    | "corpus-wide-synthesis"
    | "contradiction-detection"
    | "cross-source-comparison"
    | "codebase-research"
    | "mixed-document-dataset-research"
    | "report-generation"
    | "follow-up";
  requiresExactComputation: boolean;
  requiresSourceVersionComparison: boolean;
  requiresRecursiveAnalysis: boolean;
  preferredMode: "quick" | "deep";
  confidence: number;
}
```

### 5.3 Classification constraints

- it must see the source catalog before deciding strategy;
- it cannot expand source scope beyond the caller's authorized project;
- it cannot force a tool that violates product policy;
- low-confidence classification can trigger a conservative mixed strategy, not an unbounded retry loop.

## 6. Source scope resolution

Before planning begins, the system resolves a concrete source-version scope.

Resolution rules:

- if the user selected sources, resolve them to specific latest-or-pinned versions according to UI choice;
- if the user asked a follow-up within a thread, prefer the prior run's resolved scope unless the user changed it;
- if a question depends on changed data, compare source versions explicitly rather than silently switching contexts;
- all resolved versions are persisted on the run record.

A run never operates against an ambiguous "whatever is current now" source set.

## 7. Research plan contract

The planner produces a concise inspectable plan.

```ts
interface ResearchPlan {
  objective: string;
  mode: "quick" | "deep";
  sourceScope: SourceVersionId[];
  strategy:
    | "direct-read"
    | "hybrid-retrieval"
    | "deterministic-sql"
    | "directory-analysis"
    | "recursive-corpus-analysis"
    | "mixed";
  expectedEvidence: EvidenceRequirement[];
  steps: ResearchPlanStep[];
  limits: ResearchLimits;
  revisionNumber: number;
}

interface ResearchPlanStep {
  id: string;
  kind:
    | "inspect-catalog"
    | "inspect-manifest"
    | "read-source-range"
    | "search-full-text"
    | "search-semantic"
    | "rerank-evidence"
    | "inspect-dataset-schema"
    | "validate-sql"
    | "run-read-only-sql"
    | "sample-dataset-records"
    | "recursive-partition-analysis"
    | "evaluate-evidence"
    | "synthesize-answer"
    | "validate-citations";
  goal: string;
  inputs: Record<string, unknown>;
  dependsOn: string[];
  boundedOutput: string;
}
```

Planner requirements:

- steps are explicit and typed;
- the plan stores no hidden chain-of-thought;
- limits are attached at plan creation, not inferred later;
- source scope and evidence requirements are persisted for audit and replay.

## 8. Agent roles and deterministic tools

The product prefers a small number of focused agents and many deterministic tools.

### 8.1 Recommended agent roles

| Agent | Allowed responsibilities | Not allowed |
| --- | --- | --- |
| Research planner | classify question, choose strategy, build plan, revise within limits | direct DB or filesystem access |
| SQL planner | propose SQL shape from schema metadata | execute SQL without validation |
| Corpus analyst | interpret batches/partitions of text into structured findings | compute exact counts from prose |
| Evidence critic | assess sufficiency, contradictions, unsupported claims, missing coverage | alter tool permissions or source scope |
| Answer synthesizer | produce final user-facing answer with limitations | skip citation validation |
| Report writer | generate/edit report structure grounded in findings | fabricate evidence |

### 8.2 Deterministic tool families

| Tool family | Purpose |
| --- | --- |
| Catalog inspection | list sources, versions, manifests, schema families |
| Safe reading | read document sections, file ranges, JSON pointers, query rows |
| Retrieval | full-text, vector, rerank, metadata/path filtering |
| Structured data | inspect schema, validate SQL, execute SQL, fetch rows, sample records |
| Version/provenance | get source version, compare versions, validate citations |
| Recursive analysis | create partition, load partition, persist finding, merge findings |
| Persistence/reporting | save findings, save report, load thread context |

Every tool must have:

- Effect Schema input/output contracts;
- workspace and project authorization checks;
- timeout and cancellation support;
- structured tracing;
- bounded outputs;
- typed domain failures.

## 9. Execution phases in detail

### 9.1 Phase A: start run

Actions:

1. validate request and authorization;
2. create `ResearchRun` record;
3. allocate idempotency and budget context;
4. emit `research-started` event;
5. checkpoint initial run state.

### 9.2 Phase B: catalog loading

Actions:

1. load selected project and source catalog;
2. resolve concrete source versions;
3. load manifest/schema summaries needed for planning;
4. emit source-scope and catalog journal events.

The planner should not infer source categories from the question alone if the catalog already disproves that assumption.

### 9.3 Phase C: planning

Actions:

1. classify intent;
2. choose plan strategy and budgets;
3. construct plan steps and evidence requirements;
4. persist `ResearchPlan`;
5. emit `plan-created`.

The plan must be understandable to a human reviewer without access to internal model reasoning.

### 9.4 Phase D: plan execution

The executor processes steps respecting dependencies, budgets, and retry policy.

General rules:

- deterministic steps execute through Effect services;
- agentic steps receive bounded, typed inputs;
- large outputs are stored by reference;
- every step emits `step-started` and terminal step events;
- completed step outputs become reusable evidence or artifacts for later steps.

### 9.5 Phase E: evidence sufficiency

After initial execution, the evidence critic decides whether the run can answer safely.

Required checks:

- enough evidence to answer the question;
- all relevant source categories covered;
- exact computation performed where required;
- representative examples available where requested;
- contradictory/counterevidence considered;
- valid citations can be produced;
- limitations are explicit.

Possible outcomes:

- `sufficient` → proceed;
- `insufficient-but-recoverable` → bounded plan revision;
- `insufficient-terminal` → answer with explicit limitations or fail.

### 9.6 Phase F: bounded plan revision

Revision is allowed only when:

- remaining budget permits it;
- the revision is meaningfully different from previous actions;
- it narrows a concrete evidence gap;
- it does not broaden permissions or ignore exactness requirements.

Emit `plan-revised` and increment `revisionNumber`.

### 9.7 Phase G: synthesis and validation

Actions:

1. synthesize a draft answer from evidence and findings;
2. label claims as computed fact, retrieved claim, inference, conflict, or limitation;
3. validate all attached citations against current run scope and referenced snapshots;
4. reject or downgrade unsupported claims;
5. emit `citations-validated` when successful.

### 9.8 Phase H: finalize and stream completion

Actions:

1. persist answer artifacts and findings;
2. mark run terminal state;
3. emit `research-completed`, `research-failed`, or `research-cancelled`;
4. keep the final run replayable through the journal and query APIs.

## 10. Product event journal and SSE behavior

The canonical progress record is the append-only product event journal. SSE is a projection of that durable state.

### 10.1 Event design

Each event includes:

- stream type (`research`)
- stream ID (`ResearchRunId`)
- workspace/project identity
- event type
- schema version
- timestamp/cursor
- sanitized payload
- references to large artifacts where needed

### 10.2 Research event set

Minimum events:

- `research-started`
- `plan-created`
- `step-started`
- `step-completed`
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

### 10.3 SSE projection rules

- clients subscribe by project/thread/run scope;
- events are replayable by cursor after reconnect;
- partial structured JSON is not treated as final object state;
- the UI may show streaming answer text, but final claim/citation objects become authoritative only after validation.

## 11. Budget model

Budgets are first-class execution inputs, not advisory metadata.

### 11.1 Budget dimensions

- max steps
- max model calls
- max tool calls
- max tokens in/out
- max elapsed time
- max estimated cost
- max query count
- max query execution time
- max query output rows/bytes
- max recursive partition fan-out
- max revision count

### 11.2 Budget enforcement points

Budgets must be checked:

- before plan creation;
- before each step starts;
- after each tool or model call;
- before any revision;
- before long-running SQL or partition expansion;
- before final synthesis if too little evidence remains to justify more work.

### 11.3 No-progress and duplicate-action detection

The executor should detect and stop:

- repeated identical retrievals with no new evidence;
- repeated invalid SQL repairs with no schema change;
- recursive expansion that yields no novel findings;
- cycles between critic and planner without coverage improvement.

## 12. Retrieval-oriented execution patterns

### 12.1 Direct source lookup

Use when the question names a source, section, file, or code symbol explicitly.

Plan shape:

1. inspect catalog/manifest;
2. read targeted section/range;
3. maybe broaden with local neighbor expansion;
4. answer with direct citation.

### 12.2 Document semantic question

Plan shape:

1. full-text + vector retrieval;
2. rerank and dedupe;
3. optionally expand neighbor sections;
4. critique coverage and conflicts;
5. synthesize with document citations.

### 12.3 Directory navigation

Plan shape:

1. inspect manifest;
2. filter by path/kind/metadata;
3. read selected file ranges or documents;
4. synthesize scope-aware answer.

## 13. Structured-data execution patterns

### 13.1 Exact dataset computation

Plan shape:

1. inspect dataset schema/catalog;
2. propose typed query;
3. validate referenced tables/fields;
4. validate SQL against the allowlist;
5. execute bounded query;
6. snapshot result and generate citations;
7. explain the result.

The model never computes exact aggregates manually.

### 13.2 Dataset record retrieval

Plan shape:

1. inspect fields and likely identifiers;
2. build validated query or filtered sample request;
3. fetch rows with stable record references;
4. attach row-level provenance.

### 13.3 Trend plus explanation

Plan shape:

1. exact SQL for trend/aggregate;
2. sample or cluster relevant textual fields;
3. recursive or batched qualitative analysis over those fields;
4. join computed facts with representative evidence.

## 14. Recursive decomposition workflow

Recursive decomposition is reserved for corpus-scale semantic analysis, not exact computation.

### 14.1 Entry criteria

Use it when:

- corpus size exceeds safe direct context assembly;
- qualitative interpretation is needed across many files/records;
- minority findings and contradictions matter;
- SQL or retrieval alone cannot answer the semantic part of the question.

### 14.2 Partition workflow

1. define analysis schema and question;
2. partition corpus deterministically;
3. analyze each partition with bounded parallelism;
4. emit structured findings with evidence references;
5. merge duplicates and track counterevidence;
6. recurse only if the merged set is still too large;
7. reopen original evidence before final synthesis.

### 14.3 Partition output contract

```ts
interface PartitionFinding {
  id: string;
  claim: string;
  evidenceIds: string[];
  confidence: number;
  importance: number;
  scope: {
    filesExamined: number;
    recordsExamined?: number;
    partitionsExamined: number;
  };
  supportingExamples: string[];
  counterEvidenceIds: string[];
  limitations: string[];
  tags: string[];
}
```

### 14.4 Constraints

- do not summarize summaries without carrying structure and evidence;
- do not drop minority findings just because they are rare;
- do not lose scope/coverage information between levels;
- do not create one model call per file for a 25k-file corpus.

## 15. Mixed-source research pattern

The flagship scenario combines documents, datasets, logs, and code.

Canonical mixed plan:

1. inspect project catalog and source categories;
2. identify relevant dataset snapshots;
3. run exact SQL for category/trend computation;
4. fetch representative records/log text for qualitative analysis;
5. retrieve design-document sections about mitigations;
6. search code for implementation evidence;
7. compare proposed vs implemented mitigations;
8. surface contradictions or missing evidence;
9. synthesize one answer with heterogeneous citations.

This is the product's proof scenario and should shape early tool design.

## 16. Follow-up runs

A follow-up question is not just another independent chat message.

Follow-up behavior:

- load prior run summary, resolved scope, and saved findings;
- reuse validated evidence when still relevant;
- compare against newer source versions only if the user requests or the UI changes scope;
- emit a new run with explicit linkage to the previous one.

The system should preserve thread continuity without silently inheriting stale citations.

## 17. Cancellation, retry, and resume

### 17.1 Cancellation

Cancellation must be cooperative and durable.

Requirements:

- user can cancel from the UI/API;
- worker checks cancellation at step boundaries and long-running tool checkpoints;
- journal emits `research-cancelled`;
- partial findings may be retained but must be marked incomplete.

### 17.2 Retry

Safe retries are allowed for:

- transient model/provider errors;
- retriable storage/network failures;
- resumable partition or extraction work;
- SQL repair when the schema is valid but the proposed query was invalid.

Retries must never duplicate committed side effects.

### 17.3 Resume

Resume behavior requires:

- checkpointed current step;
- artifact references for completed heavy outputs;
- deterministic step replay rules;
- idempotent event and persistence writes.

## 18. Failure taxonomy

Research failures should be typed, not reduced to opaque strings.

Useful categories:

- authorization failure
- source scope resolution failure
- retrieval failure
- schema inspection failure
- sql validation failure
- sql execution timeout/resource failure
- model provider failure
- evidence insufficiency
- citation validation failure
- cancellation
- internal invariant violation

The user-facing API should surface actionable safe summaries while logs and traces retain richer diagnostic detail.

## 19. Data that may be persisted vs must not be persisted

### 19.1 Persist

- question and run mode;
- source scope;
- plan summary and revisions;
- tool inputs/outputs in sanitized structured form;
- query text, parameters, stats, and result hashes;
- partition findings and evidence records;
- budget consumption;
- citation validation outcomes;
- terminal answer/report artifacts.

### 19.2 Do not persist

- hidden chain-of-thought;
- raw provider secrets or tokens;
- unrestricted tool transcripts that contain unrelated data;
- arbitrary full artifact dumps when references suffice.

## 20. Tests implied by this execution model

This document implies dedicated tests for:

- intent classification schema conformance;
- plan generation for each intent category;
- budget exhaustion and no-progress termination;
- query validation and exactness enforcement;
- recursive decomposition coverage retention;
- follow-up run scope inheritance;
- cancellation mid-step and resume after restart;
- citation validation before final completion;
- event journal replay to SSE projection;
- mixed-source flagship scenario.

## 21. Non-negotiable rules

The execution model is invalid if any of the following occur:

- a run answers an exact dataset question without deterministic query execution;
- a final claim is emitted without citation or explicit limitation/inference labeling;
- a run silently switches to newer source versions mid-thread;
- a model can broaden filesystem, SQL, or authorization scope;
- recursive analysis hides contradictions or minority findings;
- the UI depends on ephemeral in-memory progress that vanishes on restart.

Those rules define the product's trust contract.