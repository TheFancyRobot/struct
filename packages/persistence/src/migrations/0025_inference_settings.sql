CREATE TABLE inference_providers (
  id UUID PRIMARY KEY,
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  provider_type TEXT NOT NULL CHECK (length(provider_type) > 0),
  endpoint TEXT,
  credential_reference TEXT NOT NULL CHECK (length(credential_reference) > 0),
  enabled BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE inference_models (
  id UUID PRIMARY KEY,
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  provider_id UUID NOT NULL REFERENCES inference_providers(id) ON DELETE CASCADE,
  name TEXT NOT NULL CHECK (length(name) > 0),
  capabilities TEXT[] NOT NULL CHECK (cardinality(capabilities) > 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (workspace_id, provider_id, name)
);

CREATE TABLE inference_model_assignments (
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('chat', 'embedding', 'vision')),
  model_id UUID NOT NULL REFERENCES inference_models(id) ON DELETE RESTRICT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (workspace_id, role)
);
