-- Rollback migration 0001: Remove pgvector extension
DROP EXTENSION IF EXISTS vector;
