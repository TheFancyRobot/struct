-- Rollback migration 0002: Drop all walking-skeleton tables (reverse order for FK safety).
DROP TABLE IF EXISTS job_queue;
DROP TABLE IF EXISTS event_journal;
DROP TABLE IF EXISTS citations;
DROP TABLE IF EXISTS research_runs;
DROP TABLE IF EXISTS research_threads;
DROP TABLE IF EXISTS source_versions;
DROP TABLE IF EXISTS sources;
DROP TABLE IF EXISTS projects;
DROP TABLE IF EXISTS workspaces;
