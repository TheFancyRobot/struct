# Domain Model

This document defines the core domain entities, invariants, and relationships for the research workspace. It translates the product brief into implementation-ready contracts suitable for TypeScript, Effect Schema, PostgreSQL persistence, and Fred workflow boundaries.

Related documents:

- [architecture.md](./architecture.md)
- [research-execution-model.md](./research-execution-model.md)
- [citation-and-provenance.md](./citation-and-provenance.md)
- [security-model.md](./security-model.md)

## 1. Modeling principles

1. **Immutable provenance beats mutable convenience.** Historical runs must remain reproducible.
2. **Logical entities and physical artifacts are separate.** A `Source` is user-facing; a `SourceVersion` is what research actually reads.
3. **Identifiers are stable and branded.** Use opaque string IDs rather than exposing storage internals.
4. **Persist decisions and evidence, not hidden reasoning.** Research runs store plans, tool actions, outputs, limitations, and citations.
5. **Every externally meaningful record is workspace-scoped.** Authorization is not optional metadata.
6. **Exact computation produces replayable snapshots.** SQL proposals, validations, executions, and result hashes are durable records.

## 2. Bounded contexts

The model naturally splits into six bounded contexts:

1. **Workspace and project management**
2. **Source catalog and versioning**
3. **Document and dataset normalization**
4. **Research execution**
5. **Evidence, citation, and reporting**
6. **Durability and observability**

These contexts may live in separate packages, but they share common IDs and value objects from `packages/domain`.

## 3. Identifier strategy

At the domain layer, identifiers should be opaque branded strings.

```ts
export type WorkspaceId = string & { readonly WorkspaceId: unique symbol };
export type ResearchProjectId = string & { readonly ResearchProjectId: unique symbol };
export type SourceId = string & { readonly SourceId: unique symbol };
export type SourceVersionId = string & { readonly SourceVersionId: unique symbol };
export type DatasetSnapshotId = string & { readonly DatasetSnapshotId: unique symbol };
export type ResearchRunId = string & { readonly ResearchRunId: unique symbol };
export type CitationId = string & { readonly CitationId: unique symbol };
```

Implementation notes:

- IDs should be globally unique and sortable if helpful, but the domain must not depend on one vendor-specific format.
- User-visible short references may be derived separately.
- Physical row numbers, file offsets, or DB primary keys must never be the only stable identity for user-facing provenance.

## 4. Core value objects

### 4.1 WorkspaceScope

The minimum authorization scope carried by repositories and services.

Fields:

- `workspaceId`
- `actorId`
- `roles[]`
- `permissions[]`

Invariant: every read/write service that crosses persistence or storage boundaries must receive a validated scope.

### 4.2 ContentHash

Represents a stable content-derived digest.

Used for:

- file identity within manifests;
- extracted text verification;
- chunk quote matching;
- result snapshot hashing;
- cache keys.

Invariant: content hashes are derived from canonical byte/text representations, not from display formatting.

### 4.3 ArtifactRef

Reference to a stored blob or generated artifact.

Fields:

- `storageKind` (`local`, `s3-compatible`, future variants)
- `objectKey`
- `contentHash`
- `byteSize`
- `mimeType`

Invariant: application services consume artifact references, not raw host paths.

### 4.4 TimeRange

Used for dataset questions, source validity, job durations, and report scopes.

Invariant: `start <= end` and timezone handling is explicit.

## 5. Workspace and project context

### 5.1 Workspace

The ownership and isolation boundary.

Fields:

- `id`
- `name`
- `status`
- `createdAt`
- `updatedAt`
- `settings` (quotas, default providers, retention policies)

Invariants:

- all projects belong to exactly one workspace;
- all sources, runs, citations, and reports inherit workspace ownership;
- cross-workspace joins are forbidden in application services.

### 5.2 ResearchProject

A notebook-like container for research.

Fields:

- `id`
- `workspaceId`
- `name`
- `description`
- `status`
- `defaultResearchMode` (`quick`, `deep`)
- `createdAt`
- `updatedAt`

Relationships:

- has many `Source`
- has many `ResearchThread`
- has many `SavedFinding`
- has many `ResearchReport`

Invariant: a project is the default scope for source selection, research context, and report generation.

## 6. Source catalog and versioning context

### 6.1 Source

A logical user-facing source.

Fields:

- `id`
- `workspaceId`
- `projectId`
- `kind` (`document`, `structured-dataset`, `directory`, `file`; later web/database/git variants)
- `displayName`
- `registrationMethod` (`upload`, `registered-directory`, `generated-import`)
- `status`
- `latestVersionId?`
- `createdAt`
- `updatedAt`

Invariants:

- `Source` is mutable only as a container record;
- all research and citations must resolve through a `SourceVersion`;
- deleting or removing a source must not corrupt historical run provenance.

### 6.2 SourceVersion

An immutable snapshot of a source at a point in time.

Fields:

- `id`
- `sourceId`
- `workspaceId`
- `versionNumber` or monotonic revision
- `sourceKind`
- `createdAt`
- `status` (`pending`, `processing`, `ready`, `partial`, `failed`, `cancelled`)
- `manifestRef?`
- `summaryRef?`
- `extractorVersionSet`
- `embeddingVersionSet`
- `refreshCause` (`initial`, `manual-refresh`, `scheduled-refresh`, `schema-rebuild`, etc.)

Invariants:

- immutable after creation except for terminal processing fields;
- research runs bind to explicit source-version IDs;
- refresh creates a new record rather than mutating an old version.

### 6.3 DirectoryManifest

The versioned inventory of a directory source.

Fields:

- `id`
- `sourceVersionId`
- `rootRegistrationId`
- `rootRelativePath`
- `generatedAt`
- `totalEntries`
- `includedEntries`
- `ignoredEntries`
- `failedEntries`
- `manifestHash`
- `artifactRef`

Invariant: manifest generation happens before expensive extraction so the system can report scope deterministically.

### 6.4 FileEntry

A file discovered within a directory source.

Fields:

- `id`
- `sourceVersionId`
- `directoryManifestId`
- `relativePath`
- `contentHash`
- `byteSize`
- `mimeType`
- `detectedKind`
- `modifiedTime?`
- `ignoreReason?`
- `parser?`
- `extractionStatus`
- `errorCode?`
- `artifactRef?`

Invariants:

- `relativePath` is always relative to a registered root or manifest root;
- symlink resolution cannot escape the registered root;
- content hash changes imply a new source version or refresh delta record.

### 6.5 SourceVersionDiff

Represents comparison between two source versions.

Fields:

- `baseVersionId`
- `targetVersionId`
- `added[]`
- `removed[]`
- `changed[]`
- `renamed[]` (heuristic)
- `summary`

Invariant: diffs are derived artifacts, not authoritative history.

## 7. Document normalization context

### 7.1 Document

Normalized extracted content from a document-like source or file.

Fields:

- `id`
- `sourceVersionId`
- `fileEntryId?`
- `title?`
- `documentKind`
- `language?`
- `pageCount?`
- `artifactRef` (normalized text/structure)
- `textHash`

Invariant: a document record must preserve enough location metadata to reopen the original evidence later.

### 7.2 DocumentSection

A semantic or structural section within a document.

Fields:

- `id`
- `documentId`
- `parentSectionId?`
- `label`
- `headingText?`
- `orderIndex`
- `pageStart?`
- `pageEnd?`
- `characterStart`
- `characterEnd`

Invariant: sections form a stable hierarchical location system for citations and neighbor expansion.

### 7.3 DocumentChunk

A retrieval unit retaining parent context.

Fields:

- `id`
- `documentId`
- `sectionId?`
- `sourceVersionId`
- `chunkText`
- `textHash`
- `characterStart`
- `characterEnd`
- `pageStart?`
- `pageEnd?`
- `embeddingRef?`
- `ftsVectorRef?`
- `metadata`

Invariants:

- chunk boundaries may change between extractor versions, so the chunk is always version-scoped;
- chunks must be reopenable through document + section + range provenance;
- chunk IDs are stable only within a source version and extractor version.

## 8. Structured dataset context

### 8.1 Dataset

A logical structured collection visible to users.

Fields:

- `id`
- `sourceId`
- `workspaceId`
- `projectId`
- `displayName`
- `status`
- `latestSnapshotId?`

Invariant: datasets are logical handles; exact research and citations bind to snapshots.

### 8.2 DatasetSnapshot

An immutable versioned dataset state.

Fields:

- `id`
- `datasetId`
- `sourceVersionId`
- `schemaVersionSignature`
- `recordCountEstimate`
- `storageFormat` (`json-files`, `jsonl`, `csv`, `parquet`, staged variants)
- `materializationRef?`
- `createdAt`
- `status`

Invariants:

- refreshes and regrouping produce new snapshots;
- a snapshot knows exactly which files and schema-family rules produced it.

### 8.3 SchemaFamily

Groups related structured files with compatible or meaningfully similar schemas.

Fields:

- `id`
- `datasetSnapshotId`
- `name`
- `familySignature`
- `contributingFileCount`
- `sampledRecordCount`
- `status`
- `overridePolicy`

Invariants:

- grouping is deterministic from inputs plus explicit user overrides;
- type conflicts and optionality are preserved rather than flattened away.

### 8.4 DatasetTable

A queryable table or view exposed to the SQL layer.

Fields:

- `id`
- `datasetSnapshotId`
- `schemaFamilyId`
- `logicalName`
- `physicalName`
- `rowIdentityStrategy`
- `recordCount`
- `materializationRef`

Invariant: the table's stable row identity strategy must be explicit before dataset citations are allowed.

### 8.5 DatasetField

Field-level inferred metadata.

Fields:

- `id`
- `datasetTableId`
- `name`
- `logicalType`
- `physicalTypes[]`
- `nullability`
- `semanticHints[]`
- `categoricalProfile?`
- `textProfile?`
- `timestampProfile?`
- `conflictSummary?`

Invariant: user-facing schema inspection must show both normalized interpretation and original conflicts.

### 8.6 DatasetRecordRef

A stable reference to a dataset row for provenance.

Fields:

- `datasetSnapshotId`
- `tableId`
- `stableRecordId`
- `sourceFileRef`
- `jsonPointer?`
- `lineNumber?`

Invariant: physical row numbers are insufficient unless they are paired with stronger identity.

### 8.7 DatasetQuery

The validated deterministic query proposal and execution request.

Fields:

- `id`
- `workspaceId`
- `projectId`
- `researchRunId?`
- `datasetSnapshotIds[]`
- `intent`
- `proposedSql`
- `validatedSql`
- `boundParameters`
- `validationStatus`
- `validationNotes[]`
- `engineVersion`
- `limits`
- `createdAt`

Invariant: only validated read-only SQL may produce a result snapshot.

### 8.8 QueryResultSnapshot

The reproducible persisted result of a deterministic query.

Fields:

- `id`
- `datasetQueryId`
- `executedAt`
- `resultHash`
- `rowCount`
- `truncated`
- `previewRef`
- `fullResultRef?`
- `executionStats`

Invariant: explanations and citations reference snapshots, not transient in-memory query results.

## 9. Research execution context

### 9.1 ResearchThread

A user-visible conversation or investigative thread inside a project.

Fields:

- `id`
- `projectId`
- `title`
- `status`
- `createdAt`
- `updatedAt`

Relationship: one thread has many `ResearchRun`.

### 9.2 ResearchRun

One execution of a question or research task.

Fields:

- `id`
- `threadId`
- `projectId`
- `workspaceId`
- `mode` (`quick`, `deep`)
- `question`
- `requestedSourceScope[]`
- `resolvedSourceScope[]`
- `status`
- `plannerModel?`
- `synthesisModel?`
- `promptVersionSet`
- `budgetSnapshot`
- `startedAt`
- `completedAt?`
- `failureSummary?`

Invariants:

- a run operates against explicit source versions, never implicitly against "latest";
- model, prompt, and budget metadata are retained for reproducibility;
- hidden chain-of-thought is never persisted.

### 9.3 ResearchPlan

The structured plan for a run.

Fields:

- `id`
- `researchRunId`
- `objective`
- `strategy`
- `sourceScope[]`
- `steps[]`
- `expectedEvidence[]`
- `limits`
- `revisionNumber`

Invariant: plans are concise, inspectable, safe to persist, and versioned when revised.

### 9.4 ResearchPlanStep

A declarative unit within a plan.

Fields:

- `id`
- `planId`
- `kind`
- `goal`
- `inputs`
- `expectedOutputs`
- `dependsOn[]`
- `budgetSlice`
- `retryPolicy`

Typical kinds:

- `catalog-inspection`
- `document-retrieval`
- `directory-navigation`
- `schema-inspection`
- `deterministic-sql`
- `record-sampling`
- `recursive-partition-analysis`
- `evidence-critique`
- `answer-synthesis`
- `citation-validation`

### 9.5 ResearchStepExecution

The persisted execution record for one planned or derived step.

Fields:

- `id`
- `researchRunId`
- `planStepId`
- `status`
- `attempt`
- `startedAt`
- `completedAt?`
- `toolCallRefs[]`
- `modelCallRefs[]`
- `artifactRefs[]`
- `resultSummary`
- `failure?`

Invariant: steps persist enough operational evidence to resume or audit without storing hidden reasoning.

### 9.6 EvidenceRequirement

A declared requirement for an answer to be considered sufficient.

Examples:

- exact aggregate required;
- at least one design-document section required;
- at least one code citation per mitigation required;
- contradictory evidence must be reported if found;
- minority findings must be retained for corpus synthesis.

## 10. Evidence, citation, and reporting context

### 10.1 Evidence

A normalized reference to source-backed information.

Fields:

- `id`
- `workspaceId`
- `projectId`
- `sourceVersionId?`
- `kind`
- `locator`
- `excerptRef?`
- `quoteHash?`
- `confidence?`
- `generatedBy` (`retrieval`, `sql`, `direct-read`, `partition-analysis`, etc.)

Invariant: every evidence record must be reopenable into raw source material or a deterministic result snapshot.

### 10.2 Citation

A user-facing evidence reference.

`Citation` is a union described in detail in [citation-and-provenance.md](./citation-and-provenance.md).

Common fields:

- `id`
- `workspaceId`
- `projectId`
- `kind`
- `label`
- `sourceVersionId?`
- `evidenceId`
- `validationStatus`
- `validationCheckedAt?`

Invariant: no citation may be attached to a finalized answer or report section unless it validated successfully against the referenced version/snapshot.

### 10.3 ResearchFinding

A structured claim emitted during or after research.

Fields:

- `id`
- `researchRunId`
- `claim`
- `claimType` (`computed-fact`, `retrieved-claim`, `inference`, `limitation`, `conflict`)
- `evidenceIds[]`
- `citationIds[]`
- `confidence`
- `importance`
- `scope`
- `counterEvidenceIds[]`
- `limitations[]`
- `tags[]`

Invariant: a finding without evidence must be explicitly typed as a limitation or hypothesis, never disguised as supported fact.

### 10.4 SavedFinding

A user-curated finding promoted from run output.

Fields:

- `id`
- `projectId`
- `sourceFindingId`
- `savedAt`
- `savedBy`
- `notes?`

Invariant: saved findings preserve original citation references even if later runs disagree.

### 10.5 ResearchReport

An editable, citation-preserving report.

Fields:

- `id`
- `projectId`
- `title`
- `status`
- `sectionRefs[]`
- `artifactRef?`
- `createdFromRunId?`
- `createdAt`
- `updatedAt`

Invariant: report sections retain claim-to-citation relationships; editing should not silently sever provenance.

## 11. Durability and observability context

### 11.1 IngestionJob

A resumable source-processing job.

Fields:

- `id`
- `workspaceId`
- `projectId`
- `sourceId`
- `targetSourceVersionId`
- `kind`
- `status`
- `idempotencyKey`
- `checkpointRef?`
- `attemptCount`
- `createdAt`
- `updatedAt`

Invariant: retried jobs must not duplicate side effects that were already committed.

### 11.2 EventJournalEntry

Canonical append-only record used for replay and SSE projection.

Fields:

- `id`
- `streamKind` (`ingestion`, `research`, `report`)
- `streamId`
- `workspaceId`
- `projectId`
- `eventType`
- `payload`
- `createdAt`
- `cursor`

Invariant: events are immutable and schema-versioned.

### 11.3 BudgetLedger

Tracks resource consumption for a research run.

Fields:

- `researchRunId`
- `modelCalls`
- `toolCalls`
- `tokensIn`
- `tokensOut`
- `estimatedCost`
- `elapsedMs`
- `queryCount`
- `partitionCount`

Invariant: the ledger is the enforcement substrate for budget policies, not a best-effort metric.

## 12. Key relationships

The most important graph edges are:

- `Workspace 1 -> N ResearchProject`
- `ResearchProject 1 -> N Source`
- `Source 1 -> N SourceVersion`
- `SourceVersion 1 -> 0..1 DirectoryManifest`
- `DirectoryManifest 1 -> N FileEntry`
- `SourceVersion 1 -> N Document`
- `Document 1 -> N DocumentSection`
- `Document 1 -> N DocumentChunk`
- `Source 1 -> 0..N Dataset`
- `Dataset 1 -> N DatasetSnapshot`
- `DatasetSnapshot 1 -> N SchemaFamily`
- `DatasetSnapshot 1 -> N DatasetTable`
- `DatasetTable 1 -> N DatasetField`
- `ResearchThread 1 -> N ResearchRun`
- `ResearchRun 1 -> N ResearchPlan`
- `ResearchPlan 1 -> N ResearchPlanStep`
- `ResearchRun 1 -> N ResearchStepExecution`
- `ResearchRun 1 -> N ResearchFinding`
- `Evidence 1 -> 1..N Citation` (usually 1:1, but not required)
- `ResearchRun 1 -> N DatasetQuery`
- `DatasetQuery 1 -> 0..1 QueryResultSnapshot`
- `ResearchProject 1 -> N ResearchReport`

## 13. State machines worth codifying early

### 13.1 SourceVersion status

`pending -> processing -> ready | partial | failed | cancelled`

### 13.2 IngestionJob status

`queued -> running -> completed | failed | cancelled`

### 13.3 ResearchRun status

`queued -> planning -> executing -> validating -> completed | failed | cancelled`

### 13.4 Citation validation status

`pending -> valid | invalid | stale`

### 13.5 ResearchReport status

`draft -> ready -> exported | superseded`

## 14. Domain invariants that must be tested

At minimum, test these invariants directly:

- no cross-workspace resource resolution;
- a research run cannot resolve against unspecified "latest" versions;
- citation locators must point to the same version/snapshot used by the originating run;
- dataset citations reject row references without stable identity;
- report sections cannot retain citations that fail validation;
- refresh creates new immutable source versions instead of mutating old ones;
- directory file entries cannot escape registered roots;
- query result snapshots cannot exist for unvalidated SQL;
- a supported claim must carry evidence or citations;
- a cancelled run cannot continue emitting terminal completion events.

## 15. Suggested Effect Schema organization

A practical package layout for `packages/domain` is:

```text
packages/domain/src/
├── ids/
├── value-objects/
├── workspace/
├── sources/
├── documents/
├── datasets/
├── research/
├── evidence/
├── reports/
├── events/
└── errors/
```

Guidance:

- define schemas close to their bounded context and derive branded identifiers with Effect Schema rather than relying on unchecked casts;
- model expected domain and adapter failures as `Schema.TaggedError` unions with safe metadata and explicit retry classification;
- define business capabilities as `Effect.Service` contracts, implement functions with `Effect.fn`, and compose flat `Layer` graphs at application boundaries;
- derive API/request/response and persisted-record schemas from domain schemas where practical;
- keep persistence-only columns out of user-facing schemas unless they are part of the domain contract;
- expose constructors/validators for invariant-preserving creation;
- keep `Effect.runPromise` and equivalent runtime execution out of domain/service logic.

## 16. What the domain model deliberately excludes

The domain model does not encode:

- private chain-of-thought;
- vendor-specific model request payloads as first-class domain objects;
- UI-only ephemeral state like panel expansion;
- physical Postgres or DuckDB implementation details that can stay in repositories/adapters;
- arbitrary code execution or broad plugin concepts.

That restraint keeps the model stable while the implementation evolves.