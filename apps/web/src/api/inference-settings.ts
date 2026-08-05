import { apiPath, basePathFromPublicBaseUrl } from '../base-path'

const appBasePath = basePathFromPublicBaseUrl(import.meta.env.BASE_URL)
export type InferenceRole = 'chat' | 'embedding' | 'vision'
export interface InferenceSettings {
  readonly providers: ReadonlyArray<{ readonly id: string, readonly type: string, readonly endpoint: string | null, readonly enabled: boolean, readonly hasCredential: boolean }>
  readonly models: ReadonlyArray<{ readonly id: string, readonly providerId: string, readonly name: string, readonly capabilities: ReadonlyArray<InferenceRole> }>
  readonly assignments: Readonly<Record<InferenceRole, string | null>>
}

async function request(path: string, init?: RequestInit): Promise<unknown> {
  const response = await fetch(apiPath(path, appBasePath), { ...init, signal: AbortSignal.timeout(10_000) })
  const body: unknown = await response.json()
  if (!response.ok) throw new Error('Settings could not be saved. Check the provider and model selection.')
  return body
}

export const fetchInferenceSettings = () => request('/settings/inference') as Promise<InferenceSettings>
export const createInferenceProvider = (input: { type: string, endpoint: string, credentialReference: string }) => request('/settings/inference/providers', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(input) })
export const updateInferenceProvider = (id: string, input: { type: string, endpoint: string, credentialReference?: string }) => request(`/settings/inference/providers/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(input) })
export const setInferenceProviderEnabled = (id: string, enabled: boolean) => request(`/settings/inference/providers/${id}/enabled`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ enabled }) })
export const deleteInferenceProvider = (id: string) => request(`/settings/inference/providers/${id}`, { method: 'DELETE' })
export const testInferenceProvider = (id: string) => request(`/settings/inference/providers/${id}/test`, { method: 'POST' }) as Promise<{ readonly ok: boolean, readonly message: string }>
export const createInferenceModel = (input: { providerId: string, name: string, capabilities: ReadonlyArray<InferenceRole> }) => request('/settings/inference/models', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(input) })
export const assignInferenceModel = (role: InferenceRole, modelId: string) => request(`/settings/inference/assignments/${role}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ modelId }) })
