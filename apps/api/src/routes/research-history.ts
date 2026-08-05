/* eslint-disable no-unused-vars -- Babel's parser does not mark type-only imports as used. */
import { Effect, Schema } from 'effect'
import { DatasetCitation } from '@struct/domain'
import type * as typePersistence from '@struct/persistence'

type ResearchRun = typeof import('@struct/domain').ResearchRun.Type

export const MAX_RESEARCH_HISTORY_RUNS = 100

export const serializeCompletedResearch = (
  result: typePersistence.CompletedResearchProjection,
) => Schema.encode(Schema.Array(DatasetCitation).pipe(Schema.maxItems(80)))(
  result.datasetCitations,
).pipe(Effect.map((datasetCitations) => ({ ...result, datasetCitations })))

export const serializeResearchHistoryRuns = (
  runs: ReadonlyArray<ResearchRun>,
  projections: ReadonlyMap<
    typeof import('@struct/domain').ResearchRunId.Type,
    typePersistence.CompletedResearchProjection
  >,
) => Effect.forEach([...runs].reverse(), (run) => {
  const result = projections.get(run.id)
  const metadata = {
    ...run,
    createdAt: Number(run.createdAt),
    updatedAt: Number(run.updatedAt),
  }
  return result === undefined
    ? Effect.succeed(metadata)
    : serializeCompletedResearch(result).pipe(
      Effect.map((serialized) => ({ ...metadata, result: serialized })),
    )
})

export function researchHistoryResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    headers: {
      'Cache-Control': 'no-store',
      'Content-Type': 'application/json',
    },
  })
}
