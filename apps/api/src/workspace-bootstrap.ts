import { Cause, Effect, Exit } from 'effect'

export interface WorkspaceBootstrapLoopOptions {
  readonly isReady: () => boolean
  readonly markReady: () => void
  readonly retryDelayMs?: number
  readonly logFailure?: (cause: Cause.Cause<unknown>) => void
}

export function workspaceBootstrapLoop(
  ensureApiWorkspace: Effect.Effect<unknown, unknown, never>,
  options: WorkspaceBootstrapLoopOptions,
): Effect.Effect<void, never, never> {
  const retryDelayMs = Math.max(1, options.retryDelayMs ?? 1_000)
  const logFailure = options.logFailure
    ?? ((cause: Cause.Cause<unknown>) => {
      console.error('API workspace bootstrap failed:', Cause.pretty(cause))
    })

  return Effect.gen(function* () {
    while (!options.isReady()) {
      const exit = yield* Effect.exit(ensureApiWorkspace)
      if (Exit.isSuccess(exit)) {
        options.markReady()
        yield* Effect.log('API ready after workspace bootstrap')
        return
      }
      yield* Effect.sync(() => logFailure(exit.cause))
      yield* Effect.sleep(retryDelayMs)
    }
  }).pipe(Effect.interruptible)
}
