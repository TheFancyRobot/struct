/**
 * Migration manifest — ordered list of migrations with their up/down SQL paths.
 *
 * The runner reads this manifest and applies migrations in order.
 * Each entry has a unique name used for tracking applied migrations.
 */
export interface Migration {
  readonly name: string
  readonly upPath: string
  readonly downPath: string
}

export const migrations: readonly Migration[] = [
  {
    name: '0001_enable_pgvector',
    upPath: new URL('./0001_enable_pgvector.sql', import.meta.url).pathname,
    downPath: new URL('./0001_enable_pgvector.down.sql', import.meta.url).pathname,
  },
  {
    name: '0002_init_tables',
    upPath: new URL('./0002_init_tables.sql', import.meta.url).pathname,
    downPath: new URL('./0002_init_tables.down.sql', import.meta.url).pathname,
  },
  {
    name: '0003_research_text_index',
    upPath: new URL('./0003_research_text_index.sql', import.meta.url).pathname,
    downPath: new URL('./0003_research_text_index.down.sql', import.meta.url).pathname,
  },
  {
    name: '0004_event_journal_commit_order',
    upPath: new URL('./0004_event_journal_commit_order.sql', import.meta.url).pathname,
    downPath: new URL('./0004_event_journal_commit_order.down.sql', import.meta.url).pathname,
  },
  {
    name: '0005_document_chunks',
    upPath: new URL('./0005_document_chunks.sql', import.meta.url).pathname,
    downPath: new URL('./0005_document_chunks.down.sql', import.meta.url).pathname,
  },
  {
    name: '0006_hybrid_retrieval',
    upPath: new URL('./0006_hybrid_retrieval.sql', import.meta.url).pathname,
    downPath: new URL('./0006_hybrid_retrieval.down.sql', import.meta.url).pathname,
  },
  {
    name: '0007_directory_ingestion_jobs',
    upPath: new URL('./0007_directory_ingestion_jobs.sql', import.meta.url).pathname,
    downPath: new URL('./0007_directory_ingestion_jobs.down.sql', import.meta.url).pathname,
  },
  {
    name: '0008_directory_refresh_lineage',
    upPath: new URL('./0008_directory_refresh_lineage.sql', import.meta.url).pathname,
    downPath: new URL('./0008_directory_refresh_lineage.down.sql', import.meta.url).pathname,
  },
  {
    name: '0009_directory_controls',
    upPath: new URL('./0009_directory_controls.sql', import.meta.url).pathname,
    downPath: new URL('./0009_directory_controls.down.sql', import.meta.url).pathname,
  },
  {
    name: '0010_dataset_catalog',
    upPath: new URL('./0010_dataset_catalog.sql', import.meta.url).pathname,
    downPath: new URL('./0010_dataset_catalog.down.sql', import.meta.url).pathname,
  },
  {
    name: '0011_dataset_materializations',
    upPath: new URL('./0011_dataset_materializations.sql', import.meta.url).pathname,
    downPath: new URL('./0011_dataset_materializations.down.sql', import.meta.url).pathname,
  },
  {
    name: '0012_dataset_query_evidence',
    upPath: new URL('./0012_dataset_query_evidence.sql', import.meta.url).pathname,
    downPath: new URL('./0012_dataset_query_evidence.down.sql', import.meta.url).pathname,
  },
  {
    name: '0013_research_run_durability',
    upPath: new URL('./0013_research_run_durability.sql', import.meta.url).pathname,
    downPath: new URL('./0013_research_run_durability.down.sql', import.meta.url).pathname,
  },
] as const
