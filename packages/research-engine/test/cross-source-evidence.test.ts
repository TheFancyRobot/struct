import { describe, expect, it } from 'bun:test'
import {
  DATA_ENGINE_VERSION,
  DatasetCitationId,
  DatasetId,
  DatasetSnapshotId,
  DocumentChunkId,
  DocumentId,
  ProjectId,
  QueryResultSnapshotId,
  Sha256Digest,
  SourceVersionId,
  WorkspaceId,
  type CrossSourceEvidenceInput,
  type CrossSourceMismatch,
  type CrossSourceSemantics,
  type DatasetCitationEvidence,
} from '@struct/domain'
import { Effect } from 'effect'
import {
  computeCrossSourceEvidenceId,
  normalizeCrossSourceEvidence,
} from '../src/normalize-evidence.js'
import { computeRecursiveEvidenceId } from '../src/aggregation-schema.js'
import {
  computeCrossSourceReconciliationId,
  reconcileCrossSourceEvidence,
} from '../src/reconcile-findings.js'

const workspaceId = WorkspaceId.make('970e8400-e29b-41d4-a716-446655440001')
const projectId = ProjectId.make('970e8400-e29b-41d4-a716-446655440002')
const sourceVersionId = SourceVersionId.make(
  '970e8400-e29b-41d4-a716-446655440003',
)
const foreignSourceVersionId = SourceVersionId.make(
  '970e8400-e29b-41d4-a716-446655440004',
)
const claimSignature = Sha256Digest.make(`sha256:${'a'.repeat(64)}`)
const datasetId = DatasetId.make(
  '970e8400-e29b-41d4-a716-446655440005',
)
const datasetSnapshotId = DatasetSnapshotId.make(
  '970e8400-e29b-41d4-a716-446655440006',
)
const scope = {
  workspaceId,
  projectId,
  sourceVersionIds: [sourceVersionId],
  datasetSnapshots: [{ datasetId, datasetSnapshotId }],
}
const policy = {
  requiredEvidenceKinds: ['document', 'dataset'] as const,
  authorizedJoinKeys: [],
}
const semantics: CrossSourceSemantics = {
  unit: 'requests',
  timeWindow: {
    startInclusive: '2026-01-01T00:00:00Z',
    endExclusive: '2026-02-01T00:00:00Z',
    timezone: 'UTC',
  },
  version: '2026-01',
  filters: [{ field: 'region', operator: 'eq', value: 'north' }],
  cohort: 'all active accounts',
  denominator: 'active accounts',
  joinKeys: [],
}

function datasetEvidence(): DatasetCitationEvidence {
  const snapshotId = QueryResultSnapshotId.make(
    '970e8400-e29b-41d4-a716-446655440007',
  )
  const schemaHash = Sha256Digest.make(`sha256:${'b'.repeat(64)}`)
  const resultHash = Sha256Digest.make(`sha256:${'c'.repeat(64)}`)
  const resultArtifactHash = Sha256Digest.make(`sha256:${'d'.repeat(64)}`)
  const canonicalSql = 'SELECT total FROM monthly_requests ORDER BY ALL'
  const columns = [{ ordinal: 0, name: 'total', type: 'BIGINT' }]
  const rows = [['42']]
  const snapshot = {
    id: snapshotId,
    workspaceId,
    projectId,
    requestHash: Sha256Digest.make(`sha256:${'e'.repeat(64)}`),
    protocolVersion: '1' as const,
    engineVersion: DATA_ENGINE_VERSION,
    engineAdapterVersion: '@duckdb/node-api@1.5.4-r.1' as const,
    executionPolicyVersion: 1 as const,
    engineConfigHash: Sha256Digest.make(`sha256:${'f'.repeat(64)}`),
    canonicalSql,
    snapshots: [{
      alias: 'monthly_requests',
      datasetId,
      snapshotId: datasetSnapshotId,
      schemaHash,
      parquetDigest: '1'.repeat(64),
    }],
    schemaHash,
    resultHash,
    resultArtifactHash,
    columns,
    rows,
    rowCount: 1,
    truncated: false,
    executedAt: 1n,
    createdAt: 1n,
  }
  return {
    citation: {
      id: DatasetCitationId.make(
        '970e8400-e29b-41d4-a716-446655440008',
      ),
      queryResultSnapshotId: snapshotId,
      workspaceId,
      projectId,
      datasetId,
      datasetSnapshotId,
      schemaHash,
      parquetDigest: '1'.repeat(64),
      resultHash,
      resultArtifactHash,
      canonicalSql,
      selectedColumns: ['total'],
      rowStart: 0,
      rowEndExclusive: 1,
      createdAt: 1n,
    },
    snapshot,
    columns,
    rows,
  }
}

function documentInput(
  patch: Partial<CrossSourceEvidenceInput> = {},
): CrossSourceEvidenceInput {
  return {
    claimSignature,
    stance: 'supports',
    semantics,
    payload: {
      kind: 'document',
      chunkId: DocumentChunkId.make(
        '970e8400-e29b-41d4-a716-446655440009',
      ),
      documentId: DocumentId.make(
        '970e8400-e29b-41d4-a716-446655440010',
      ),
      sourceVersionId,
      chunkingVersion: 'fragments-v1',
      ordinal: 0,
      locator: {
        page: 1,
        section: 'Monthly summary',
        paragraph: 2,
        charStart: 10,
        charEnd: 31,
        byteStart: 10,
        byteEnd: 31,
      },
      citationLocator:
        'document:section:Monthly%20summary,paragraph:2,page:1,chars:10-31,bytes:10-31',
      excerpt: 'There were 42 requests.',
      trust: 'untrusted-evidence',
    },
    limitations: ['Document reports the published total.'],
    ...patch,
  }
}

function datasetInput(
  patch: Partial<CrossSourceEvidenceInput> = {},
): CrossSourceEvidenceInput {
  return {
    claimSignature,
    stance: 'supports',
    semantics,
    payload: {
      kind: 'dataset',
      evidence: datasetEvidence(),
      exactness: 'exact-immutable-query-result',
    },
    limitations: [],
    ...patch,
  }
}

function documentPayload(): Extract<
  CrossSourceEvidenceInput['payload'],
  { readonly kind: 'document' }
> {
  const payload = documentInput().payload
  if (payload.kind !== 'document') {
    throw new Error('test fixture must be document evidence')
  }
  return payload
}

describe('cross-source evidence normalization and reconciliation', () => {
  it('preserves mixed provenance and exact values with stable order and IDs', async () => {
    const document = documentInput()
    const documentVariant = documentInput({
      limitations: ['Additional document limitation.'],
    })
    const dataset = datasetInput()
    const forward = await Effect.runPromise(
      normalizeCrossSourceEvidence(
        [document, dataset, documentVariant, document],
        scope,
      ),
    )
    const reverse = await Effect.runPromise(
      normalizeCrossSourceEvidence(
        [documentVariant, dataset, document],
        scope,
      ),
    )
    expect(reverse).toEqual(forward)
    expect(forward).toHaveLength(2)
    expect(forward.find((item) => item.payload.kind === 'document'))
      ?.toMatchObject({
        payload: { excerpt: 'There were 42 requests.' },
        limitations: [
          'Additional document limitation.',
          'Document reports the published total.',
        ],
      })
    expect(forward.find((item) => item.payload.kind === 'dataset'))
      ?.toMatchObject({
        payload: {
          evidence: {
            citation: {
              canonicalSql:
                'SELECT total FROM monthly_requests ORDER BY ALL',
              rowStart: 0,
              rowEndExclusive: 1,
            },
            rows: [['42']],
          },
        },
      })

    const result = await Effect.runPromise(
      reconcileCrossSourceEvidence(claimSignature, forward, policy),
    )
    expect(result.status).toBe('aligned')
    expect(result.id).toBe(computeCrossSourceReconciliationId(result))
    expect(result.evidence.every((item) =>
      item.id === computeCrossSourceEvidenceId(item))).toBe(true)

    const canonicalInput = {
      ...document,
      semantics: {
        ...document.semantics,
        filters: [
          ...document.semantics.filters,
          { field: 'tier', operator: 'eq' as const, value: 'enterprise' },
        ],
        joinKeys: ['workspace_id', 'account_id'],
      },
    }
    const reorderedSemantics = {
      ...canonicalInput,
      semantics: {
        ...canonicalInput.semantics,
        filters: [...canonicalInput.semantics.filters].reverse(),
        joinKeys: [...canonicalInput.semantics.joinKeys].reverse(),
      },
    }
    expect(computeCrossSourceEvidenceId(reorderedSemantics))
      .toBe(computeCrossSourceEvidenceId(canonicalInput))
  })

  it('discloses semantic mismatches without changing exact evidence', async () => {
    const normalized = await Effect.runPromise(normalizeCrossSourceEvidence([
      documentInput(),
      datasetInput({
        semantics: {
          ...semantics,
          unit: 'incidents',
          denominator: 'all accounts',
        },
      }),
    ], scope))
    const result = await Effect.runPromise(
      reconcileCrossSourceEvidence(claimSignature, normalized, policy),
    )
    expect(result.status).toBe('disclosed-mismatch')
    expect(result.mismatches.map((item) => item.dimension)).toEqual([
      'unit',
      'denominator',
    ])
    expect(result.evidence.find((item) => item.payload.kind === 'dataset'))
      ?.toMatchObject({ payload: { evidence: { rows: [['42']] } } })
  })

  it('does not confuse established values with missing-value labels', async () => {
    const missingSemantics: CrossSourceSemantics = {
      ...semantics,
      unit: null,
      version: null,
      joinKeys: [],
    }
    const labelSemantics: CrossSourceSemantics = {
      ...semantics,
      unit: 'not-established',
      version: 'not-established',
      joinKeys: ['none'],
    }
    const normalized = await Effect.runPromise(normalizeCrossSourceEvidence([
      documentInput({ semantics: missingSemantics }),
      datasetInput({ semantics: labelSemantics }),
    ], scope))
    const result = await Effect.runPromise(reconcileCrossSourceEvidence(
      claimSignature,
      normalized,
      { ...policy, authorizedJoinKeys: ['none'] },
    ))
    expect(result.mismatches.map((item) => item.dimension)).toEqual([
      'unit',
      'version',
      'join-keys',
    ])
  })

  it('deterministically discloses every comparison dimension', async () => {
    const scenarios: ReadonlyArray<{
      readonly dimension: CrossSourceMismatch['dimension']
      readonly patch: Partial<CrossSourceSemantics>
      readonly authorizedJoinKeys?: ReadonlyArray<string>
    }> = [
      { dimension: 'unit', patch: { unit: 'incidents' } },
      {
        dimension: 'time-window',
        patch: {
          timeWindow: {
            startInclusive: '2026-01-01T00:00:00Z',
            endExclusive: '2026-02-01T00:00:00Z',
            timezone: 'America/Chicago',
          },
        },
      },
      { dimension: 'version', patch: { version: '2026-02' } },
      {
        dimension: 'filters',
        patch: {
          filters: [{ field: 'region', operator: 'eq', value: 'south' }],
        },
      },
      { dimension: 'cohort', patch: { cohort: 'enterprise accounts' } },
      { dimension: 'denominator', patch: { denominator: 'all accounts' } },
      {
        dimension: 'join-keys',
        patch: { joinKeys: ['account_id'] },
        authorizedJoinKeys: ['account_id'],
      },
    ]
    for (const scenario of scenarios) {
      const normalized = await Effect.runPromise(normalizeCrossSourceEvidence([
        documentInput(),
        datasetInput({ semantics: { ...semantics, ...scenario.patch } }),
      ], scope))
      const result = await Effect.runPromise(reconcileCrossSourceEvidence(
        claimSignature,
        normalized,
        {
          ...policy,
          authorizedJoinKeys: scenario.authorizedJoinKeys ?? [],
        },
      ))
      expect(result.status).toBe('disclosed-mismatch')
      expect(result.mismatches.map((item) => item.dimension))
        .toEqual([scenario.dimension])
    }
  })

  it('retains contradictions and cannot report them as sufficient', async () => {
    const normalized = await Effect.runPromise(normalizeCrossSourceEvidence([
      documentInput(),
      datasetInput({ stance: 'conflicts' }),
    ], scope))
    const result = await Effect.runPromise(
      reconcileCrossSourceEvidence(claimSignature, normalized, policy),
    )
    expect(result.status).toBe('contradictory')
    expect(result.conflicts).toHaveLength(1)
    expect(result.conflicts[0]?.supportingEvidence).toHaveLength(1)
    expect(result.conflicts[0]?.conflictingEvidence).toHaveLength(1)
  })

  it('rejects foreign document provenance and forged dataset rows', async () => {
    const foreign = documentInput({
      payload: {
        ...documentPayload(),
        sourceVersionId: foreignSourceVersionId,
      },
    })
    expect(await Effect.runPromise(Effect.either(
      normalizeCrossSourceEvidence([foreign], scope),
    ))).toMatchObject({ _tag: 'Left' })
    expect(await Effect.runPromise(Effect.either(
      normalizeCrossSourceEvidence([documentInput({
        payload: {
          ...documentPayload(),
          citationLocator: 'document:page:99,chars:0-1,bytes:0-1',
        },
      })], scope),
    ))).toMatchObject({ _tag: 'Left' })

    const forged = datasetInput()
    if (forged.payload.kind !== 'dataset') {
      throw new Error('test fixture must be dataset evidence')
    }
    const forgedRows = {
      ...forged,
      payload: {
        ...forged.payload,
        evidence: { ...forged.payload.evidence, rows: [['43']] },
      },
    }
    expect(await Effect.runPromise(Effect.either(
      normalizeCrossSourceEvidence([forgedRows], scope),
    ))).toMatchObject({ _tag: 'Left' })

    const foreignSnapshotId = DatasetSnapshotId.make(
      '970e8400-e29b-41d4-a716-446655440011',
    )
    const foreignSnapshot = datasetInput()
    if (foreignSnapshot.payload.kind !== 'dataset') {
      throw new Error('test fixture must be dataset evidence')
    }
    const foreignSnapshotEvidence = {
      ...foreignSnapshot,
      payload: {
        ...foreignSnapshot.payload,
        evidence: {
          ...foreignSnapshot.payload.evidence,
          citation: {
            ...foreignSnapshot.payload.evidence.citation,
            datasetSnapshotId: foreignSnapshotId,
          },
          snapshot: {
            ...foreignSnapshot.payload.evidence.snapshot,
            snapshots: foreignSnapshot.payload.evidence.snapshot.snapshots.map(
              (binding) => ({ ...binding, snapshotId: foreignSnapshotId }),
            ),
          },
        },
      },
    }
    expect(await Effect.runPromise(Effect.either(
      normalizeCrossSourceEvidence([foreignSnapshotEvidence], scope),
    ))).toMatchObject({ _tag: 'Left' })
  })

  it('preserves exact recursive artifact provenance and rejects foreign lineage', async () => {
    const referenceBase = {
      sourceVersionId,
      artifact: {
        digest: Sha256Digest.make(`sha256:${'8'.repeat(64)}`),
        byteLength: 128,
        mediaType: 'application/json',
      },
      locator: '/reports/monthly.json#/summary',
    }
    const recursive = {
      claimSignature,
      stance: 'supports' as const,
      semantics,
      payload: {
        kind: 'recursive' as const,
        reference: {
          ...referenceBase,
          id: computeRecursiveEvidenceId(referenceBase),
        },
        excerpt: 'Directory summary reports 42 requests.',
        trust: 'untrusted-evidence' as const,
      },
      limitations: [],
    }
    const normalized = await Effect.runPromise(
      normalizeCrossSourceEvidence([recursive], scope),
    )
    expect(normalized[0]).toMatchObject({
      payload: {
        reference: {
          sourceVersionId,
          artifact: {
            digest: referenceBase.artifact.digest,
            byteLength: 128,
          },
          locator: referenceBase.locator,
        },
      },
    })
    expect(await Effect.runPromise(Effect.either(
      normalizeCrossSourceEvidence([{
        ...recursive,
        payload: {
          ...recursive.payload,
          reference: {
            ...recursive.payload.reference,
            sourceVersionId: foreignSourceVersionId,
          },
        },
      }], scope),
    ))).toMatchObject({ _tag: 'Left' })
  })

  it('reports partial evidence as insufficient and rejects unsupported joins', async () => {
    const partial = await Effect.runPromise(
      normalizeCrossSourceEvidence([documentInput()], scope),
    )
    const insufficient = await Effect.runPromise(
      reconcileCrossSourceEvidence(claimSignature, partial, policy),
    )
    expect(insufficient.status).toBe('insufficient')
    expect(insufficient.limitations).toContain(
      'Missing required dataset evidence.',
    )

    const joined = await Effect.runPromise(normalizeCrossSourceEvidence([
      documentInput({
        semantics: { ...semantics, joinKeys: ['account_id'] },
      }),
      datasetInput({
        semantics: { ...semantics, joinKeys: ['account_id'] },
      }),
    ], scope))
    const rejected = await Effect.runPromise(
      reconcileCrossSourceEvidence(claimSignature, joined, policy),
    )
    expect(rejected.status).toBe('rejected')
    expect(rejected.limitations).toContain(
      'Unsupported join key: account_id.',
    )

    const contradictoryJoin = await Effect.runPromise(
      normalizeCrossSourceEvidence([
        documentInput({
          semantics: { ...semantics, joinKeys: ['account_id'] },
        }),
        datasetInput({
          stance: 'conflicts',
          semantics: { ...semantics, joinKeys: ['account_id'] },
        }),
      ], scope),
    )
    const rejectedContradiction = await Effect.runPromise(
      reconcileCrossSourceEvidence(
        claimSignature,
        contradictoryJoin,
        policy,
      ),
    )
    expect(rejectedContradiction.status).toBe('rejected')
    expect(rejectedContradiction.conflicts).toHaveLength(1)
  })

  it('rejects forged normalized identities and foreign claim lineage', async () => {
    const normalized = await Effect.runPromise(
      normalizeCrossSourceEvidence([documentInput(), datasetInput()], scope),
    )
    expect(await Effect.runPromise(Effect.either(
      reconcileCrossSourceEvidence(claimSignature, [
        { ...normalized[0]!, id: normalized[1]!.id },
        normalized[1]!,
      ], policy),
    ))).toMatchObject({ _tag: 'Left' })

    const foreignClaim = Sha256Digest.make(`sha256:${'9'.repeat(64)}`)
    expect(await Effect.runPromise(Effect.either(
      reconcileCrossSourceEvidence(foreignClaim, normalized, policy),
    ))).toMatchObject({ _tag: 'Left' })
  })
})
