import { Effect, Schema } from 'effect'
import { DatasetCitation } from '@struct/domain'
import type { CompletedResearchProjection } from '@struct/persistence'

export const serializeCompletedResearch = (
  result: CompletedResearchProjection,
) => Schema.encode(Schema.Array(DatasetCitation).pipe(Schema.maxItems(80)))(
  result.datasetCitations,
).pipe(Effect.map((datasetCitations) => ({ ...result, datasetCitations })))

export function researchHistoryResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    headers: {
      'Cache-Control': 'no-store',
      'Content-Type': 'application/json',
    },
  })
}
