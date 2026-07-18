-- Migration 0001: Enable pgvector extension
-- This must run before any table migrations that use vector types.
-- See architecture.md §6.5: pgvector extension is created before table/index migrations.

CREATE EXTENSION IF NOT EXISTS vector;
