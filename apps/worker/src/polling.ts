import { Effect, Schedule } from 'effect'

export const runWorkerPollLoops = <
  IngestionResult,
  IngestionError,
  IngestionRequirements,
  ResearchResult,
  ResearchError,
  ResearchRequirements,
  ReindexResult = never,
  ReindexError = never,
  ReindexRequirements = never,
  DatasetMaterializationResult = never,
  DatasetMaterializationError = never,
  DatasetMaterializationRequirements = never,
>(
  ingestionPoll: Effect.Effect<IngestionResult, IngestionError, IngestionRequirements>,
  researchPoll: Effect.Effect<ResearchResult, ResearchError, ResearchRequirements>,
  pollMs: number,
  reindexPoll?: Effect.Effect<ReindexResult, ReindexError, ReindexRequirements>,
  datasetMaterializationPoll?: Effect.Effect<
    DatasetMaterializationResult,
    DatasetMaterializationError,
    DatasetMaterializationRequirements
  >,
) =>
  Effect.all(
    [
      ingestionPoll.pipe(Effect.repeat(Schedule.spaced(`${pollMs} millis`))),
      researchPoll.pipe(Effect.repeat(Schedule.spaced(`${pollMs} millis`))),
      ...(reindexPoll
        ? [reindexPoll.pipe(Effect.repeat(Schedule.spaced(`${pollMs} millis`)))]
        : []),
      ...(datasetMaterializationPoll
        ? [
            datasetMaterializationPoll.pipe(
              Effect.repeat(Schedule.spaced(`${pollMs} millis`)),
            ),
          ]
        : []),
    ],
    {
      concurrency: 'unbounded',
      discard: true,
    },
  )
