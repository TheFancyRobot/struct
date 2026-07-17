# Build a Fred-Native Research Workspace for Documents, Datasets, and Directories

You are responsible for planning and building a production-quality, source-grounded research application using the **Fred AI agent framework**.

This is not intended to be a generic chatbot or a complete clone of every NotebookLM feature. The product should focus specifically on NotebookLM-style research:

- Organizing source material into projects or notebooks
- Asking questions across multiple sources
- Synthesizing findings across large corpora
- Producing answers grounded in verifiable evidence
- Navigating citations back to the exact source material
- Saving findings and producing research reports

The product must go beyond conventional document RAG by treating structured datasets and directories as first-class research sources.

The core product principle is:

> **Documents are retrieved. Datasets are queried. Directories are navigated. Large corpora are recursively analyzed.**

Do not flatten every source into undifferentiated text and send it through vector search.

The application must intelligently combine:

- Full-text retrieval
- Vector retrieval
- Metadata filtering
- Deterministic SQL
- Directory and manifest search
- Direct file inspection
- Recursive decomposition
- Multi-step research planning
- Evidence verification
- Citation-backed synthesis

The system should eventually support research across tens of thousands of files, including datasets composed of approximately 25,000 JSON files.

## 1. Operating instructions

Begin by inspecting the current repository and its instructions.

Read, at minimum:

- `AGENTS.md`
- `README.md`
- Relevant package READMEs
- Existing architecture documentation
- Existing examples
- Existing workflow, tool, checkpoint, persistence, evaluation, HTTP, and observability implementations

Follow all repository-specific instructions.

For Fred development specifically:

- Use Effect services, Layers, Schemas, Streams, scopes, schedules, and typed errors appropriately.
- Do not introduce `Effect.runPromise` inside domain or service logic.
- Keep runtime boundaries at application entry points and approved public API boundaries.
- Use Effect Schema for tool inputs, outputs, domain objects, API contracts, and persisted records whenever practical.
- Preserve existing package boundaries.
- Keep all existing examples green.
- Mock model calls in deterministic tests.
- Do not break Fred’s public API to satisfy product-local needs.
- Prefer adapters in the product before changing Fred core.
- Modify Fred itself only when the missing capability is generic, belongs in the framework, and can be independently tested and documented.

Use available repository skills, especially those covering:

- Effect
- Effect best practices
- Architecture
- SQL and persistence
- Prompt engineering
- Security
- Testing

Do not stop after producing a plan. After planning documentation is complete, begin implementing the product phase by phase.

Only stop for user input when blocked by something that cannot be resolved from the repository, official documentation, a safe default, or a reversible architectural decision.

## 2. Repository placement

Treat this as a standalone product that depends on Fred.

Do not mix application-specific research behavior into Fred core.

Preferred options, in order:

1. A separate monorepo that consumes published or workspace-linked Fred packages.
2. A standalone application workspace that links to a local Fred checkout during development.
3. If currently operating inside the Fred monorepo, create a clearly isolated flagship/reference application under an appropriate `apps/` directory.

If product development reveals reusable Fred deficiencies:

1. Document the deficiency.
2. Create a product-local adapter first.
3. Determine whether the capability is broadly useful to Fred consumers.
4. Only then implement a generic Fred enhancement with independent tests, documentation, migration notes, and examples.

## 3. Product objective

Build a research workspace in which a user can:

1. Create a research project or notebook.
2. Add individual files.
3. Add an entire local directory recursively.
4. Add large structured datasets.
5. Inspect what the system discovered during ingestion.
6. Ask questions across all or selected sources.
7. Receive answers backed by exact, navigable citations.
8. Review how quantitative results were calculated.
9. Save findings.
10. Generate an evidence-backed Markdown research report.

The system must support questions such as:

- “What are the main design decisions described across these documents?”
- “Where do these sources disagree?”
- “How many records have a failed status?”
- “Which error categories increased most from May to June?”
- “What themes appear in the free-text failure descriptions?”
- “Find representative examples of each theme.”
- “Do the design documents describe mitigations for the most common failures?”
- “Which proposed mitigations appear to have been implemented in the source code?”
- “Summarize this entire directory without overlooking important minority findings.”
- “What changed after these files were refreshed?”

The application should clearly distinguish exact computation from probabilistic synthesis.

## 4. Explicit non-goals

Do not prioritize or build these before the research foundation is complete:

- Podcasts
- Audio overviews
- Text-to-speech
- Flashcards
- Quizzes
- Entertainment-oriented content generation
- Generic autonomous web browsing
- Image generation
- Social features
- A mobile application
- A broad plugin marketplace
- Arbitrary model-generated code execution
- A full business-intelligence dashboard platform

Some adjacent capabilities may appear in the post-v1 roadmap, but they must not distract from reliable research.

## 5. Required planning deliverables

Before major implementation, create and maintain:

- `docs/product-brief.md`
- `docs/architecture.md`
- `docs/domain-model.md`
- `docs/research-execution-model.md`
- `docs/citation-and-provenance.md`
- `docs/security-model.md`
- `docs/evaluation-strategy.md`
- `docs/roadmap.md`
- `docs/implementation-plan.md`
- Architecture decision records under `docs/adr/`

The implementation plan must:

- Divide work into independently testable vertical slices.
- Identify dependencies between phases.
- Define acceptance criteria for each phase.
- Identify risks and unknowns.
- Include data migrations.
- Include test and evaluation work in every phase.
- Include documentation work in every phase.
- Distinguish v1 requirements from post-v1 work.
- Be updated as implementation discoveries invalidate assumptions.

Do not write an enormous speculative design and then implement nothing. Create enough architecture to protect the critical boundaries, then validate them through a narrow end-to-end slice.

## 6. Preferred technical direction

Remain TypeScript-first.

Use this as the default architecture unless repository inspection or a technical spike demonstrates a materially better alternative:

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

Suggested responsibilities:

### `apps/web`

- Research project interface
- Source management
- Directory explorer
- Dataset schema explorer
- Research conversation
- Citation and evidence inspector
- Saved findings
- Report editor and export
- Streaming job and research progress

Use SolidJS + Vite 8 + Solid Router (DEC-0014); no SSR. Communicate with `apps/api` over HTTP and SSE only.

### `apps/api`

- Typed application API
- Authentication boundary
- Project and source operations
- Research-run creation
- Streaming research events
- Saved findings and reports
- Citation retrieval
- Dataset query history
- Fred workflow exposure

Prefer `@fancyrobot/fred-http` and Effect HTTP abstractions where they fit naturally.

### `apps/worker`

- Directory scanning
- File extraction
- Dataset profiling
- Embedding jobs
- Recursive research execution
- Incremental refresh
- Materialized result generation
- Retry and resume processing

### `packages/domain`

Domain types, schemas, invariants, identifiers, and errors.

### `packages/persistence`

Application state, repositories, migrations, transactions, and storage implementations.

### `packages/source-storage`

Original files, extracted artifacts, generated manifests, and content-addressed objects.

### `packages/ingestion`

Source classification, manifests, extraction routing, incremental refresh, and ingestion workflows.

### `packages/document-processing`

Document parsers, normalization, sections, pages, chunks, and document-specific provenance.

### `packages/retrieval`

Full-text search, vector search, reranking, filtering, parent-child retrieval, and context construction.

### `packages/data-engine`

DuckDB, Parquet, schema profiling, read-only SQL, query validation, query execution, and deterministic result provenance.

### `packages/research-engine`

Research plans, evidence sufficiency, recursive decomposition, finding aggregation, contradiction handling, citation verification, and answer synthesis.

### `packages/fred-workflows`

Fred agents, tools, graph definitions, prompts, typed workflow inputs and outputs, and application-specific workflow composition.

### `packages/evaluation`

Deterministic datasets, expected answers, model-scored evaluations where appropriate, citation validation, regression tests, and benchmark harnesses.

## 7. Infrastructure defaults

Use stable interfaces so implementations can evolve.

Recommended defaults:

- **Runtime:** Bun
- **Application language:** TypeScript
- **Effects and dependency injection:** Effect
- **Agent orchestration:** Fred
- **Application database:** PostgreSQL
- **Vector storage:** pgvector initially
- **Full-text search:** PostgreSQL full-text search initially
- **Structured query engine:** DuckDB
- **Structured storage:** Parquet where beneficial
- **Original artifact storage:** local filesystem in development, S3-compatible abstraction for production
- **Development environment:** Docker Compose for required services
- **Streaming:** Server-Sent Events unless bidirectional communication is demonstrably needed
- **Telemetry:** OpenTelemetry-compatible traces, metrics, and structured logs

Do not add Kafka, Kubernetes, a dedicated vector database, or a distributed workflow engine during the initial phases unless a measured requirement justifies it.

If the current DuckDB integration available to TypeScript/Bun is not sufficiently stable, perform a focused spike comparing:

1. Direct official Node API integration
2. A narrow local DuckDB service
3. A small isolated data worker

Do not replace DuckDB with LLM-based analysis merely to avoid an integration inconvenience.

## 8. Core domain model

Define strongly typed identifiers and Effect Schemas for the major entities.

At minimum, model:

### Workspace

An ownership and isolation boundary.

### ResearchProject

A notebook-like collection of sources, threads, findings, and reports.

### Source

A logical user-facing source.

Source kinds should include:

- Document
- Structured dataset
- Directory
- Individual file
- Web snapshot, after v1
- Database connection, after v1
- Git repository, after v1

### SourceVersion

An immutable snapshot of a source at a point in time.

Research results and citations must reference source versions, not mutable source identities alone.

### FileEntry

A file within a directory source.

Include:

- Relative path
- Content hash
- Byte size
- MIME type
- Modification metadata
- Extraction status
- Parser
- Source version
- Parent directory
- Ignore status
- Error state

### DirectoryManifest

The versioned inventory of a directory source.

### Document

Normalized extracted document content.

### DocumentSection

A semantic or structural section.

### DocumentChunk

A retrieval unit that retains parent and location information.

### Dataset

A logical structured collection.

### DatasetSnapshot

A versioned dataset state.

### DatasetTable

A queryable table or view.

### DatasetField

Inferred field metadata, type distribution, nullability, semantic description, and conflicts.

### SchemaFamily

A group of related structured files with compatible or meaningfully similar schemas.

### IngestionJob

A resumable source-processing job.

### ResearchThread

A user-visible conversation within a project.

### ResearchRun

One execution of a question or research task.

### ResearchPlan

A typed sequence or graph of proposed operations.

### ResearchStep

A persisted unit of research execution.

Persist useful execution facts, but never expose or persist private model chain-of-thought. Store concise plans, tool requests, results, decisions, and evidence assessments.

### Evidence

A normalized reference to source-backed information.

### Citation

A user-facing evidence reference that can be opened and verified.

### ResearchFinding

A claim with supporting evidence, scope, confidence, and limitations.

### SavedFinding

A user-curated finding.

### ResearchReport

A generated, editable report whose claims retain citations.

### DatasetQuery

The proposed, validated, and executed deterministic query.

### QueryResultSnapshot

A bounded, reproducible result and its provenance.

## 9. Citation and provenance model

Treat citations as a foundational domain capability, not presentation metadata added at the end.

Support citation variants similar to:

```typescript
type Citation =
  | DocumentCitation
  | FileCitation
  | JsonCitation
  | DatasetCitation
  | SqlCitation
  | DirectoryCitation
  | CodeCitation;
```

### Document citation

Include:

- Source ID
- Source version ID
- Document ID
- Page where available
- Section ID
- Block or chunk ID
- Character offsets where useful
- Extracted text hash

### File citation

Include:

- Source ID
- Source version ID
- Relative path
- Content hash
- Line range or byte range

### JSON citation

Include:

- Source ID
- Source version ID
- Relative path
- Content hash
- RFC 6901 JSON Pointer
- Optional record identifier

### Dataset citation

Include:

- Dataset ID
- Dataset snapshot ID
- Table or view
- Stable row identifiers
- Relevant columns
- Query execution ID

Never use unstable physical row numbers as the only identity.

### SQL citation

Include:

- Dataset snapshot IDs
- Validated SQL
- Bound parameters
- Execution timestamp
- Result hash
- Row count
- Truncation state
- Engine version where relevant

### Directory citation

Include:

- Directory source ID
- Manifest version
- Relative path or subtree
- Included file hashes
- Scope summary

### Code citation

Include:

- Repository or source version
- Relative path
- Commit hash where available
- Line range

Every final answer claim must either:

- Have supporting citations
- Be clearly labeled as an inference
- Be clearly labeled as a limitation or hypothesis
- Be general conversational framing that does not require evidence

Add automated citation validation that checks:

- Referenced source versions exist.
- Referenced files and rows exist.
- Page, line, offset, or pointer locations are valid.
- Quoted text matches the cited source.
- SQL citations correspond to the result being discussed.
- Citations are not silently carried forward after source refresh invalidates them.

## 10. Source ingestion

Implement ingestion as resumable, observable workflows.

### Directory ingestion

When adding a directory:

1. Validate that the requested root is within the allowed sandbox.
2. Walk the directory recursively.
3. Respect configurable ignore files and patterns.
4. Ignore `.git`, dependency directories, generated files, and binary noise by default.
5. Do not follow symlinks outside the root.
6. Produce a manifest before expensive processing.
7. Hash content using bounded concurrency.
8. Classify files by format and purpose.
9. Detect related structured file groups.
10. Schedule extraction and indexing jobs.
11. Persist progress and errors.
12. Allow partial success.
13. Support cancellation.
14. Resume after restart.
15. Incrementally refresh only changed, added, or deleted files.

Do not make one model call per file.

Use deterministic inspection, sampling, schema inference, batched processing, and hierarchical summaries.

### Initial supported formats

Support these by v1:

#### Documents and text

- PDF with embedded text
- Markdown
- Plain text
- HTML files
- Source code as text
- DOCX if a reliable extraction path is available

OCR-heavy scanned PDFs may be deferred, but ingestion must identify and report them clearly.

#### Structured data

- JSON
- JSONL or NDJSON
- CSV
- Parquet
- SQLite database files, if safely supportable by v1

### Structured-file grouping

For large JSON directories:

- Sample schemas deterministically.
- Infer schema families.
- Detect optional fields and type conflicts.
- Preserve nested structures.
- Identify likely record IDs.
- Identify likely timestamps.
- Identify categorical fields.
- Identify natural-language text fields.
- Track which files contributed to each inferred type.
- Allow users to override schema-family grouping.
- Import compatible groups into DuckDB.
- Compact large sets of small files into Parquet when beneficial.
- Preserve lineage back to the original file and JSON pointer.

Never lose the ability to trace a normalized record to its original source.

### Incremental refresh

Use hashes and manifests to detect:

- New files
- Changed files
- Deleted files
- Renamed files where inferable
- Schema changes
- Extractor-version changes
- Embedding-model changes

Only recompute affected artifacts.

Source refreshes must create new immutable versions. Existing research runs retain their original source-version references.

## 11. Retrieval architecture

Implement hybrid retrieval without assuming vector similarity is sufficient.

Support:

- PostgreSQL full-text search
- Vector search
- Metadata filters
- File-path filters
- Source selection
- Source-version selection
- Dataset-field filters
- Parent-child retrieval
- Neighbor expansion
- Reranking
- Deduplication
- Diversity selection
- Context budgeting

Every retrieved unit must retain enough provenance to construct a valid citation.

Develop retrieval evaluations covering:

- Exact keyword lookup
- Paraphrased semantic lookup
- Rare but important evidence
- Multiple relevant documents
- Conflicting sources
- Versioned sources
- Similar but incorrect distractors
- Directory path questions
- Code symbol questions
- JSON-field questions

## 12. Structured-data research

Structured datasets must be queried through deterministic tools.

The LLM may:

- Inspect schemas
- Interpret user language
- Propose SQL
- Repair failed SQL
- Explain results
- Select representative records
- Combine quantitative and qualitative findings

The LLM must not:

- Estimate exact counts by reading samples
- Calculate aggregates from recursively summarized prose
- Claim a complete filter result from semantic search
- Invent schema fields
- Execute arbitrary code
- Run unrestricted SQL
- Modify imported datasets

### SQL workflow

Implement a safe workflow:

1. Inspect the relevant dataset catalog.
2. Identify candidate tables and fields.
3. Generate a typed query proposal.
4. Validate referenced tables and fields.
5. Parse and validate the SQL.
6. Enforce read-only operations.
7. Apply execution limits.
8. Run the query.
9. Inspect failures or suspicious results.
10. Optionally repair the query.
11. Persist the query and result snapshot.
12. Generate citations.
13. Explain the result in user language.

Restrict SQL to an allowlisted read-only subset.

Disallow:

- DDL
- DML
- Extension installation
- Network access
- Unapproved filesystem access
- Process execution
- Unsafe pragmas
- Attaching arbitrary databases
- Unbounded result materialization

Apply:

- Timeouts
- Memory limits
- Scan limits where feasible
- Output-row limits
- Output-byte limits
- Cancellation
- Query concurrency limits

Large results should be summarized deterministically before model use.

## 13. Research execution model

Use Fred as the research orchestration layer.

Implement a typed Fred graph approximately equivalent to:

```text
receive-question
    ↓
load-project-and-source-catalog
    ↓
classify-research-intent
    ↓
build-research-plan
    ↓
execute-plan
    ├── document-retrieval
    ├── directory-navigation
    ├── schema-inspection
    ├── deterministic-sql
    ├── direct-source-reading
    ├── recursive-corpus-analysis
    └── hybrid-analysis
    ↓
evaluate-evidence-sufficiency
    ├── sufficient → verify-evidence
    └── insufficient → revise-plan and continue
    ↓
detect-conflicts-and-limitations
    ↓
synthesize-answer
    ↓
validate-citations
    ↓
persist-run-and-stream-result
```

Use typed input and output schemas for every agent and workflow boundary.

Do not depend on natural-language parsing when a structured result can be required.

### Research-intent categories

At minimum:

- Direct source lookup
- Document semantic question
- Directory navigation
- Exact dataset computation
- Dataset record retrieval
- Dataset trend or comparison
- Corpus-wide synthesis
- Contradiction detection
- Cross-source comparison
- Codebase research
- Mixed document-and-dataset research
- Report generation
- Follow-up question grounded in a previous run

### Research plan

A research plan should contain structured steps such as:

```typescript
interface ResearchPlan {
  objective: string;
  sourceScope: SourceVersionId[];
  strategy: ResearchStrategy;
  steps: ResearchPlanStep[];
  expectedEvidence: EvidenceRequirement[];
  limits: ResearchLimits;
}
```

Plans should be concise, inspectable, and safe to persist. Do not request or store hidden chain-of-thought.

### Evidence sufficiency

The system should determine whether it has:

- Enough evidence to answer
- Evidence from all relevant source categories
- Exact computation where required
- Representative examples where requested
- Counterevidence or contradictions
- Adequate coverage of a large corpus
- Valid citations
- Known limitations

A research run may revise its plan within bounded limits.

Prevent unbounded agent loops through:

- Maximum steps
- Maximum model calls
- Maximum tool calls
- Maximum tokens
- Maximum elapsed time
- Maximum estimated cost
- Cancellation
- Duplicate-action detection
- No-progress detection

## 14. Recursive decomposition

Implement recursive decomposition as a reusable Fred workflow.

Use it for corpus-wide semantic research, not exact computation.

The workflow should:

1. Define the analysis question and evidence schema.
2. Partition the corpus deterministically.
3. Analyze partitions with bounded parallelism.
4. Produce structured findings rather than prose-only summaries.
5. Preserve evidence references at every level.
6. Merge duplicate or overlapping findings.
7. Retain minority and contradictory findings.
8. Track coverage.
9. Recursively synthesize findings when the intermediate set remains too large.
10. Verify the final claims against original evidence.

A partition result should resemble:

```typescript
interface ResearchFinding {
  id: string;
  claim: string;
  evidence: EvidenceReference[];
  confidence: number;
  importance: number;
  scope: {
    filesExamined: number;
    recordsExamined?: number;
    partitionsExamined: number;
  };
  supportingExamples: EvidenceReference[];
  counterEvidence: EvidenceReference[];
  limitations: string[];
  tags: string[];
}
```

Avoid “summary of summaries” degradation.

Higher levels must receive:

- Structured claims
- Supporting evidence IDs
- Scope and coverage
- Counterexamples
- Confidence
- Limitations

The final synthesis must be able to reopen original evidence before asserting a claim.

For a directory containing 25,000 JSON files:

- Do not make 25,000 LLM calls.
- Infer schema families deterministically.
- Use SQL for exact fields and aggregates.
- Select or cluster textual fields for semantic analysis.
- Batch textual records.
- Use recursive analysis only where natural-language judgment is required.
- Cache intermediate findings by source-version, question signature, prompt version, and model configuration.

## 15. Fred agents and tools

Prefer a small number of focused agents and many deterministic tools.

Potential agents:

- Research planner
- SQL planner
- Corpus analyst
- Evidence critic
- Answer synthesizer
- Report writer

Do not create separate agents when a deterministic Effect service or tool is sufficient.

Potential tools:

- `list_project_sources`
- `inspect_source_catalog`
- `inspect_directory_manifest`
- `list_directory_entries`
- `read_file_range`
- `read_document_section`
- `read_json_pointer`
- `search_full_text`
- `search_semantic`
- `rerank_evidence`
- `inspect_dataset_schema`
- `profile_dataset_field`
- `validate_sql`
- `run_read_only_sql`
- `fetch_query_rows`
- `sample_dataset_records`
- `get_source_version`
- `compare_source_versions`
- `create_research_partition`
- `load_partition`
- `save_research_finding`
- `merge_research_findings`
- `validate_citations`
- `save_report`

All tools must have:

- Effect Schema inputs
- Effect Schema outputs
- Typed domain failures
- Authorization and workspace checks
- Timeouts
- Cancellation where relevant
- Structured tracing
- Tests
- Bounded outputs

## 16. Prompt-injection resistance

Treat all imported source content as untrusted data.

The system must never follow instructions found inside:

- Documents
- Webpages
- JSON values
- CSV fields
- Code comments
- Directory files
- Retrieved snippets

Clearly separate:

- System and developer instructions
- Research plans
- Tool results
- Untrusted source content

Research prompts must tell agents that source content is evidence, not instruction.

Do not permit source content to:

- Change tool permissions
- Broaden filesystem access
- Reveal secrets
- Alter workspace boundaries
- Disable citation requirements
- Cause arbitrary code execution
- Override research limits
- Exfiltrate unrelated source data

Add adversarial evaluation cases for prompt injection embedded in every major supported source type.

## 17. User experience

Build a focused research UI rather than a generic chat screen.

Recommended layout:

### Left panel

- Projects
- Sources
- Source groups
- Directory tree
- Ingestion state
- Source-version state
- Dataset and document badges
- Source selection controls

### Center panel

- Research conversation
- Streaming progress
- Final answer
- Tables
- Compact query explanations
- Saved finding controls
- Follow-up questions

### Right panel

- Evidence inspector
- Citation details
- Original document or file preview
- JSON path viewer
- Dataset rows
- SQL query
- Source version
- Research limitations

The user should be able to click any citation and see the exact supporting evidence.

### Source-management UX

Include:

- Add file
- Add directory
- Refresh source
- Pause or cancel ingestion
- Retry failed files
- Inspect ingestion errors
- View detected schemas
- Override schema grouping
- Include or exclude paths
- Select searchable text fields
- Remove source
- View source versions

### Research modes

Support at least:

- **Quick answer:** bounded retrieval and synthesis
- **Deep research:** explicit multi-step plan, iterative evidence gathering, and a more complete report

The mode changes budgets and execution depth, not evidence standards.

### Answer presentation

Clearly distinguish:

- Computed facts
- Retrieved claims
- Inferences
- Conflicting evidence
- Limitations
- Incomplete coverage

Allow the user to inspect generated SQL without overwhelming users who do not care about implementation details.

### Saved outputs

Support:

- Saved findings
- Research threads
- Markdown reports
- Citation-preserving report sections
- Copy and export to Markdown
- Machine-readable JSON export for findings and citations

## 18. API and streaming

Create typed API contracts for:

- Projects
- Sources
- Uploads
- Directory registration
- Source refresh
- Ingestion jobs
- Source catalogs
- Dataset schemas
- Research threads
- Research runs
- Research events
- Findings
- Reports
- Citations
- Query details

Use SSE for long-running ingestion and research updates unless a stronger need for WebSockets is demonstrated.

Useful research events include:

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

Do not stream unvalidated structured JSON fragments as finalized objects.

## 19. Persistence and durability

Research and ingestion must survive process restarts.

Persist:

- Workflow identity
- Source version
- Current step
- Completed steps
- Tool-result references
- Partition status
- Retry count
- Error information
- Model and prompt versions
- Research budgets consumed
- Generated findings
- Citation state

Large tool outputs should be stored by reference, not embedded wholesale in workflow checkpoints.

Use idempotency keys for:

- Ingestion requests
- Source refresh
- Embedding jobs
- Research partition execution
- Query execution where safe
- Report generation

Ensure resumed workflows do not duplicate side effects.

## 20. Model-provider strategy

Remain provider-agnostic through Fred.

Support configuration for:

- Hosted models
- OpenAI-compatible local endpoints
- Distinct models for planning, extraction, reranking, and synthesis
- Embedding providers
- Local embedding models
- Per-project defaults after v1

The core product must not require one specific hosted provider.

Use model capabilities deliberately:

- Cheap model for classification where reliable
- Strong model for complex planning
- Deterministic SQL engine for computation
- Embedding model for candidate retrieval
- Optional reranker for precision
- Strong synthesis model for final reports

Record the model, prompt version, and relevant generation settings for reproducibility.

Do not persist hidden reasoning.

## 21. Security model

Implement and document:

- Workspace isolation
- Project authorization
- Source authorization
- Filesystem sandboxing
- Symlink protections
- Path traversal protections
- File-size limits
- Archive expansion limits
- MIME verification
- Malicious file handling
- Read-only dataset execution
- Query timeouts
- Resource quotas
- Secret management
- API authentication
- Rate limiting
- Audit events
- Prompt-injection resistance
- Safe error sanitization
- Content-retention controls

Directory roots must be explicitly registered. Tools must never read arbitrary host paths supplied by a model.

Do not expose:

- Environment variables
- Provider keys
- Host filesystem paths outside registered roots
- Database credentials
- Internal stack traces
- Data from another workspace

## 22. Observability

Add structured observability for:

### Ingestion

- Files discovered
- Files processed
- Files skipped
- Files failed
- Bytes processed
- Schema families
- Records imported
- Chunks created
- Embeddings created
- Incremental refresh savings
- Throughput
- Queue depth

### Research

- Research strategy
- Plan steps
- Tool calls
- Model calls
- Tokens
- Estimated cost
- Query duration
- Retrieval duration
- Evidence count
- Citation count
- Citation validation failures
- Recursive partitions
- Cache hits
- Answer latency
- Cancellation and timeout reason

### Quality

- Retrieval precision
- Retrieval recall
- Citation precision
- Citation completeness
- SQL execution success
- SQL repair rate
- Exact-answer accuracy
- Unsupported-claim rate
- Corpus coverage
- Prompt-injection resistance

Use trace correlation across API, worker, Fred workflow, model, tool, query, and citation activity.

## 23. Testing strategy

Every phase must include tests.

### Unit tests

Cover:

- Domain invariants
- Schema decoding
- Manifest generation
- Path safety
- File classification
- Schema inference
- SQL validation
- Citation creation
- Citation validation
- Partitioning
- Finding merging
- Budget enforcement
- Incremental refresh decisions

### Integration tests

Use real local infrastructure where meaningful:

- PostgreSQL
- pgvector
- DuckDB
- Filesystem sandbox
- Fred workflows
- API endpoints
- Worker execution
- Checkpoint and resume
- SSE event lifecycle

Mock model providers while testing deterministic workflow behavior.

### End-to-end tests

Cover:

1. Create a project.
2. Add documents and a directory.
3. Complete ingestion.
4. Inspect schemas.
5. Ask an exact dataset question.
6. Ask a semantic document question.
7. Ask a mixed question.
8. Open citations.
9. Refresh changed files.
10. Verify old runs retain old source versions.
11. Ask the question again against the new version.
12. Export a report.

### Failure tests

Cover:

- Worker interruption
- Process restart
- Partial ingestion
- Corrupted files
- Schema conflicts
- SQL timeout
- Invalid generated SQL
- Model timeout
- Provider rate limit
- Embedding failure
- Citation mismatch
- Source deleted during processing
- User cancellation
- Prompt injection
- Symlink traversal
- Oversized output

## 24. Evaluation corpus

Create a reproducible test corpus generator.

It should generate:

- Approximately 25,000 JSON files
- Multiple schema families
- Optional fields
- Type conflicts
- Nested records
- Known categorical distributions
- Known time trends
- Duplicate records
- Deleted and changed records
- Free-text descriptions with known themes
- Rare but important findings
- Deliberate contradictions
- Prompt-injection strings
- Associated Markdown and PDF design documents
- Associated source-code files
- Ground-truth answers

Include evaluation questions for:

### Exact computation

- Counts
- Percentages
- Filters
- Grouping
- Sorting
- Joins
- Date comparisons
- Distinct values
- Null handling

### Semantic research

- Themes
- Similar incidents
- Representative examples
- Minority patterns
- Contradictions
- Mitigations

### Mixed research

- Quantitative trend plus qualitative explanation
- Dataset failures plus design-document mitigations
- Proposed mitigation plus code implementation status
- Directory changes plus outcome changes

### Provenance

- Correct file
- Correct page
- Correct JSON pointer
- Correct row identity
- Correct SQL
- Correct source version

Do not use only model-as-judge evaluation. Use deterministic assertions wherever a ground truth exists.

## 25. Performance principles

Do not optimize blindly, but design around the intended scale.

Critical rules:

- No model call per file during ordinary ingestion.
- No embedding of every structured scalar.
- No loading entire large datasets into model context.
- No repeated parsing of unchanged files.
- No recursive summarization for exact counts.
- No unbounded SQL results.
- No unbounded workflow loops.
- No duplicate expensive work after resume.

Benchmark:

- Scanning 25,000 files
- Hashing and manifest creation
- JSON schema inference
- Dataset import
- Incremental refresh with a small change set
- Full-text retrieval
- Vector retrieval
- SQL execution
- Recursive analysis
- Citation opening

Document benchmark hardware and corpus characteristics rather than presenting machine-specific results as universal guarantees.

## 26. Delivery phases

Adjust exact phase boundaries after repository inspection, but preserve the vertical-slice progression.

### Phase 0: Discovery and architecture

Deliver:

- Repository audit
- Product brief
- Architecture
- Domain model
- Threat model
- ADRs
- Technology spikes
- Implementation plan
- Evaluation corpus specification

Resolve:

- Product repository placement
- Fred integration boundary
- PostgreSQL and pgvector approach
- DuckDB integration
- Object-storage interface
- Frontend stack
- Worker execution model
- Checkpoint storage

### Phase 1: Walking skeleton

Deliver an end-to-end thin slice:

- Project creation
- One text source
- Basic ingestion
- One Fred research workflow
- One deterministic retrieval tool
- Streaming response
- One valid citation
- Minimal UI
- Persistence
- Tests

The purpose is to validate boundaries, not feature completeness.

### Phase 2: Document research

Deliver:

- PDF, Markdown, text, and HTML ingestion
- Document sections and chunks
- Full-text search
- Vector search
- Hybrid retrieval
- Reranking interface
- Source selection
- Citation opening
- Multi-document synthesis
- Saved findings

### Phase 3: Directory ingestion

Deliver:

- Registered directory roots
- Recursive manifests
- Ignore rules
- Path security
- Progress
- Retry
- Cancellation
- Checkpoint and resume
- Incremental refresh
- Directory browser
- Source versioning

### Phase 4: Structured datasets

Deliver:

- JSON
- JSONL
- CSV
- Parquet
- Schema-family detection
- DuckDB import
- Schema explorer
- Read-only SQL
- Query validation
- Query provenance
- Dataset citations
- Exact-answer evaluation

### Phase 5: Research planner

Deliver:

- Typed intent classification
- Source catalog inspection
- Typed research plans
- Multi-step execution
- Evidence sufficiency
- Plan revision
- Budget enforcement
- Research trace UI
- Conflict and limitation reporting

### Phase 6: Recursive decomposition

Deliver:

- Corpus partitioning
- Bounded parallel analysis
- Structured findings
- Recursive merging
- Coverage tracking
- Minority finding retention
- Counterevidence
- Cache and resume
- Original-evidence verification

### Phase 7: Hybrid research

Deliver:

- Combined document and dataset questions
- SQL plus semantic retrieval
- Representative record selection
- Cross-source comparison
- Contradiction detection
- Quantitative and qualitative synthesis
- Full citation validation

### Phase 8: Research reports

Deliver:

- Saved findings
- Report generation
- Editable Markdown
- Citation-preserving sections
- Export
- Regeneration of selected sections
- Source-version awareness

### Phase 9: v1 hardening

Deliver:

- Security review
- Prompt-injection suite
- Performance benchmarks
- Observability
- Backup and migration documentation
- Installation documentation
- Provider configuration
- Error-recovery UX
- Accessibility pass
- Full evaluation report
- Release checklist

## 27. v1.0 acceptance criteria

The product reaches v1.0 when all of the following are true:

1. A user can create a research project.
2. A user can add individual supported files.
3. A user can add a local directory recursively.
4. The system can ingest a representative directory containing approximately 25,000 JSON files without one model call per file.
5. Ingestion is resumable after interruption.
6. Incremental refresh processes only changed source material.
7. Structured data is queryable through safe, read-only SQL.
8. Exact questions produce deterministically correct results on the evaluation corpus.
9. Document questions use hybrid retrieval.
10. Large semantic questions can use recursive decomposition.
11. Mixed questions can combine SQL, retrieval, and synthesis.
12. Answers provide navigable citations.
13. JSON citations resolve to the correct file and JSON pointer.
14. Dataset citations resolve to stable records, columns, query, and source snapshot.
15. Document citations resolve to the relevant page or section.
16. Research runs preserve source-version provenance.
17. The system reports conflicting evidence and limitations.
18. Research runs can be cancelled.
19. All workflows have bounded resource use.
20. Prompt-injection tests pass.
21. Filesystem sandbox tests pass.
22. Existing Fred tests and examples remain green if Fred was modified.
23. Product unit, integration, end-to-end, security, and evaluation suites pass.
24. The application can export a citation-backed Markdown report.
25. Setup and architecture documentation are complete.

## 28. Post-v1 roadmap

Plan beyond v1.0 in detail, but do not compromise v1 reliability to implement it.

### v1.1: Research usability

- Research templates
- Comparison mode
- Timeline extraction
- Claim and evidence tables
- Better query explanations
- Source tagging and grouping
- User-defined dataset semantics
- Better schema overrides
- Basic charts derived from deterministic query results
- Report templates
- Improved local-model support

### v1.2: Additional sources

- Webpage snapshots
- Sitemap ingestion
- Git repositories
- Git history and branch-aware citations
- S3-compatible buckets
- PostgreSQL read-only connections
- Additional SQL databases through safe adapters
- ZIP and archive ingestion with strict expansion limits
- OCR for scanned documents
- Image and diagram understanding with provenance

### v1.3: Continuous research

- Watched directories
- Scheduled source refresh
- Change summaries
- Research alerts
- Saved-query reruns
- Finding invalidation when evidence changes
- Version comparisons
- Dataset drift detection
- Schema drift notifications

### v1.4: Collaboration

- Multi-user workspaces
- Role-based access
- Shared projects
- Comments
- Finding review
- Report approval
- Project-level model policies
- Audit history
- Enterprise identity integration

### v1.5: Advanced research

- Entity extraction and entity resolution
- Evidence graphs
- Temporal reasoning
- Claim deduplication across projects
- Hypothesis tracking
- Contradiction matrices
- Research gap detection
- Suggested follow-up questions
- User-controlled autonomous research plans
- Reusable research workflows
- Domain-specific research packs

### v2.0: Scaled research platform

- Distributed workers
- Remote object storage
- Multi-node ingestion
- Larger-than-local DuckDB execution strategies
- Federated data sources
- Tenant quotas
- Policy-based model routing
- Encryption-key management
- Plugin SDK
- Custom parser SDK
- Custom research tool SDK
- Custom citation types
- Deployment profiles for local, team, and enterprise use
- Administrative observability
- Cost and capacity controls
- Reproducible research-run bundles

Podcasts and entertainment-oriented content remain outside the roadmap unless product requirements explicitly change.

## 29. Implementation behavior

Work in small, reviewable increments.

For each phase:

1. Restate the phase goal.
2. Inspect relevant existing code.
3. Update planning documentation.
4. Implement the smallest coherent vertical slice.
5. Add tests.
6. Run targeted tests.
7. Run the full relevant suite.
8. Run build and type checks.
9. Update user and architecture documentation.
10. Record remaining risks and next steps.
11. Commit changes intentionally if repository permissions and workflow permit.

Do not leave large collections of unimplemented interfaces with no executable path.

Do not claim success without running the relevant checks.

When a dependency or architecture assumption fails:

- Explain the observed evidence.
- Update the ADR.
- Choose the smallest reversible correction.
- Continue implementation.

Prefer complete, tested vertical behavior over broad scaffolding.

## 30. Initial demonstration scenario

Use the following demonstration to guide the architecture:

A project contains:

- Approximately 25,000 JSON call records
- Several Markdown design documents
- Several PDF specifications
- Application logs
- A data dictionary
- A source-code directory

The user asks:

> Which failure categories increased most during the last quarter, what recurring explanations appear in the associated logs, and do the design documents describe mitigations for them? For each mitigation, determine whether the source code contains evidence that it was implemented.

The application should:

1. Inspect the available source catalog.
2. Identify relevant structured datasets.
3. Use SQL to calculate exact changes by failure category.
4. Select relevant records and associated logs.
5. Analyze free-text descriptions using bounded recursive decomposition.
6. Retrieve design-document sections describing mitigations.
7. Search source code for implementation evidence.
8. Distinguish proposed, implemented, partially implemented, and unsupported mitigations.
9. Identify contradictions and missing evidence.
10. Produce one synthesized answer.
11. Cite exact SQL, rows, JSON paths, log lines, document pages, and code lines.
12. Allow every citation to be opened in the UI.
13. Save the answer as an editable research report.

This scenario is the primary product proof.

## 31. Final direction

Build a trustworthy research system, not a chatbot that happens to accept files.

Optimize for:

- Correctness
- Reproducibility
- Evidence
- Deterministic computation
- Source provenance
- Incremental processing
- Durable workflows
- Bounded agent behavior
- Clear failure reporting
- User control

The final product should be describable as:

> A Fred-powered research workspace that investigates documents, structured datasets, and entire directories using semantic retrieval, deterministic computation, recursive analysis, and verifiable evidence.

Begin with the repository audit and planning documents, then proceed directly into the Phase 1 walking skeleton.
