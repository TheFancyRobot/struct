import { describe, expect, it } from 'bun:test'
import { Effect } from 'effect'
import {
  checkReadiness,
  healthResponse,
  readinessResponse,
} from './health'
import { DependencyReadinessError, classifyTerminalFailure } from './tracing'

describe('health and readiness', () => {
  it('keeps liveness independent from dependency readiness', async () => {
    const liveness = healthResponse()
    const readiness = await Effect.runPromise(readinessResponse([
      { dependency: 'database', check: Effect.fail('offline') },
      { dependency: 'data-engine', check: Effect.void },
    ]))
    expect(liveness.status).toBe(200)
    expect(await liveness.json()).toEqual({ status: 'alive' })
    expect(readiness.status).toBe(503)
    expect(await readiness.json()).toEqual({
      status: 'not-ready',
      failures: [{
        dependency: 'database',
        classification: 'dependency-unavailable',
      }],
    })
  })

  it('reports ready only when every dependency check succeeds', async () => {
    const report = await Effect.runPromise(checkReadiness([
      { dependency: 'database', check: Effect.void },
      { dependency: 'data-engine', check: Effect.void },
    ]))
    expect(report).toEqual({ status: 'ready', failures: [] })
  })

  it('keeps readiness response and telemetry classification aligned', () => {
    const failure = new DependencyReadinessError({
      dependency: 'database',
      classification: 'dependency-unavailable',
      message: 'Database readiness failed',
    })
    expect(classifyTerminalFailure(failure)).toBe('dependency-unavailable')
  })
})
