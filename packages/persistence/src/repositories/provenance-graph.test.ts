import { describe, expect, it } from 'bun:test'
import {
  ClaimId,
  ContentRevisionId,
  CrossSourceEvidenceId,
  DocumentChunkId,
  DocumentId,
  ProjectId,
  ProvenanceEdgeId,
  ProvenanceGraph,
  ProvenanceGraphId,
  ReportId,
  ResearchRunId,
  SourceVersionId,
  WorkspaceId,
} from '@struct/domain'
import { Effect, Exit, Layer, Schema } from 'effect'
import {
  ProvenanceGraphRepo,
  SqlClient,
} from '../index.js'
import type { SqlClientShape } from '../sql-client.js'

const id = (suffix: string) => `950e8400-e29b-41d4-a716-${suffix.padStart(12, '0')}`
const hash = (character: string) => `sha256:${character.repeat(64)}`
const workspaceId = WorkspaceId.make(id('1'))
const projectId = ProjectId.make(id('2'))
const reportId = ReportId.make(id('3'))
const claimId = ClaimId.make(id('4'))
const revisionId = ContentRevisionId.make(id('5'))
const evidenceId = CrossSourceEvidenceId.make(hash('1'))
const reportEdgeId = ProvenanceEdgeId.make(hash('2'))
const originEdgeId = ProvenanceEdgeId.make(hash('3'))
const evidenceEdgeId = ProvenanceEdgeId.make(hash('4'))

function graph(
  graphId = ProvenanceGraphId.make(id('6')),
  checkedAt = 10n,
  trigger: ProvenanceGraph['trigger'] = { kind: 'publish' },
): ProvenanceGraph {
  return Schema.decodeUnknownSync(Schema.typeSchema(ProvenanceGraph))({
    id: graphId,
    workspaceId,
    projectId,
    reportId,
    reportRevision: 0,
    revalidationKey: 'publish:0',
    trigger,
    edges: [{
      id: reportEdgeId,
      kind: 'report-claim',
      reportId,
      reportRevision: 0,
      claimId,
      claimRevisionId: revisionId,
      claimRevision: 0,
      evidenceMode: 'document',
      expectedEvidenceCount: 1,
    }, {
      id: originEdgeId,
      kind: 'claim-run-output',
      reportId,
      reportRevision: 0,
      claimId,
      claimRevisionId: revisionId,
      claimRevision: 0,
      runId: ResearchRunId.make(id('7')),
    }, {
      id: evidenceEdgeId,
      kind: 'evidence-document',
      reportId,
      reportRevision: 0,
      claimId,
      claimRevisionId: revisionId,
      claimRevision: 0,
      evidenceId,
      chunkId: DocumentChunkId.make(id('8')),
      documentId: DocumentId.make(id('9')),
      sourceVersionId: SourceVersionId.make(id('10')),
      chunkingVersion: 'v1',
      ordinal: 0,
      locator: {
        page: 1,
        section: 'Summary',
        paragraph: 1,
        charStart: 0,
        charEnd: 8,
        byteStart: 0,
        byteEnd: 8,
      },
      citationLocator: 'document:chars:0-8,bytes:0-8',
      excerptHash: hash('5'),
    }],
    validations: [
      [reportEdgeId, null],
      [originEdgeId, null],
      [evidenceEdgeId, evidenceId],
    ].map(([edgeId, targetEvidenceId]) => ({
      claimId,
      edgeId,
      evidenceId: targetEvidenceId,
      reportId,
      reportRevision: 0,
      status: 'valid',
      reason: 'validated',
      checkedAt,
    })),
    createdAt: checkedAt,
  })
}

interface Memory {
  graph: Record<string, unknown> | undefined
  edges: Record<string, unknown>[]
  facts: Record<string, unknown>[]
  failEdgeInsert: boolean
  invalidEdgeRead: boolean
  authorize: boolean
}

function client(memory: Memory): SqlClientShape {
  const unsafe = async (
    query: string,
    params: readonly unknown[] = [],
  ): Promise<readonly Record<string, unknown>[]> => {
    if (query.includes('FROM report_revision_snapshots')) {
      return memory.authorize ? [{ id: reportId }] : []
    }
    if (query.includes('INSERT INTO provenance_graphs')) {
      if (memory.graph !== undefined) return []
      memory.graph = {
        id: params[0],
        workspace_id: params[1],
        project_id: params[2],
        report_id: params[3],
        report_revision: params[4],
        revalidation_key: params[5],
        trigger_snapshot: JSON.parse(String(params[6])),
        graph_hash: params[7],
        created_at: new Date(Number(params[8])),
      }
      return [memory.graph]
    }
    if (query.includes('SELECT * FROM provenance_graphs')) {
      return memory.graph === undefined ? [] : [memory.graph]
    }
    if (query.includes('INSERT INTO provenance_edges')) {
      if (memory.failEdgeInsert) throw new Error('forced edge failure')
      memory.edges.push({
        graph_id: params[0],
        edge_id: params[1],
        claim_id: params[4],
        edge_kind: params[7],
        evidence_id: params[8],
        edge_snapshot: JSON.parse(String(params[9])),
      })
      return []
    }
    if (query.includes('INSERT INTO citation_validation_facts')) {
      const edge = memory.edges.find((item) => item['edge_id'] === params[1])!
      memory.facts.push({
        claim_id: edge['claim_id'],
        edge_id: params[1],
        evidence_id: edge['evidence_id'],
        report_id: params[2],
        report_revision: params[3],
        status: params[4],
        reason: params[5],
        checked_at: new Date(Number(params[6])),
      })
      return []
    }
    if (query.includes('SELECT edge_snapshot')) {
      return memory.invalidEdgeRead
        ? [{ edge_snapshot: { malformed: true } }]
        : memory.edges
    }
    if (query.includes('FROM citation_validation_facts')) return memory.facts
    if (query.includes('SELECT graph.*')) {
      return memory.graph === undefined ? [] : [memory.graph]
    }
    return []
  }
  return {
    unsafe,
    transaction: async (run) => {
      const snapshot = structuredClone(memory)
      try {
        return await run({ unsafe })
      } catch (cause) {
        Object.assign(memory, snapshot)
        throw cause
      }
    },
  }
}

function layer(memory: Memory) {
  return ProvenanceGraphRepo.Default.pipe(
    Layer.provide(Layer.succeed(SqlClient, client(memory))),
  )
}

function emptyMemory(): Memory {
  return {
    graph: undefined,
    edges: [],
    facts: [],
    failEdgeInsert: false,
    invalidEdgeRead: false,
    authorize: true,
  }
}

describe('ProvenanceGraphRepo', () => {
  it('round-trips and replays reordered facts/edges with a new observation time', async () => {
    const memory = emptyMemory()
    const first = graph()
    const stored = await Effect.runPromise(
      ProvenanceGraphRepo.save(first).pipe(Effect.provide(layer(memory))),
    )
    expect(stored).toEqual(first)
    const replayInput = ProvenanceGraph.make({
      ...graph(ProvenanceGraphId.make(id('11')), 99n),
      edges: [...first.edges].reverse(),
      validations: [...graph(ProvenanceGraphId.make(id('11')), 99n).validations]
        .reverse(),
    })
    const replay = await Effect.runPromise(
      ProvenanceGraphRepo.save(replayInput).pipe(Effect.provide(layer(memory))),
    )
    expect(replay.id).toBe(first.id)
    expect(replay.createdAt).toBe(first.createdAt)
    expect(memory.edges).toHaveLength(3)
  })

  it('conflicts when the same revalidation key names a different trigger', async () => {
    const memory = emptyMemory()
    await Effect.runPromise(
      ProvenanceGraphRepo.save(graph()).pipe(Effect.provide(layer(memory))),
    )
    const exit = await Effect.runPromiseExit(
      ProvenanceGraphRepo.save(
        graph(ProvenanceGraphId.make(id('12')), 10n, { kind: 'export' }),
      ).pipe(Effect.provide(layer(memory))),
    )
    expect(Exit.isFailure(exit)).toBe(true)
    if (Exit.isFailure(exit)) {
      expect(exit.cause.toString()).toContain('ProvenanceGraphConflictError')
    }
  })

  it('converges concurrent exact revalidation attempts on one stored graph', async () => {
    const memory = emptyMemory()
    const input = graph()
    const [left, right] = await Promise.all([
      Effect.runPromise(
        ProvenanceGraphRepo.save(input).pipe(Effect.provide(layer(memory))),
      ),
      Effect.runPromise(
        ProvenanceGraphRepo.save(input).pipe(Effect.provide(layer(memory))),
      ),
    ])
    expect(left.id).toBe(right.id)
    expect(memory.edges).toHaveLength(3)
    expect(memory.facts).toHaveLength(3)
  })

  it('rolls back partial writes and denies a foreign scope', async () => {
    const rollback = emptyMemory()
    rollback.failEdgeInsert = true
    const failed = await Effect.runPromiseExit(
      ProvenanceGraphRepo.save(graph()).pipe(Effect.provide(layer(rollback))),
    )
    expect(Exit.isFailure(failed)).toBe(true)
    expect(rollback.graph).toBeUndefined()
    expect(rollback.edges).toHaveLength(0)

    const denied = emptyMemory()
    denied.authorize = false
    const denial = await Effect.runPromiseExit(
      ProvenanceGraphRepo.save(graph()).pipe(Effect.provide(layer(denied))),
    )
    expect(Exit.isFailure(denial)).toBe(true)
    if (Exit.isFailure(denial)) {
      expect(denial.cause.toString()).toContain('ProvenanceGraphScopeError')
    }
  })

  it('returns typed missing-row and malformed-row failures', async () => {
    const missing = emptyMemory()
    const missingExit = await Effect.runPromiseExit(
      ProvenanceGraphRepo.find(workspaceId, projectId, reportId, 0).pipe(
        Effect.provide(layer(missing)),
      ),
    )
    expect(Exit.isFailure(missingExit)).toBe(true)
    if (Exit.isFailure(missingExit)) {
      expect(missingExit.cause.toString()).toContain('ProvenanceGraphScopeError')
    }

    const malformed = emptyMemory()
    await Effect.runPromise(
      ProvenanceGraphRepo.save(graph()).pipe(Effect.provide(layer(malformed))),
    )
    malformed.invalidEdgeRead = true
    const malformedExit = await Effect.runPromiseExit(
      ProvenanceGraphRepo.find(workspaceId, projectId, reportId, 0).pipe(
        Effect.provide(layer(malformed)),
      ),
    )
    expect(Exit.isFailure(malformedExit)).toBe(true)
    if (Exit.isFailure(malformedExit)) {
      expect(malformedExit.cause.toString()).toContain('ProvenanceGraphDecodeError')
    }
  })
})
