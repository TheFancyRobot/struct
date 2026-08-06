CREATE TABLE inference_providers (
  id UUID PRIMARY KEY,
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  provider_type TEXT NOT NULL CHECK (provider_type = '@fancyrobot/fred-openai'),
  endpoint TEXT,
  credential_reference TEXT NOT NULL CHECK (length(credential_reference) > 0),
  enabled BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (workspace_id, id)
);

CREATE TABLE inference_models (
  id UUID PRIMARY KEY,
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  provider_id UUID NOT NULL,
  name TEXT NOT NULL CHECK (length(name) > 0),
  capabilities TEXT[] NOT NULL CHECK (cardinality(capabilities) > 0 AND capabilities <@ ARRAY['chat', 'embedding', 'vision']::TEXT[]),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (workspace_id, provider_id, name),
  UNIQUE (workspace_id, id),
  FOREIGN KEY (workspace_id, provider_id) REFERENCES inference_providers(workspace_id, id) ON DELETE CASCADE
);

CREATE TABLE inference_model_assignments (
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('chat', 'embedding', 'vision')),
  model_id UUID NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (workspace_id, role),
  FOREIGN KEY (workspace_id, model_id) REFERENCES inference_models(workspace_id, id) ON DELETE RESTRICT
);
