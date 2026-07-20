import { describe, expect, it } from 'bun:test'
import { readFile } from 'node:fs/promises'
import { Effect, Schema } from 'effect'
import {
  checkReadiness,
  classifyTerminalFailure,
  DependencyReadinessError,
  healthResponse,
  makeSupportDiagnostic,
} from './index'

class DataEngineTransportError
  extends Schema.TaggedError<DataEngineTransportError>()(
    'DataEngineTransportError',
    { message: Schema.String },
  ) {}
class ResearchJobStaleError
  extends Schema.TaggedError<ResearchJobStaleError>()(
    'ResearchJobStaleError',
    { message: Schema.String },
  ) {}
class ResearchCancelledError
  extends Schema.TaggedError<ResearchCancelledError>()(
    'ResearchCancelledError',
    { message: Schema.String },
  ) {}
class StorageReadError
  extends Schema.TaggedError<StorageReadError>()(
    'StorageReadError',
    { message: Schema.String },
  ) {}

const runbookPath = new URL(
  '../../../docs/operations/observability-incident-response.md',
  import.meta.url,
)
const packagePath = new URL('../../../package.json', import.meta.url)
const operationsPath = new URL('../../../scripts/production-operations.ts', import.meta.url)

describe('observability game day', () => {
  it('distinguishes database and worker readiness failures from liveness', async () => {
    const report = await Effect.runPromise(checkReadiness([
      { dependency: 'database', check: Effect.fail('database-offline') },
      { dependency: 'worker', check: Effect.fail(new DependencyReadinessError({
        dependency: 'worker',
        classification: 'stalled',
        message: 'worker-stalled',
      })) },
    ]))
    expect(healthResponse().status).toBe(200)
    expect(report.status).toBe('not-ready')
    expect(report.failures).toEqual([
      { dependency: 'database', classification: 'dependency-unavailable' },
      { dependency: 'worker', classification: 'stalled' },
    ])
  })

  it('classifies sidecar, stalled, cancelled, SSE capacity, and backup failures', () => {
    expect(classifyTerminalFailure(new DataEngineTransportError({
      message: 'offline',
    }))).toBe('dependency-unavailable')
    expect(classifyTerminalFailure(new ResearchJobStaleError({
      message: 'stale',
    }))).toBe('stalled')
    expect(classifyTerminalFailure(new ResearchCancelledError({
      message: 'cancelled',
    }))).toBe('cancelled')
    expect(classifyTerminalFailure({ _tag: 'SseCapacityLimitError' }))
      .toBe('capacity-exceeded')
    expect(classifyTerminalFailure(new StorageReadError({
      message: 'archive unavailable',
    }))).toBe('dependency-unavailable')
  })

  it('redacts a secret-exposure canary in a bounded support diagnostic', () => {
    const diagnostic = makeSupportDiagnostic({
      schemaVersion: '1',
      event: 'secret.exposure.canary',
      boundary: 'request',
      outcome: 'failure',
      classification: 'unauthorized',
      identity: { requestId: 'request-1', workspaceId: 'workspace-1' },
      details: {
        authorization: 'Bearer should-never-survive',
        prompt: 'confidential prompt',
        providerPayload: { token: 'sk_should-never-survive' },
        nested: Array.from({ length: 100 }, () => 'x'.repeat(1_000)),
      },
    })
    const encoded = JSON.stringify(diagnostic)
    expect(encoded).not.toContain('should-never-survive')
    expect(encoded).not.toContain('confidential prompt')
    expect(encoded).toContain('[REDACTED]')
    expect(new TextEncoder().encode(encoded).byteLength).toBeLessThanOrEqual(4_096)
  })

  it('keeps every runbook and measured alert budget executable', async () => {
    const [document, packageDocument, operations] = await Promise.all([
      readFile(runbookPath, 'utf8'),
      readFile(packagePath, 'utf8'),
      readFile(operationsPath, 'utf8'),
    ])
    for (const heading of [
      'Database outage runbook',
      'Worker stall runbook',
      'Sidecar outage runbook',
      'Stuck or cancelled research runbook',
      'SSE reconnect storm runbook',
      'Backup or restore failure runbook',
      'Secret exposure runbook',
    ]) expect(document).toContain(`## ${heading}`)
    for (const budget of ['2 s', '5 s', '10 s', '100', '600 s']) {
      expect(document).toContain(budget)
    }
    for (const command of [
      'bun run ops database:verify',
      'bun run ops application:verify',
      'bun run secrets:scan',
    ]) expect(document).toContain(command)
    const prose = document.replaceAll(/\s+/g, ' ')
    expect(prose).toContain('authenticated data-engine health fails for 60 s')
    expect(prose).toContain('minimal non-persisting model smoke operation')
    expect(prose).toContain('drop the optional details field')
    expect(prose).toContain('carry no input-derived labels')
    const scripts = JSON.parse(packageDocument).scripts as Record<string, string>
    expect(scripts['ops']).toBe('bun run scripts/production-operations.ts')
    expect(scripts['secrets:scan']).toBe('bun run scripts/secrets-scan.ts')
    expect(operations).toContain("case 'database:verify':")
    expect(operations).toContain("case 'application:verify':")
  })
})
