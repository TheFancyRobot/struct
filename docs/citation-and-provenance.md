# Citation and Provenance Model

This document defines how the product preserves, validates, opens, and exports evidence. Citations are not decorative footnotes; they are the trust mechanism that makes the research workspace auditable.

Related documents:

- [architecture.md](./architecture.md)
- [domain-model.md](./domain-model.md)
- [research-execution-model.md](./research-execution-model.md)
- [security-model.md](./security-model.md)
- [evaluation-strategy.md](./evaluation-strategy.md)

## 1. Design goals

The citation system must guarantee that a user can:

- see what source version a claim came from;
- open the exact supporting evidence;
- distinguish computed facts from qualitative interpretation;
- inspect the SQL or source snippet behind a claim;
- detect when evidence is stale after a source refresh;
- export findings and reports without losing provenance.

## 2. Core principles

1. **Versioned provenance is mandatory.** Every citation references immutable source or query snapshots.
2. **Locators must be stable enough to reopen evidence.** Human-readable labels are not sufficient.
3. **Quoted text must be verifiable.** Hashes and offsets exist to prove excerpts still match.
4. **Structured-data citations require row identity.** Physical row numbers alone are unsafe.
5. **Directory-level claims require scope summaries.** A citation over a subtree must describe its coverage, not pretend to be a single-file quote.
6. **Final answers are gated by validation.** Unsupported or stale citations block or downgrade claims.

## 3. Provenance chain

The product's provenance graph is:

```text
Workspace
  → ResearchProject
    → Source
      → SourceVersion
        → FileEntry / Document / DatasetSnapshot / QueryResultSnapshot
          → Evidence
            → Citation
              → ResearchFinding
                → ResearchRun / ResearchReport
```

Important consequences:

- a citation never points only at `Source` because `Source` is mutable;
- a `ResearchFinding` is downstream from evidence, not the other way around;
- report sections are only trustworthy when they preserve the citation graph.

## 4. Citation union

The product should model citations as a closed union with explicit variants.

```ts
type Citation =
  | DocumentCitation
  | FileCitation
  | JsonCitation
  | DatasetCitation
  | SqlCitation
  | DirectoryCitation
  | CodeCitation;
```

All variants share common metadata.

```ts
interface CitationBase {
  id: CitationId;
  workspaceId: WorkspaceId;
  projectId: ResearchProjectId;
  kind:
    | "document"
    | "file"
    | "json"
    | "dataset"
    | "sql"
    | "directory"
    | "code";
  evidenceId: string;
  label: string;
  validationStatus: "pending" | "valid" | "invalid" | "stale";
  validationCheckedAt?: string;
}
```

## 5. Citation variants

### 5.1 DocumentCitation

Used for PDFs, Markdown, HTML, text, and DOCX-derived content represented as normalized documents.

Required fields:

- `sourceId`
- `sourceVersionId`
- `documentId`
- `sectionId?`
- `chunkId?`
- `pageStart?`
- `pageEnd?`
- `characterStart?`
- `characterEnd?`
- `excerptTextHash`

Validation checks:

- source version exists and is accessible;
- document exists within that source version;
- section/chunk belongs to the document;
- page/range is valid;
- excerpt hash matches the normalized text at that location.

### 5.2 FileCitation

Used when the evidence is best expressed as a file path plus a line or byte range.

Required fields:

- `sourceId`
- `sourceVersionId`
- `relativePath`
- `contentHash`
- `lineStart?`
- `lineEnd?`
- `byteStart?`
- `byteEnd?`

Validation checks:

- path exists inside the referenced source version;
- content hash matches the file version;
- line/byte ranges are in bounds.

### 5.3 JsonCitation

Used when the evidence is located at a JSON path inside a file or imported structured record.

Required fields:

- `sourceId`
- `sourceVersionId`
- `relativePath`
- `contentHash`
- `jsonPointer` (RFC 6901)
- `recordId?`
- `excerptValueHash?`

Validation checks:

- referenced file exists;
- content hash matches;
- JSON pointer resolves successfully;
- if present, record ID and value hash agree with the resolved record/value.

### 5.4 DatasetCitation

Used for row/column evidence backed by a dataset snapshot.

Required fields:

- `datasetId`
- `datasetSnapshotId`
- `tableName`
- `stableRowIds[]`
- `columnNames[]`
- `queryResultSnapshotId?`
- `sourceRecordRefs[]`

Validation checks:

- dataset snapshot exists and is accessible;
- table/columns belong to the snapshot catalog;
- stable row IDs resolve;
- source record refs map back to file/pointer provenance;
- any linked query result snapshot belongs to the same run or is otherwise authorized.

### 5.5 SqlCitation

Used for claims about deterministic computations rather than a single row.

Required fields:

- `datasetSnapshotIds[]`
- `validatedSql`
- `boundParameters`
- `queryResultSnapshotId`
- `engineVersion`
- `executedAt`
- `resultHash`
- `rowCount`
- `truncated`

Validation checks:

- query result snapshot exists;
- SQL text and params match the stored validated execution;
- engine version is recorded;
- result hash and row count match the snapshot;
- truncation state is explicit.

### 5.6 DirectoryCitation

Used for claims about directory scope, file groups, or manifest-backed coverage.

Required fields:

- `sourceId`
- `sourceVersionId`
- `directoryManifestId`
- `relativeRoot?`
- `includedFileHashes[]` or a summarized hash set reference
- `scopeSummary`

Validation checks:

- manifest exists for the source version;
- subtree/path is valid within the manifest;
- referenced file set summary matches the manifest or stored subset artifact.

### 5.7 CodeCitation

Used for source-code evidence. For v1 this typically resolves through file citations enriched with code-specific metadata.

Required fields:

- `sourceId`
- `sourceVersionId`
- `relativePath`
- `contentHash`
- `lineStart`
- `lineEnd`
- `symbolName?`
- `commitHash?`

Validation checks:

- file path and content hash match the referenced source version;
- symbol metadata, if present, is consistent with the indexed file.

## 6. Evidence normalization

Raw tool outputs are not always good citations. The product should normalize them into evidence first.

### 6.1 Evidence responsibilities

An `Evidence` record should answer:

- what source or snapshot does this come from?
- what exact locator reopens it?
- what excerpt or value was observed?
- how was it obtained (`retrieval`, `sql`, `direct-read`, `partition-analysis`)?
- how confident is the system that this evidence supports the claim?

### 6.2 Evidence categories

Useful categories:

- `document-snippet`
- `file-range`
- `json-value`
- `dataset-row`
- `sql-result`
- `directory-scope`
- `code-range`
- `derived-finding` (only when backed by underlying evidence IDs)

Derived findings should not short-circuit the need to reopen original evidence.

## 7. Claim labeling rules

Every user-visible claim must be labeled as one of:

- **computed fact** — exact result from deterministic SQL or equivalent deterministic processing;
- **retrieved claim** — directly supported by source text or code;
- **inference** — a reasoned interpretation that extends beyond one quoted source;
- **conflict** — an explicit disagreement between sources or findings;
- **limitation** — a known coverage or certainty gap.

Citation requirements by claim type:

- computed fact → at least one `SqlCitation`, often plus row/document citations for explanation;
- retrieved claim → direct document/file/json/code citations;
- inference → supporting citations plus explicit language that it is an inference;
- conflict → citations for both or all conflicting sides;
- limitation → may cite missing/partial coverage evidence, but never pretend unsupported fact exists.

## 8. Opening a citation in the UI

The evidence inspector must be able to open every citation without guessing.

### 8.1 Open behavior by citation type

| Citation type | UI target |
| --- | --- |
| Document | page/section viewer with highlighted excerpt |
| File | file preview with line/byte range focus |
| JSON | structured viewer focused to the JSON Pointer |
| Dataset | row/column table view with stable row identity |
| SQL | query panel showing validated SQL and result summary |
| Directory | manifest/tree view narrowed to subtree or selected set |
| Code | source viewer with line range and optional symbol context |

### 8.2 Opening constraints

- the UI must use source-version-aware APIs;
- opening must fail safely if access is unauthorized;
- opening a stale citation must explain why it is stale rather than silently redirecting to a newer version.

## 9. Citation validation pipeline

Validation is a required phase before final answer completion.

### 9.1 Validation inputs

For each citation, the validator receives:

- citation payload;
- referenced evidence record;
- source or query snapshot metadata;
- necessary artifact/query accessors;
- workspace/project authorization context.

### 9.2 Validation algorithm

1. confirm the referenced version/snapshot exists and is authorized;
2. resolve the locator (path, page, line range, pointer, row ID, query snapshot);
3. verify the source hash or result hash;
4. verify excerpt/value identity where applicable;
5. ensure the citation kind matches the resolved artifact type;
6. mark the citation `valid`, `invalid`, or `stale` with reason codes.

### 9.3 Common invalid reasons

- missing source version;
- missing file/path;
- hash mismatch;
- out-of-range line/page/offset;
- unresolved JSON pointer;
- unstable or missing row identity;
- mismatched query hash;
- citation points at a different snapshot than the run used.

### 9.4 Stale vs invalid

- **invalid** means the citation never resolved correctly for the intended run.
- **stale** means it was valid for an older version but is no longer valid for the current view or was carried into a refreshed context incorrectly.

This distinction matters for debugging and UX.

## 10. Source refresh and invalidation semantics

Refresh is a provenance event, not a destructive mutation.

Rules:

- refreshing a source creates a new `SourceVersion` or `DatasetSnapshot`;
- existing runs keep their original version links;
- historical citations remain valid against their original version;
- a new run against the refreshed source must create new citations;
- copying a finding or report section into a refreshed context requires revalidation.

This is why the system must never attach claims only to mutable `Source` identities.

## 11. SQL provenance rules

Exact answers require query-level provenance beyond row excerpts.

A trustworthy computed claim needs:

- the validated SQL text;
- bound parameters;
- referenced dataset snapshot IDs;
- engine version;
- execution timestamp;
- result hash;
- row count and truncation state;
- optional row-level citations for representative examples.

This lets the user answer both:

- "What was computed?"
- "How was it computed?"

## 12. Directory-scope provenance rules

Some questions are about directory shape, change, or coverage rather than one file.

Examples:

- how many files changed after refresh?
- which subtree contains the most errors?
- what formats were discovered in this directory?

For those, a directory citation must record:

- the manifest version;
- the subtree or selection criteria;
- the included file-set summary;
- whether the claim was exact or sampled;
- any downstream evidence links used for representative examples.

A directory citation must not masquerade as a document quote.

## 13. Recursive-analysis provenance

Recursive decomposition introduces a risk of "summary of summaries" drift. To prevent that:

- every partition finding stores underlying evidence IDs;
- merged findings retain supporting and counterevidence references;
- higher-level synthesis can reopen original evidence before finalization;
- partition scope and coverage travel with the finding.

A final claim based only on top-level prose summaries is not acceptable.

## 14. Export requirements

Markdown and JSON exports must preserve provenance.

### 14.1 Markdown export

Should preserve:

- inline citation markers;
- appendix or hover-target-friendly citation metadata;
- explicit limitation/conflict sections;
- SQL snippets or references where exact results are discussed.

### 14.2 JSON export

Should preserve structured fields such as:

- findings;
- claim types;
- citation payloads;
- evidence links;
- source-version IDs;
- query snapshot IDs;
- validation status.

## 15. Security and privacy constraints on citations

A citation should reveal enough to verify evidence, but not enough to leak unrelated secrets.

Therefore:

- no absolute host paths are exposed to end users;
- only registered relative paths are shown;
- environment variables and credentials are never included in evidence payloads;
- row previews and file snippets remain subject to workspace authorization;
- sanitized error messages replace internal storage or provider details.

## 16. Observability for provenance quality

Track at least these quality metrics:

- citation validation success rate;
- stale citation rate after refresh;
- excerpt hash mismatch rate;
- row-identity resolution failure rate;
- unsupported-claim rate;
- average citations per final answer;
- percentage of mixed-source answers with heterogeneous citation types;
- time to open a citation in the UI.

These metrics should be visible in evaluation reports and release gates.

## 17. Tests implied by this model

At minimum, the system needs tests for:

- document/page/section reopening;
- file line/byte range reopening;
- JSON pointer resolution across nested structures;
- stable dataset row identity under import and refresh;
- SQL snapshot hash validation;
- stale citation detection after source refresh;
- recursive finding provenance retention;
- report export preserving citations;
- unauthorized citation open attempts;
- mixed-source flagship scenario with SQL, JSON, document, and code citations.

## 18. Non-negotiable rules

The citation/provenance model fails if any of the following happen:

- a final answer contains unsupported factual claims with no citations or limitation labels;
- a citation points only to a mutable logical source and not an immutable version/snapshot;
- a dataset citation uses unstable physical row numbers as its sole identity;
- a refreshed source silently reuses historical citations without revalidation;
- a user can click a citation and not reach the intended evidence;
- recursive analysis loses the evidence trail back to original source material.

Those rules are the product's evidence contract.