import { describe, expect, it } from 'bun:test'
import {
  DATA_ENGINE_ADAPTER_VERSION,
  DATA_ENGINE_EXECUTION_POLICY_VERSION,
  DATA_ENGINE_PROTOCOL_VERSION,
  DATA_ENGINE_VERSION,
} from '../src/protocol.js'
import {
  DATA_ENGINE_ALLOWED_DIRECTORIES,
  DATA_ENGINE_ALLOW_COMMUNITY_EXTENSIONS,
  DATA_ENGINE_ALLOW_UNSIGNED_EXTENSIONS,
  DATA_ENGINE_ENABLE_EXTERNAL_ACCESS,
  DATA_ENGINE_TEMP_DIRECTORY,
  DATA_ENGINE_THREADS,
  canonicalExpectedEngineConfigHash,
  canonicalExpectedEngineConfigPreimage,
} from '../src/runtime-identity.js'
import {
  canonicalEngineConfigHash,
  canonicalEngineConfigPreimage,
  DATA_ENGINE_ADAPTER_VERSION as SIDECAR_DATA_ENGINE_ADAPTER_VERSION,
  DATA_ENGINE_ALLOWED_DIRECTORIES as SIDECAR_DATA_ENGINE_ALLOWED_DIRECTORIES,
  DATA_ENGINE_ALLOW_COMMUNITY_EXTENSIONS as SIDECAR_DATA_ENGINE_ALLOW_COMMUNITY_EXTENSIONS,
  DATA_ENGINE_ALLOW_UNSIGNED_EXTENSIONS as SIDECAR_DATA_ENGINE_ALLOW_UNSIGNED_EXTENSIONS,
  DATA_ENGINE_ENABLE_EXTERNAL_ACCESS as SIDECAR_DATA_ENGINE_ENABLE_EXTERNAL_ACCESS,
  DATA_ENGINE_EXECUTION_POLICY_VERSION as SIDECAR_DATA_ENGINE_EXECUTION_POLICY_VERSION,
  DATA_ENGINE_PROTOCOL_VERSION as SIDECAR_DATA_ENGINE_PROTOCOL_VERSION,
  DATA_ENGINE_TEMP_DIRECTORY as SIDECAR_DATA_ENGINE_TEMP_DIRECTORY,
  DATA_ENGINE_THREADS as SIDECAR_DATA_ENGINE_THREADS,
  DATA_ENGINE_VERSION as SIDECAR_DATA_ENGINE_VERSION,
} from '../../../services/data-engine-sidecar/runtime-identity.mjs'

function sha256JsonLine(value: unknown) {
  return `sha256:${new Bun.CryptoHasher('sha256')
    .update(`${JSON.stringify(value)}\n`)
    .digest('hex')}`
}

describe('data-engine identity contract', () => {
  it('keeps sidecar identity constants aligned with TypeScript contracts', () => {
    expect(SIDECAR_DATA_ENGINE_PROTOCOL_VERSION).toBe(DATA_ENGINE_PROTOCOL_VERSION)
    expect(SIDECAR_DATA_ENGINE_VERSION).toBe(DATA_ENGINE_VERSION)
    expect(SIDECAR_DATA_ENGINE_ADAPTER_VERSION).toBe(DATA_ENGINE_ADAPTER_VERSION)
    expect(SIDECAR_DATA_ENGINE_EXECUTION_POLICY_VERSION)
      .toBe(DATA_ENGINE_EXECUTION_POLICY_VERSION)
    expect(SIDECAR_DATA_ENGINE_THREADS).toBe(DATA_ENGINE_THREADS)
    expect(SIDECAR_DATA_ENGINE_TEMP_DIRECTORY).toBe(DATA_ENGINE_TEMP_DIRECTORY)
    expect(SIDECAR_DATA_ENGINE_ALLOWED_DIRECTORIES)
      .toEqual(DATA_ENGINE_ALLOWED_DIRECTORIES)
    expect(SIDECAR_DATA_ENGINE_ALLOW_COMMUNITY_EXTENSIONS)
      .toBe(DATA_ENGINE_ALLOW_COMMUNITY_EXTENSIONS)
    expect(SIDECAR_DATA_ENGINE_ALLOW_UNSIGNED_EXTENSIONS)
      .toBe(DATA_ENGINE_ALLOW_UNSIGNED_EXTENSIONS)
    expect(SIDECAR_DATA_ENGINE_ENABLE_EXTERNAL_ACCESS)
      .toBe(DATA_ENGINE_ENABLE_EXTERNAL_ACCESS)
  })

  it('hashes the canonical engine configuration preimage exactly in TypeScript and the sidecar', () => {
    const limits = {
      maxMemoryMb: 64,
      maxRows: 100,
      maxOutputBytes: 100_000,
      timeoutMs: 5_000,
    } as const
    const expectedPreimage = {
      protocolVersion: '1',
      engineVersion: 'duckdb-1.5.4',
      engineAdapterVersion: '@duckdb/node-api@1.5.4-r.1',
      executionPolicyVersion: 1,
      threads: 1,
      maxMemoryMb: limits.maxMemoryMb,
      maxRows: limits.maxRows,
      maxOutputBytes: limits.maxOutputBytes,
      timeoutMs: limits.timeoutMs,
      tempDirectory: '/scratch/tmp',
      allowedDirectories: ['/artifacts', '/scratch'],
      allowCommunityExtensions: false,
      allowUnsignedExtensions: false,
      enableExternalAccess: false,
    } as const
    const expectedHash = sha256JsonLine(expectedPreimage)

    expect(canonicalExpectedEngineConfigPreimage(limits)).toEqual(expectedPreimage)
    expect(canonicalEngineConfigPreimage(limits)).toEqual(expectedPreimage)
    expect(canonicalExpectedEngineConfigHash(limits)).toBe(expectedHash)
    expect(canonicalEngineConfigHash(limits)).toBe(expectedHash)
  })
})
