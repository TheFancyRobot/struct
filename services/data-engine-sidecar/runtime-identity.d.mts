export const DATA_ENGINE_PROTOCOL_VERSION: '1'
export const DATA_ENGINE_VERSION: 'duckdb-1.5.4'
export const DATA_ENGINE_ADAPTER_VERSION: '@duckdb/node-api@1.5.4-r.1'
export const DATA_ENGINE_EXECUTION_POLICY_VERSION: 1
export const DATA_ENGINE_ARTIFACT_ROOT: '/artifacts'
export const DATA_ENGINE_SCRATCH_ROOT: '/scratch'
export const DATA_ENGINE_THREADS: 1
export const DATA_ENGINE_TEMP_DIRECTORY: '/scratch/tmp'
export const DATA_ENGINE_ALLOWED_DIRECTORIES: readonly ['/artifacts', '/scratch']
export const DATA_ENGINE_ALLOW_COMMUNITY_EXTENSIONS: false
export const DATA_ENGINE_ALLOW_UNSIGNED_EXTENSIONS: false
export const DATA_ENGINE_ENABLE_EXTERNAL_ACCESS: false

export interface DataEngineConfigHashLimits {
  readonly maxMemoryMb: number
  readonly maxRows: number
  readonly maxOutputBytes: number
  readonly timeoutMs: number
}

export function canonicalEngineConfigPreimage(limits: DataEngineConfigHashLimits): {
  readonly protocolVersion: '1'
  readonly engineVersion: 'duckdb-1.5.4'
  readonly engineAdapterVersion: '@duckdb/node-api@1.5.4-r.1'
  readonly executionPolicyVersion: 1
  readonly threads: 1
  readonly maxMemoryMb: number
  readonly maxRows: number
  readonly maxOutputBytes: number
  readonly timeoutMs: number
  readonly tempDirectory: '/scratch/tmp'
  readonly allowedDirectories: readonly ['/artifacts', '/scratch']
  readonly allowCommunityExtensions: false
  readonly allowUnsignedExtensions: false
  readonly enableExternalAccess: false
}

export function canonicalEngineConfigHash(limits: DataEngineConfigHashLimits): string
