import { Effect } from 'effect'
import {
  type DirectoryIngestionJobStatus,
  InvalidDirectoryIngestionTransitionError,
  transitionDirectoryIngestionJob,
} from '@struct/domain'

export interface DirectoryIngestionJobState {
  readonly status: DirectoryIngestionJobStatus
  readonly attempts: number
  readonly maxAttempts: number
}

export function applyDirectoryIngestionTransition(
  state: DirectoryIngestionJobState,
  transition: Parameters<typeof transitionDirectoryIngestionJob>[1],
): Effect.Effect<
  DirectoryIngestionJobState,
  InvalidDirectoryIngestionTransitionError
> {
  if (transition === 'retry' && state.attempts >= state.maxAttempts) {
    return Effect.fail(new InvalidDirectoryIngestionTransitionError({
      current: state.status,
      transition,
      message: 'Cannot retry a directory ingestion job with an exhausted attempt budget',
    }))
  }
  return transitionDirectoryIngestionJob(state.status, transition).pipe(
    Effect.map((status) => ({ ...state, status })),
  )
}
