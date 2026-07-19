# DEC-0005: Use DuckDB and Parquet for the Deterministic Data Plane

## Status

Accepted.

## Context

Structured datasets are a first-class research source, and the product must answer exact quantitative questions without approximating them through retrieval or summarization. The brief recommends DuckDB as the structured query engine and Parquet as the preferred normalized storage format for large compatible structured sources, especially when dealing with large JSON collections.

## Decision

Use DuckDB as the bounded, read-only execution engine for structured-data
analysis and materialize compatible structured sources into Parquet where it
improves performance and maintainability. Preserve lineage from normalized
tables back to original files, records, and JSON pointers so exact answers
remain reproducible and fully citable.

Phase 04 will run DuckDB behind an isolated container/sidecar. The sidecar may
use the runtime required by its selected adapter, pinned inside the image; Bun
remains the sole maintained host runtime. The host worker communicates through
a typed, authenticated, resource-bounded client contract and never loads the
native adapter. Phase-04 refinement owns the exact image, protocol, mounts,
health checks, limits, and cancellation/restart behavior. The current
`docker-compose.yml` provisions PostgreSQL only, so this paragraph records a
planned boundary rather than an implemented service.

## Alternatives

- Query raw structured files directly in application code.
- Move all structured analytics into PostgreSQL from the start.
- Let models estimate exact dataset answers from sampled text.

## Consequences

- The product gets a strong deterministic data plane for counts, filters, joins, and trend analysis.
- Ingestion must include schema-family detection, materialization, and provenance tracking.
- The sidecar image/runtime and Bun client protocol require independent
  compatibility, security, cancellation, and crash-recovery validation.
- Normalization adds storage and pipeline complexity, but it is necessary for trustworthy structured-data research.

## Related Phase

- [PHASE-04 Structured Datasets and Deterministic SQL](../../.agent-vault/02_Phases/Phase_04_structured_datasets_and_deterministic_sql/Phase.md)
