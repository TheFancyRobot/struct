CREATE TABLE notes (
  id UUID PRIMARY KEY,
  workspace_id UUID NOT NULL,
  project_id UUID NOT NULL,
  author_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE RESTRICT,
  origin JSONB NOT NULL,
  current_revision INTEGER NOT NULL DEFAULT 1 CHECK (current_revision > 0),
  archived BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL,
  CONSTRAINT fk_notes_project
    FOREIGN KEY (workspace_id, project_id)
    REFERENCES projects(workspace_id, id)
    ON DELETE CASCADE
);

CREATE TABLE note_revisions (
  note_id UUID NOT NULL REFERENCES notes(id) ON DELETE CASCADE,
  revision INTEGER NOT NULL CHECK (revision > 0),
  title TEXT NOT NULL CHECK (char_length(title) BETWEEN 1 AND 200),
  body TEXT NOT NULL CHECK (
    octet_length(body) BETWEEN 1 AND 262144
  ),
  author_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE RESTRICT,
  content_hash TEXT NOT NULL CHECK (
    content_hash ~ '^sha256:[0-9a-f]{64}$'
  ),
  created_at TIMESTAMPTZ NOT NULL,
  PRIMARY KEY (note_id, revision)
);

CREATE TABLE note_idempotency_keys (
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  project_id UUID NOT NULL,
  idempotency_key TEXT NOT NULL CHECK (
    char_length(idempotency_key) BETWEEN 1 AND 512
  ),
  note_id UUID NOT NULL REFERENCES notes(id) ON DELETE CASCADE,
  PRIMARY KEY (workspace_id, project_id, idempotency_key),
  CONSTRAINT fk_note_idempotency_project
    FOREIGN KEY (workspace_id, project_id)
    REFERENCES projects(workspace_id, id)
    ON DELETE CASCADE
);

CREATE INDEX notes_project_updated_idx
  ON notes (workspace_id, project_id, archived, updated_at DESC, id DESC);

CREATE OR REPLACE FUNCTION reject_note_origin_mutation()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.origin IS DISTINCT FROM OLD.origin
    OR NEW.workspace_id IS DISTINCT FROM OLD.workspace_id
    OR NEW.project_id IS DISTINCT FROM OLD.project_id
    OR NEW.author_id IS DISTINCT FROM OLD.author_id
  THEN
    RAISE EXCEPTION 'note identity and origin are immutable';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER notes_origin_immutable
  BEFORE UPDATE ON notes
  FOR EACH ROW EXECUTE FUNCTION reject_note_origin_mutation();
