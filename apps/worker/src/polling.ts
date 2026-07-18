import { Effect, Schedule } from 'effect'

export const runWorkerPollLoops = <
  IngestionResult,
  IngestionError,
  IngestionRequirements,
  ResearchResult,
  ResearchError,
  ResearchRequirements,
>(
  ingestionPoll: Effect.Effect<IngestionResult, IngestionError, IngestionRequirements>,
  researchPoll: Effect.Effect<ResearchResult, ResearchError, ResearchRequirements>,
  pollMs: number,
) =>
  Effect.all(
    [
      ingestionPoll.pipe(Effect.repeat(Schedule.spaced(`${pollMs} millis`))),
      researchPoll.pipe(Effect.repeat(Schedule.spaced(`${pollMs} millis`))),
    ],
    {
      concurrency: 'unbounded',
      discard: true,
    },
  )
