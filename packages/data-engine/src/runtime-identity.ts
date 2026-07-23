import {
  DATA_ENGINE_ADAPTER_VERSION,
  DATA_ENGINE_EXECUTION_POLICY_VERSION,
  DATA_ENGINE_PROTOCOL_VERSION,
  DATA_ENGINE_VERSION,
} from './protocol.js'

export const DATA_ENGINE_ARTIFACT_ROOT = '/artifacts' as const
export const DATA_ENGINE_SCRATCH_ROOT = '/scratch' as const
export const DATA_ENGINE_THREADS = 1 as const
export const DATA_ENGINE_TEMP_DIRECTORY = `${DATA_ENGINE_SCRATCH_ROOT}/tmp` as const
export const DATA_ENGINE_ALLOWED_DIRECTORIES = [
  DATA_ENGINE_ARTIFACT_ROOT,
  DATA_ENGINE_SCRATCH_ROOT,
] as const
export const DATA_ENGINE_ALLOW_COMMUNITY_EXTENSIONS = false as const
export const DATA_ENGINE_ALLOW_UNSIGNED_EXTENSIONS = false as const
export const DATA_ENGINE_ENABLE_EXTERNAL_ACCESS = false as const

export interface DataEngineConfigHashLimits {
  readonly maxMemoryMb: number
  readonly maxRows: number
  readonly maxOutputBytes: number
  readonly timeoutMs: number
}

export interface CanonicalExpectedEngineConfigPreimage {
  readonly protocolVersion: typeof DATA_ENGINE_PROTOCOL_VERSION
  readonly engineVersion: typeof DATA_ENGINE_VERSION
  readonly engineAdapterVersion: typeof DATA_ENGINE_ADAPTER_VERSION
  readonly executionPolicyVersion: typeof DATA_ENGINE_EXECUTION_POLICY_VERSION
  readonly threads: typeof DATA_ENGINE_THREADS
  readonly maxMemoryMb: number
  readonly maxRows: number
  readonly maxOutputBytes: number
  readonly timeoutMs: number
  readonly tempDirectory: typeof DATA_ENGINE_TEMP_DIRECTORY
  readonly allowedDirectories: typeof DATA_ENGINE_ALLOWED_DIRECTORIES
  readonly allowCommunityExtensions: typeof DATA_ENGINE_ALLOW_COMMUNITY_EXTENSIONS
  readonly allowUnsignedExtensions: typeof DATA_ENGINE_ALLOW_UNSIGNED_EXTENSIONS
  readonly enableExternalAccess: typeof DATA_ENGINE_ENABLE_EXTERNAL_ACCESS
}

function sha256JsonLine(value: unknown): string {
  return `sha256:${new Bun.CryptoHasher('sha256')
    .update(`${JSON.stringify(value)}\n`)
    .digest('hex')}`
}

export function canonicalExpectedEngineConfigPreimage(
  limits: DataEngineConfigHashLimits,
): CanonicalExpectedEngineConfigPreimage {
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

export function canonicalExpectedEngineConfigHash(
  limits: DataEngineConfigHashLimits,
): string {
  return sha256JsonLine(canonicalExpectedEngineConfigPreimage(limits))
}
