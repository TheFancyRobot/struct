import { describe, expect, it } from 'bun:test'
import { Duration, Effect, Exit } from 'effect'
import {
  checkReadiness,
  healthResponse,
  readinessResponse,
  withReadinessDeadline,
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

  it('returns a typed timeout when a dependency check stalls', async () => {
    const exit = await Effect.runPromiseExit(withReadinessDeadline(
      'database',
      Effect.never,
      Duration.millis(5),
    ))
    expect(Exit.isFailure(exit)).toBe(true)
    if (Exit.isSuccess(exit)) return
    const failure = exit.cause.pipe(
      (cause) => cause._tag === 'Fail' ? cause.error : undefined,
    )
    expect(failure).toBeInstanceOf(DependencyReadinessError)
    expect(failure).toMatchObject({
      dependency: 'database',
      classification: 'timeout',
    })
  })
})
