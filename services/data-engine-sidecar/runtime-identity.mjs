import { createHash } from 'node:crypto'

export const DATA_ENGINE_PROTOCOL_VERSION = '1'
export const DATA_ENGINE_VERSION = 'duckdb-1.5.4'
export const DATA_ENGINE_ADAPTER_VERSION = '@duckdb/node-api@1.5.4-r.1'
export const DATA_ENGINE_EXECUTION_POLICY_VERSION = 1

export const DATA_ENGINE_ARTIFACT_ROOT = '/artifacts'
export const DATA_ENGINE_SCRATCH_ROOT = '/scratch'
export const DATA_ENGINE_THREADS = 1
export const DATA_ENGINE_TEMP_DIRECTORY = `${DATA_ENGINE_SCRATCH_ROOT}/tmp`
export const DATA_ENGINE_ALLOWED_DIRECTORIES = Object.freeze([
  DATA_ENGINE_ARTIFACT_ROOT,
  DATA_ENGINE_SCRATCH_ROOT,
])
export const DATA_ENGINE_ALLOW_COMMUNITY_EXTENSIONS = false
export const DATA_ENGINE_ALLOW_UNSIGNED_EXTENSIONS = false
export const DATA_ENGINE_ENABLE_EXTERNAL_ACCESS = false

function sha256JsonLine(value) {
  return `sha256:${createHash('sha256')
    .update(`${JSON.stringify(value)}\n`)
    .digest('hex')}`
}

export function canonicalEngineConfigPreimage(limits) {
  return {
    protocolVersion: DATA_ENGINE_PROTOCOL_VERSION,
    engineVersion: DATA_ENGINE_VERSION,
    engineAdapterVersion: DATA_ENGINE_ADAPTER_VERSION,
    executionPolicyVersion: DATA_ENGINE_EXECUTION_POLICY_VERSION,
    threads: DATA_ENGINE_THREADS,
    maxMemoryMb: limits.maxMemoryMb,
    maxRows: limits.maxRows,
    maxOutputBytes: limits.maxOutputBytes,
    timeoutMs: limits.timeoutMs,
    tempDirectory: DATA_ENGINE_TEMP_DIRECTORY,
    allowedDirectories: DATA_ENGINE_ALLOWED_DIRECTORIES,
    allowCommunityExtensions: DATA_ENGINE_ALLOW_COMMUNITY_EXTENSIONS,
    allowUnsignedExtensions: DATA_ENGINE_ALLOW_UNSIGNED_EXTENSIONS,
    enableExternalAccess: DATA_ENGINE_ENABLE_EXTERNAL_ACCESS,
  }
}

export function canonicalEngineConfigHash(limits) {
  return sha256JsonLine(canonicalEngineConfigPreimage(limits))
}
