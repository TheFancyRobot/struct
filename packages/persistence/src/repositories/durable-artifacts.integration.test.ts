import {
  ActorId,
  CitationId,
  Claim,
  ClaimId,
  ContentRevisionId,
  Finding,
  FindingId,
  ProjectId,
  ProvenanceEdgeId,
  ProvenanceGraph,
  ProvenanceGraphId,
  Report,
  ReportId,
  ReportSection,
  ReportSectionId,
  ResearchRunId,
  SourceVersionId,
  WorkspaceId,
} from '@struct/domain'
import {
  afterAll,
  beforeAll,
  describe,
  expect,
  it,
} from 'bun:test'
import { Cause, Effect, Exit, Layer, Option, Schema } from 'effect'
import postgres from 'postgres'
import {
  DurableArtifactsRepo,
  ProvenanceGraphRepo,
  SqlClient,
} from '../index.js'
import type { SqlExecutorShape } from '../sql-client.js'

const DATABASE_URL = process.env['DATABASE_URL']
const describeIf = DATABASE_URL ? describe : describe.skip
const namespace = crypto.randomUUID().replaceAll('-', '').slice(0, 8)
const uuid = (suffix: string) =>
  `e80e8400-e29b-41d4-a716-${namespace}${suffix.padStart(4, '0')}`
const hash = (character: string) => `sha256:${character.repeat(64)}`
const workspaceId = WorkspaceId.make(uuid('1'))
const projectId = ProjectId.make(uuid('2'))
const runId = ResearchRunId.make(uuid('3'))
const sourceVersionId = SourceVersionId.make(uuid('4'))
const answer = 'Persisted completed output'

let sql: ReturnType<typeof postgres>
let artifactLayer: Layer.Layer<DurableArtifactsRepo>
let graphLayer: Layer.Layer<ProvenanceGraphRepo>

function finding(suffix: string): Finding {
  const citationId = CitationId.make(uuid(`${suffix}10`))
  const claimId = ClaimId.make(uuid(`${suffix}11`))
  return Schema.decodeUnknownSync(Schema.typeSchema(Finding))({
    id: FindingId.make(uuid(`${suffix}12`)),
    workspaceId,
    projectId,
    runId,
    sourceVersionIds: [sourceVersionId],
    titleRevisions: [{
      id: ContentRevisionId.make(uuid(`${suffix}13`)),
      revision: 0,
      content: `Finding ${suffix}`,
      authorship: {
        kind: 'generated',
        runId,
        model: 'integration',
        promptVersion: 'v1',
      },
      idempotencyKey: `title:${suffix}`,
      createdAt: 1n,
    }],
    currentRevision: 0,
    claims: [{
      id: claimId,
      claimSignature: hash(suffix),
      citation: {
        citationId,
        state: 'draft',
        revision: 0,
        supersededBy: null,
        lastIdempotencyKey: null,
        updatedAt: 1n,
      },
      origin: { kind: 'research-run', runId },
      revisions: [{
        id: ContentRevisionId.make(uuid(`${suffix}14`)),
        revision: 0,
        content: answer,
        authorship: {
          kind: 'generated',
          runId,
          model: 'integration',
          promptVersion: 'v1',
        },
        idempotencyKey: `claim:${suffix}`,
        createdAt: 1n,
      }],
      currentRevision: 0,
      support: {
        kind: 'unsupported',
        reason: 'Durable evidence validation required',
      },
      createdAt: 1n,
    }],
    supersededBy: null,
    createdAt: 1n,
    updatedAt: 1n,
  })
}

function report(first: Finding, second: Finding): Report {
  return Schema.decodeUnknownSync(Schema.typeSchema(Report))({
    id: ReportId.make(uuid('20')),
    workspaceId,
    projectId,
    runId,
    sourceVersionIds: [sourceVersionId],
    findingIds: [first.id, second.id],
    titleRevisions: [{
      id: ContentRevisionId.make(uuid('21')),
      revision: 0,
      content: 'Integration report',
      authorship: {
        kind: 'generated',
        runId,
        model: 'integration',
        promptVersion: 'v1',
      },
      idempotencyKey: 'compose:report',
      createdAt: 2n,
    }],
    currentTitleRevision: 0,
    claims: [...first.claims, ...second.claims],
    sections: [{
      id: ReportSectionId.make(uuid('22')),
      ordinal: 0,
      heading: 'First',
      revisions: [{
        id: ContentRevisionId.make(uuid('23')),
        revision: 0,
        content: answer,
        authorship: {
          kind: 'generated',
          runId,
          model: 'integration',
          promptVersion: 'v1',
        },
        idempotencyKey: 'compose:first',
        createdAt: 2n,
      }],
      currentRevision: 0,
      findingIds: [first.id],
      claimIds: first.claims.map((claim) => claim.id),
      lastRegenerationKey: null,
    }, {
      id: ReportSectionId.make(uuid('24')),
      ordinal: 1,
      heading: 'Second',
      revisions: [{
        id: ContentRevisionId.make(uuid('25')),
        revision: 0,
        content: answer,
        authorship: {
          kind: 'generated',
          runId,
          model: 'integration',
          promptVersion: 'v1',
        },
        idempotencyKey: 'compose:second',
        createdAt: 2n,
      }],
      currentRevision: 0,
      findingIds: [second.id],
      claimIds: second.claims.map((claim) => claim.id),
      lastRegenerationKey: null,
    }],
    revision: 0,
    publicationState: 'draft',
    supersededBy: null,
    lastPublicationKey: null,
    createdAt: 2n,
    updatedAt: 2n,
  })
}

function editFirstSection(
  current: Report,
  claims: ReadonlyArray<Claim> = current.claims,
): Report {
  const first = current.sections[0]!
  return Schema.decodeUnknownSync(Schema.typeSchema(Report))({
    ...current,
    claims,
    sections: [{
      ...first,
      revisions: [...first.revisions, {
        id: ContentRevisionId.make(uuid('31')),
        revision: 1,
        content: 'User edit',
        authorship: {
          kind: 'user',
          actorId: ActorId.make(uuid('32')),
        },
        idempotencyKey: 'edit:first',
        createdAt: 4n,
      }],
      currentRevision: 1,
      lastRegenerationKey: 'edit:first',
    }, current.sections[1]!],
    revision: 1,
    updatedAt: 4n,
  })
}

async function seedFixture(executor: SqlExecutorShape) {
  await executor.unsafe(
    'INSERT INTO workspaces (id, name) VALUES ($1, $2)',
    [workspaceId, 'artifact integration'],
  )
  await executor.unsafe(
    'INSERT INTO projects (id, workspace_id, name) VALUES ($1, $2, $3)',
    [projectId, workspaceId, 'artifact integration'],
  )
  await executor.unsafe(
    'INSERT INTO sources (id, project_id, name, kind) VALUES ($1, $2, $3, $4)',
    [uuid('5'), projectId, 'source', 'document'],
  )
  await executor.unsafe(
    `INSERT INTO source_versions (
       id, source_id, version, artifact_ref, content_hash
     ) VALUES ($1, $2, $3, $4, $5)`,
    [sourceVersionId, uuid('5'), 1, 'sha256:fixture', 'fixture'],
  )
  await executor.unsafe(
    'INSERT INTO research_threads (id, project_id, title) VALUES ($1, $2, $3)',
    [uuid('6'), projectId, 'thread'],
  )
  await executor.unsafe(
    `INSERT INTO research_runs (id, thread_id, question, status)
     VALUES ($1, $2, $3, $4)`,
    [runId, uuid('6'), 'question', 'completed'],
  )
  await executor.unsafe(
    `INSERT INTO research_run_results (run_id, answer, citations)
     VALUES ($1, $2, '[]'::jsonb)`,
    [runId, answer],
  )
  for (const suffix of ['1', '2', '3', '4']) {
    await executor.unsafe(
      `INSERT INTO citations (
         id, run_id, source_version_id, locator, status
       ) VALUES ($1, $2, $3, $4, $5)`,
      [
        uuid(`${suffix}10`),
        runId,
        sourceVersionId,
        'lines:1-1',
        'validated',
      ],
    )
  }
}

const Rollback = new Error('rollback durable artifact integration fixture')

async function withFixture(run: (sql: SqlExecutorShape) => Promise<void>) {
  let testFailure: unknown
  try {
    await sql.begin(async (transaction) => {
      const toExecutor = (
        client: Pick<typeof transaction, 'unsafe'>,
      ): SqlExecutorShape => ({
        unsafe: (query, params) =>
          client.unsafe(query, params as any[]).then((rows) =>
            rows as readonly Record<string, unknown>[]),
      })
      const executor = toExecutor(transaction)
      const transact = async <A>(
        operation: (sql: SqlExecutorShape) => Promise<A>,
      ): Promise<A> =>
        await transaction.savepoint(
          (nested) => operation(toExecutor(nested)),
        ) as A
      const sqlLayer = Layer.succeed(SqlClient, {
        ...executor,
        transaction: transact,
      })
      artifactLayer = Layer.provide(DurableArtifactsRepo.Default, sqlLayer)
      graphLayer = Layer.provide(ProvenanceGraphRepo.Default, sqlLayer)
      await seedFixture(executor)
      try {
        await run(executor)
      } catch (error) {
        testFailure = error
      }
      throw Rollback
    })
  } catch (error) {
    if (error !== Rollback) throw error
  }
  if (testFailure !== undefined) throw testFailure
}

beforeAll(async () => {
  if (!DATABASE_URL) return
  sql = postgres(DATABASE_URL, { max: 3, idle_timeout: 5 })
})

afterAll(async () => {
  if (DATABASE_URL) await sql.end({ timeout: 5 })
})

describeIf('DurableArtifactsRepo with PostgreSQL', () => {
  it('rejects any immutable claim replay drift', async () => withFixture(async () => {
    const base = finding('1')
    await Effect.runPromise(
      DurableArtifactsRepo.saveFinding(base, 'save:base').pipe(
        Effect.provide(artifactLayer),
      ),
    )
    const replay = await Effect.runPromise(
      DurableArtifactsRepo.saveFinding(base, 'save:base').pipe(
        Effect.provide(artifactLayer),
      ),
    )
    expect(replay).toEqual(base)

    const variants = [
      {
        ...base.claims[0]!,
        citation: { ...base.claims[0]!.citation, state: 'valid' as const },
      },
      {
        ...base.claims[0]!,
        revisions: [{
          ...base.claims[0]!.revisions[0]!,
          authorship: {
            kind: 'user' as const,
            actorId: ActorId.make(uuid('90')),
          },
        }],
      },
      {
        ...base.claims[0]!,
        support: {
          kind: 'supported' as const,
          mode: 'document' as const,
          evidence: [{
            id: hash('9'),
            claimSignature: base.claims[0]!.claimSignature,
            stance: 'supports' as const,
            semantics: {
              unit: null,
              timeWindow: null,
              version: 'v1',
              filters: [],
              cohort: null,
              denominator: null,
              joinKeys: [],
            },
            payload: {
              kind: 'document' as const,
              chunkId: uuid('91'),
              documentId: uuid('92'),
              sourceVersionId,
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
              excerpt: 'Evidence',
              trust: 'untrusted-evidence' as const,
            },
            limitations: [],
          }],
        },
      },
    ]
    for (const [index, claim] of variants.entries()) {
      const changed = Finding.make({
        ...base,
        id: FindingId.make(uuid(String(100 + index))),
        titleRevisions: [{
          ...base.titleRevisions[0]!,
          id: ContentRevisionId.make(uuid(String(110 + index))),
          idempotencyKey: `changed-title:${index}`,
        }],
        claims: [Schema.decodeUnknownSync(Schema.typeSchema(Claim))(claim)],
      })
      expect(Exit.isFailure(await Effect.runPromiseExit(
        DurableArtifactsRepo.saveFinding(changed, `changed:${index}`).pipe(
          Effect.provide(artifactLayer),
        ),
      ))).toBe(true)
    }

    const duplicateIdentity = await Effect.runPromiseExit(
      DurableArtifactsRepo.saveFinding(base, 'save:other-key').pipe(
        Effect.provide(artifactLayer),
      ),
    )
    expect(Exit.isFailure(duplicateIdentity)).toBe(true)
    if (Exit.isFailure(duplicateIdentity)) {
      expect(Option.getOrUndefined(
        Cause.failureOption(duplicateIdentity.cause),
      )?._tag).toBe('DurableArtifactConflictError')
    }

    const citationCollisionBase = finding('2')
    const citationCollision = Finding.make({
      ...citationCollisionBase,
      claims: [Schema.decodeUnknownSync(Schema.typeSchema(Claim))({
        ...citationCollisionBase.claims[0]!,
        citation: base.claims[0]!.citation,
      })],
    })
    const citationCollisionExit = await Effect.runPromiseExit(
      DurableArtifactsRepo.saveFinding(
        citationCollision,
        'save:citation-collision',
      ).pipe(Effect.provide(artifactLayer)),
    )
    expect(Exit.isFailure(citationCollisionExit)).toBe(true)
    if (Exit.isFailure(citationCollisionExit)) {
      expect(Option.getOrUndefined(
        Cause.failureOption(citationCollisionExit.cause),
      )?._tag).toBe('DurableArtifactConflictError')
    }
  }))

  it('keeps rev0 provenance readable after saving and reloading rev1', async () =>
    withFixture(async (transaction) => {
    const first = finding('2')
    const second = finding('3')
    await Effect.runPromise(
      DurableArtifactsRepo.saveFinding(first, 'save:first').pipe(
        Effect.provide(artifactLayer),
      ),
    )
    await Effect.runPromise(
      DurableArtifactsRepo.saveFinding(second, 'save:second').pipe(
        Effect.provide(artifactLayer),
      ),
    )
    const initial = report(first, second)
    await Effect.runPromise(
      DurableArtifactsRepo.saveReport(initial, null, 'compose:report').pipe(
        Effect.provide(artifactLayer),
      ),
    )
    const edges = initial.claims.flatMap((claim, index) => {
      const revision = claim.revisions[claim.currentRevision]!
      return [{
        id: ProvenanceEdgeId.make(hash(String(index + 1))),
        kind: 'report-claim' as const,
        reportId: initial.id,
        reportRevision: 0,
        claimId: claim.id,
        claimRevisionId: revision.id,
        claimRevision: revision.revision,
        evidenceMode: null,
        expectedEvidenceCount: 0,
      }, {
        id: ProvenanceEdgeId.make(hash(String(index + 3))),
        kind: 'claim-run-output' as const,
        reportId: initial.id,
        reportRevision: 0,
        claimId: claim.id,
        claimRevisionId: revision.id,
        claimRevision: revision.revision,
        runId,
      }]
    })
    const graph = Schema.decodeUnknownSync(Schema.typeSchema(ProvenanceGraph))({
      id: ProvenanceGraphId.make(uuid('30')),
      workspaceId,
      projectId,
      reportId: initial.id,
      reportRevision: 0,
      revalidationKey: 'publish:0',
      trigger: { kind: 'publish' },
      edges,
      validations: edges.map((edge) => ({
        claimId: edge.claimId,
        edgeId: edge.id,
        evidenceId: null,
        reportId: initial.id,
        reportRevision: 0,
        status: 'valid',
        reason: 'validated',
        checkedAt: 3n,
      })),
      createdAt: 3n,
    })
    await Effect.runPromise(
      ProvenanceGraphRepo.save(graph).pipe(Effect.provide(graphLayer)),
    )
    const untouched = Schema.encodeSync(ReportSection)(initial.sections[1]!)
    const tamperedClaim = Schema.decodeUnknownSync(Schema.typeSchema(Claim))({
      ...initial.claims[0]!,
      citation: {
        ...initial.claims[0]!.citation,
        state: 'valid',
      },
    })
    const tampered = editFirstSection(initial, [
      tamperedClaim,
      initial.claims[1]!,
    ])
    expect(Exit.isFailure(await Effect.runPromiseExit(
      DurableArtifactsRepo.saveReport(tampered, 0, 'tampered:claim').pipe(
        Effect.provide(artifactLayer),
      ),
    ))).toBe(true)
    expect((await Effect.runPromise(
      DurableArtifactsRepo.findReport(
        workspaceId,
        projectId,
        initial.id,
      ).pipe(Effect.provide(artifactLayer)),
    )).revision).toBe(0)

    const edited = editFirstSection(initial)
    await Effect.runPromise(
      DurableArtifactsRepo.saveReport(edited, 0, 'edit:first').pipe(
        Effect.provide(artifactLayer),
      ),
    )
    const loadedGraph = await Effect.runPromise(
      ProvenanceGraphRepo.find(
        workspaceId,
        projectId,
        initial.id,
        0,
      ).pipe(Effect.provide(graphLayer)),
    )
    const normalizeGraph = (value: ProvenanceGraph) => ({
      ...value,
      edges: [...value.edges].sort((left, right) =>
        left.id.localeCompare(right.id)),
      validations: [...value.validations].sort((left, right) =>
        left.edgeId.localeCompare(right.edgeId)),
    })
    expect(normalizeGraph(loadedGraph)).toEqual(normalizeGraph(graph))
    expect((await Effect.runPromise(
      DurableArtifactsRepo.findReport(
        workspaceId,
        projectId,
        initial.id,
      ).pipe(Effect.provide(artifactLayer)),
    )).revision).toBe(1)
    expect(Schema.encodeSync(ReportSection)(edited.sections[1]!))
      .toEqual(untouched)
    const revisions = await transaction.unsafe(
      `SELECT revision FROM report_revision_snapshots
       WHERE report_id = $1 ORDER BY revision`,
      [initial.id],
    )
    expect(revisions.map((row) => Number(row['revision']))).toEqual([0, 1])
  }))

  it('persists exact claim subsets without weakening immutable claim identity', async () =>
    withFixture(async () => {
      const first = finding('2')
      const second = finding('3')
      await Effect.runPromise(DurableArtifactsRepo.saveFinding(
        first,
        'subset:first',
      ).pipe(Effect.provide(artifactLayer)))
      await Effect.runPromise(DurableArtifactsRepo.saveFinding(
        second,
        'subset:second',
      ).pipe(Effect.provide(artifactLayer)))
      const initial = report(first, second)
      await Effect.runPromise(DurableArtifactsRepo.saveReport(
        initial,
        null,
        'subset:report',
      ).pipe(Effect.provide(artifactLayer)))
      const subset = Report.make({
        ...initial,
        claims: [initial.claims[0]!],
        sections: initial.sections.map((section, index) => index === 1
          ? { ...section, claimIds: [] }
          : section),
        revision: 1,
        publicationState: 'draft',
        updatedAt: 3n,
      })
      await Effect.runPromise(DurableArtifactsRepo.saveReport(
        subset,
        0,
        'subset:remove-claim',
      ).pipe(Effect.provide(artifactLayer)))

      expect((await Effect.runPromise(DurableArtifactsRepo.findReportRevision(
        workspaceId,
        projectId,
        initial.id,
        0,
      ).pipe(Effect.provide(artifactLayer)))).claims).toEqual(initial.claims)
      expect((await Effect.runPromise(DurableArtifactsRepo.findReport(
        workspaceId,
        projectId,
        initial.id,
      ).pipe(Effect.provide(artifactLayer)))).claims).toEqual(subset.claims)

      const tamperedClaim = Schema.decodeUnknownSync(Schema.typeSchema(Claim))({
        ...subset.claims[0]!,
        citation: {
          ...subset.claims[0]!.citation,
          state: 'valid',
        },
      })
      const tampered = Report.make({
        ...subset,
        claims: [tamperedClaim],
        revision: 2,
        updatedAt: 4n,
      })
      expect(Exit.isFailure(await Effect.runPromiseExit(
        DurableArtifactsRepo.saveReport(
          tampered,
          1,
          'subset:tampered',
        ).pipe(Effect.provide(artifactLayer)),
      ))).toBe(true)
      expect((await Effect.runPromise(DurableArtifactsRepo.findReport(
        workspaceId,
        projectId,
        initial.id,
      ).pipe(Effect.provide(artifactLayer)))).revision).toBe(1)
    }))
})
