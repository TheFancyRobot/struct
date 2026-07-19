import { Deferred, Effect, Either, Ref, TestClock, TestContext } from 'effect'
import { describe, expect, it } from 'bun:test'
import { runWorkerPollLoops } from './polling'

const pollInterval = 100

describe('runWorkerPollLoops', () => {
  it('does not let a long-running research poll delay subsequent ingestion polls', async () => {
    const counts = await Effect.runPromise(
      Effect.scoped(
        Effect.gen(function* () {
          const ingestionCount = yield* Ref.make(0)
          const researchCount = yield* Ref.make(0)
          const researchStarted = yield* Deferred.make<void>()
          const releaseResearch = yield* Deferred.make<void>()

          const ingestionPoll = Ref.update(ingestionCount, (count) => count + 1)
          const researchPoll = Ref.update(researchCount, (count) => count + 1).pipe(
            Effect.zipRight(Deferred.succeed(researchStarted, undefined)),
            Effect.zipRight(Deferred.await(releaseResearch)),
          )

          yield* runWorkerPollLoops(ingestionPoll, researchPoll, pollInterval).pipe(
            Effect.forkScoped,
          )
          yield* Deferred.await(researchStarted)
          yield* Effect.yieldNow()
          yield* TestClock.adjust(pollInterval)

          return {
            ingestion: yield* Ref.get(ingestionCount),
            research: yield* Ref.get(researchCount),
          }
        }),
      ).pipe(Effect.provide(TestContext.TestContext)),
    )

    expect(counts).toEqual({ ingestion: 2, research: 1 })
  })

  it('does not let a long-running ingestion poll delay subsequent research polls', async () => {
    const counts = await Effect.runPromise(
      Effect.scoped(
        Effect.gen(function* () {
          const ingestionCount = yield* Ref.make(0)
          const researchCount = yield* Ref.make(0)
          const ingestionStarted = yield* Deferred.make<void>()
          const releaseIngestion = yield* Deferred.make<void>()

          const ingestionPoll = Ref.update(ingestionCount, (count) => count + 1).pipe(
            Effect.zipRight(Deferred.succeed(ingestionStarted, undefined)),
            Effect.zipRight(Deferred.await(releaseIngestion)),
          )
          const researchPoll = Ref.update(researchCount, (count) => count + 1)

          yield* runWorkerPollLoops(ingestionPoll, researchPoll, pollInterval).pipe(
            Effect.forkScoped,
          )
          yield* Deferred.await(ingestionStarted)
          yield* Effect.yieldNow()
          yield* TestClock.adjust(pollInterval)

          return {
            ingestion: yield* Ref.get(ingestionCount),
            research: yield* Ref.get(researchCount),
          }
        }),
      ).pipe(Effect.provide(TestContext.TestContext)),
    )

    expect(counts).toEqual({ ingestion: 1, research: 2 })
  })

  it('propagates a poll failure and interrupts the sibling loop', async () => {
    const result = await Effect.runPromise(
      Effect.gen(function* () {
        const ingestionStarted = yield* Deferred.make<void>()
        const holdIngestion = yield* Deferred.make<void>()
        const ingestionInterrupted = yield* Ref.make(false)

        const ingestionPoll = Deferred.succeed(ingestionStarted, undefined).pipe(
          Effect.zipRight(Deferred.await(holdIngestion)),
          Effect.onInterrupt(() => Ref.set(ingestionInterrupted, true)),
        )
        const researchPoll = Deferred.await(ingestionStarted).pipe(
          Effect.zipRight(Effect.fail('research poll failed')),
        )

        const exit = yield* runWorkerPollLoops(
          ingestionPoll,
          researchPoll,
          pollInterval,
        ).pipe(Effect.either)

        return {
          exit,
          ingestionInterrupted: yield* Ref.get(ingestionInterrupted),
        }
      }),
    )

    expect(Either.isLeft(result.exit)).toBe(true)
    if (Either.isLeft(result.exit)) {
      expect(result.exit.left).toBe('research poll failed')
    }
    expect(result.ingestionInterrupted).toBe(true)
  })
})
