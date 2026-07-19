DROP TABLE IF EXISTS research_run_results;
DROP TRIGGER IF EXISTS source_versions_enqueue_text_reindex ON source_versions;
DROP FUNCTION IF EXISTS enqueue_source_text_reindex();
DROP TABLE IF EXISTS source_text_reindex_jobs;
DROP TABLE IF EXISTS source_text_index;
