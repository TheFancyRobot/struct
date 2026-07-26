import { describe, expect, it } from 'bun:test'
import { Deferred, Effect } from 'effect'
import { workspaceBootstrapLoop } from './workspace-bootstrap'

describe('workspace bootstrap loop', () => {
  it('retries until bootstrap succeeds and marks the API ready', async () => {
    let ready = false
    let attempts = 0

    await Effect.runPromise(workspaceBootstrapLoop(
      Effect.sync(() => {
        attempts += 1
        if (attempts === 1) throw new Error('database unavailable')
      }),
      {
        isReady: () => ready,
        markReady: () => {
          ready = true
        },
        retryDelayMs: 1,
        logFailure: () => undefined,
      },
    ))

    expect(ready).toBe(true)
    expect(attempts).toBe(2)
  })

  it('is interrupted before outer resources release', async () => {
    const events: string[] = []

    await Effect.runPromise(Effect.scoped(Effect.gen(function* () {
      const started = yield* Deferred.make<void>()
      yield* Effect.acquireRelease(
        Effect.void,
        () => Effect.sync(() => {
          events.push('sql closed')
        }),
      )
      const ensureApiWorkspace = Effect.scoped(
        Effect.acquireRelease(
          Effect.sync(() => {
            events.push('probe start')
          }).pipe(Effect.tap(() => Deferred.succeed(started, undefined))),
          () => Effect.sync(() => {
            events.push('probe release')
          }),
        ).pipe(Effect.zipRight(Effect.never)),
      )

      yield* Effect.forkScoped(workspaceBootstrapLoop(ensureApiWorkspace, {
        isReady: () => false,
        markReady: () => undefined,
        retryDelayMs: 1,
        logFailure: () => undefined,
      }))
      yield* Deferred.await(started)
    })))

    expect(events).toEqual(['probe start', 'probe release', 'sql closed'])
  })
})
