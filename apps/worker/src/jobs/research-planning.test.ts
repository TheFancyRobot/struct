import { describe, expect, it } from 'bun:test'
import {
  DatasetId,
  DatasetSnapshotId,
  SourceVersionId,
} from '@struct/domain'
import { makeProductionResearchPlanningPolicy } from './research-planning.js'

const sourceVersionId = SourceVersionId.make(
  'ab0e8400-e29b-41d4-a716-446655440001',
)

describe('production research planning policy', () => {
  it('grants exact dataset queries only when resolved lineage includes a dataset snapshot', () => {
    const document = makeProductionResearchPlanningPolicy(
      [{ kind: 'document', sourceVersionId }],
      60_000,
    )
    const dataset = makeProductionResearchPlanningPolicy([{
      kind: 'dataset',
      datasetId: DatasetId.make(
        'ab0e8400-e29b-41d4-a716-446655440002',
      ),
      datasetSnapshotId: DatasetSnapshotId.make(
        'ab0e8400-e29b-41d4-a716-446655440003',
      ),
      sourceVersionIds: [sourceVersionId],
    }], 60_000)

    expect(document.toolPolicy.grants.map((grant) => grant.toolId))
      .not.toContain('dataset-query')
    expect(dataset.toolPolicy.grants).toContainEqual({
      toolId: 'dataset-query',
      capability: 'dataset:query',
      maximumCalls: 1,
    })
    expect(dataset.budgetCeiling.maximumToolCalls).toBe(4)
  })

  it('grants recursive analysis only for an explicit recursive source scope', () => {
    const recursive = makeProductionResearchPlanningPolicy([{
      kind: 'recursive',
      sourceVersionIds: [
        sourceVersionId,
        SourceVersionId.make('ab0e8400-e29b-41d4-a716-446655440004'),
      ],
    }], 60_000)

    expect(recursive.toolPolicy.grants).toContainEqual({
      toolId: 'recursive-analysis',
      capability: 'recursive:analyze',
      maximumCalls: 1,
    })
    expect(recursive.budgetCeiling.maximumToolCalls).toBe(4)
  })
})
