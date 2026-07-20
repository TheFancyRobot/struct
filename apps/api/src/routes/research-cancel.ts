import { Effect } from 'effect'
import type {
  EventJournalId,
  ProjectId,
  ResearchRunId,
  WorkspaceId,
} from '@struct/domain'
import type * as typePersistence from '@struct/persistence'

export interface ResearchCancellationScope {
  readonly workspaceId: WorkspaceId
  readonly projectId: ProjectId
  readonly runId: ResearchRunId
}

export interface ResearchCancelDeps {
  readonly now: () => bigint
  readonly randomEventId: () => EventJournalId
  readonly request: (
    input: typePersistence.CancelResearchInput,
  ) => Effect.Effect<
    typePersistence.CancelResearchResult,
    typePersistence.ResearchExecutionError,
    never
  >
}

export const cancelResearch = Effect.fn('ResearchRoute.cancel')(
  function* (
    scope: ResearchCancellationScope,
    idempotencyKey: string,
    deps: ResearchCancelDeps,
  ) {
    return yield* deps.request({
      ...scope,
      idempotencyKey,
      eventId: deps.randomEventId(),
      createdAt: deps.now(),
    })
  },
)
