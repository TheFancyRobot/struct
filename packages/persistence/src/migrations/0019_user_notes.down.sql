DROP TRIGGER IF EXISTS notes_origin_immutable ON notes;
DROP FUNCTION IF EXISTS reject_note_origin_mutation();
DROP TABLE IF EXISTS note_idempotency_keys;
DROP TABLE IF EXISTS note_revisions;
DROP TABLE IF EXISTS notes;
