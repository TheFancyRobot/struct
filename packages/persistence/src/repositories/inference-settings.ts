import { Effect } from 'effect'
import { SqlClient } from '../sql-client.js'
import { QueryError } from '../errors.js'

export type InferenceRole = 'chat' | 'embedding' | 'vision'
export type InferenceCapability = InferenceRole

export interface InferenceProvider {
  readonly id: string
  readonly type: string
  readonly endpoint: string | null
  readonly enabled: boolean
  readonly hasCredential: boolean
}

export interface InferenceModel {
  readonly id: string
  readonly providerId: string
  readonly name: string
  readonly capabilities: ReadonlyArray<InferenceCapability>
}

export interface InferenceSettings {
  readonly providers: ReadonlyArray<InferenceProvider>
  readonly models: ReadonlyArray<InferenceModel>
  readonly assignments: Readonly<Record<InferenceRole, string | null>>
}

/** Server-only runtime selection. Credential references never leave this repository. */
export interface InferenceRuntimeModel {
  readonly providerPackage: string
  readonly model: string
  readonly endpoint: string | null
  readonly credentialReference: string
}

export class InferenceSettingsRepo extends Effect.Service<InferenceSettingsRepo>()('InferenceSettingsRepo', {
  accessors: true,
  effect: Effect.gen(function* () {
    const sql = yield* SqlClient
    const query = <A>(operation: string, run: () => Promise<A>) => Effect.tryPromise({
      try: run,
      catch: (error) => new QueryError({ operation, entity: 'InferenceSettings', message: String(error) }),
    })
    return {
      list: (workspaceId: string): Effect.Effect<InferenceSettings, QueryError> => Effect.gen(function* () {
        const [providers, models, assignments] = yield* Effect.all([
          query('listProviders', () => sql.unsafe(
            `SELECT id, provider_type, endpoint, enabled FROM inference_providers WHERE workspace_id = $1 ORDER BY created_at`, [workspaceId])),
          query('listModels', () => sql.unsafe(
            `SELECT id, provider_id, name, capabilities FROM inference_models WHERE workspace_id = $1 ORDER BY created_at`, [workspaceId])),
          query('listAssignments', () => sql.unsafe(
            `SELECT role, model_id FROM inference_model_assignments WHERE workspace_id = $1`, [workspaceId])),
        ])
        const selected: Record<InferenceRole, string | null> = { chat: null, embedding: null, vision: null }
        for (const assignment of assignments) {
          if (assignment['role'] === 'chat' || assignment['role'] === 'embedding' || assignment['role'] === 'vision') {
            selected[assignment['role']] = String(assignment['model_id'])
          }
        }
        return {
          providers: providers.map((row) => ({ id: String(row['id']), type: String(row['provider_type']), endpoint: typeof row['endpoint'] === 'string' ? row['endpoint'] : null, enabled: row['enabled'] === true, hasCredential: true })),
          models: models.map((row) => ({ id: String(row['id']), providerId: String(row['provider_id']), name: String(row['name']), capabilities: (row['capabilities'] as ReadonlyArray<InferenceCapability>) })),
          assignments: selected,
        }
      }),
      createProvider: (input: { id: string, workspaceId: string, type: string, endpoint: string | null, credentialReference: string }) => query('createProvider', () => sql.unsafe(
        `INSERT INTO inference_providers (id, workspace_id, provider_type, endpoint, credential_reference) VALUES ($1, $2, $3, $4, $5)`,
        [input.id, input.workspaceId, input.type, input.endpoint, input.credentialReference],
      )),
      updateProvider: (input: { id: string, workspaceId: string, type: string, endpoint: string | null, credentialReference: string | null }) => query('updateProvider', () => sql.unsafe(
        `UPDATE inference_providers SET provider_type = $3, endpoint = $4, credential_reference = COALESCE($5, credential_reference), updated_at = NOW() WHERE id = $1 AND workspace_id = $2`,
        [input.id, input.workspaceId, input.type, input.endpoint, input.credentialReference],
      )),
      setProviderEnabled: (input: { id: string, workspaceId: string, enabled: boolean }) => query('setProviderEnabled', () => sql.transaction(async (transaction) => {
        if (!input.enabled) await transaction.unsafe(
          `DELETE FROM inference_model_assignments assignment USING inference_models model WHERE assignment.workspace_id = $2 AND assignment.model_id = model.id AND model.provider_id = $1`,
          [input.id, input.workspaceId],
        )
        await transaction.unsafe(
          `UPDATE inference_providers SET enabled = $3, updated_at = NOW() WHERE id = $1 AND workspace_id = $2`,
          [input.id, input.workspaceId, input.enabled],
        )
      })),
      deleteProvider: (input: { id: string, workspaceId: string }) => query('deleteProvider', () => sql.transaction(async (transaction) => {
        await transaction.unsafe(
          `DELETE FROM inference_model_assignments assignment USING inference_models model WHERE assignment.workspace_id = $2 AND assignment.model_id = model.id AND model.provider_id = $1`,
          [input.id, input.workspaceId],
        )
        await transaction.unsafe(
          `DELETE FROM inference_providers WHERE id = $1 AND workspace_id = $2`,
          [input.id, input.workspaceId],
        )
      })),
      createModel: (input: { id: string, workspaceId: string, providerId: string, name: string, capabilities: ReadonlyArray<InferenceCapability> }) => query('createModel', () => sql.unsafe(
        `INSERT INTO inference_models (id, workspace_id, provider_id, name, capabilities) VALUES ($1, $2, $3, $4, $5)`,
        [input.id, input.workspaceId, input.providerId, input.name, input.capabilities],
      )),
      assign: (input: { workspaceId: string, role: InferenceRole, modelId: string }) => query('assign', () => sql.unsafe(
        `INSERT INTO inference_model_assignments (workspace_id, role, model_id) SELECT $1, $2, model.id FROM inference_models model JOIN inference_providers provider ON provider.id = model.provider_id WHERE model.id = $3 AND model.workspace_id = $1 AND provider.enabled ON CONFLICT (workspace_id, role) DO UPDATE SET model_id = EXCLUDED.model_id, updated_at = NOW()`,
        [input.workspaceId, input.role, input.modelId],
      )),
      resolveRuntimeModel: (workspaceId: string, role: InferenceRole): Effect.Effect<InferenceRuntimeModel | null, QueryError> => Effect.gen(function* () {
        const rows = yield* query('resolveRuntimeModel', () => sql.unsafe(
          `SELECT provider.provider_type, provider.endpoint, provider.credential_reference, model.name FROM inference_model_assignments assignment JOIN inference_models model ON model.id = assignment.model_id AND model.workspace_id = assignment.workspace_id JOIN inference_providers provider ON provider.id = model.provider_id AND provider.workspace_id = model.workspace_id WHERE assignment.workspace_id = $1 AND assignment.role = $2 AND provider.enabled LIMIT 1`,
          [workspaceId, role],
        ))
        const row = rows[0]
        if (row === undefined) return null
        return {
          providerPackage: String(row['provider_type']),
          model: String(row['name']),
          endpoint: typeof row['endpoint'] === 'string' ? row['endpoint'] : null,
          credentialReference: String(row['credential_reference']),
        }
      }),
    }
  }),
}) {}
