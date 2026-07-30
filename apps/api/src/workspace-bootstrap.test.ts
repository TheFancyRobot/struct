import { describe, expect, it } from 'bun:test'
import { Deferred, Effect, Fiber } from 'effect'
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

  // BUG-0060: project creation must wait for workspace readiness, not race the
  // bootstrap. The loop's markReady must fire exactly when bootstrap succeeds,
  // releasing an awaiter; an in-progress bootstrap must keep awaiters blocked.
  it('releases a readiness awaiter only after markReady fires', async () => {
    let ready = false
    const workspaceReady = await Effect.runPromise(Deferred.make<void>())
    let awaiterResolved = false

    const fiber = Effect.runFork(
      Deferred.await(workspaceReady).pipe(
        Effect.tap(() => {
          awaiterResolved = true
        }),
      ),
    )

    await Effect.runPromise(Effect.sleep(10))
    expect(awaiterResolved).toBe(false)
    expect(ready).toBe(false)

    await Effect.runPromise(workspaceBootstrapLoop(
      Effect.sync(() => undefined),
      {
        isReady: () => ready,
        markReady: () => {
          ready = true
          Deferred.unsafeDone(workspaceReady, Effect.void)
        },
        retryDelayMs: 1,
        logFailure: () => undefined,
      },
    ))

    await Effect.runPromise(Fiber.join(fiber))
    expect(ready).toBe(true)
    expect(awaiterResolved).toBe(true)
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
