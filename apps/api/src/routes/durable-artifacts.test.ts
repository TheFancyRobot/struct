import { DatasetQueryAuthorizationError } from '@struct/data-engine'
import {
  CitationId,
  Claim,
  ClaimId,
  ContentRevisionId,
  Finding,
  FindingId,
  Report,
  ReportId,
  ReportSectionId,
  ResearchRunId,
  SourceVersionId,
  WorkspaceId,
} from '@struct/domain'
import {
  DurableArtifactConflictError,
  DurableArtifactPersistenceError,
  DurableArtifactScopeError,
} from '@struct/persistence'
import {
  ComposeReportInput,
  composeReport,
} from '@struct/research-engine'
import { describe, expect, it } from 'bun:test'
import { Effect, Option, Schema } from 'effect'
import {
  durableArtifactRoute,
  type DurableArtifactRouteDeps,
} from './durable-artifacts'

const workspaceId = 'b80e8400-e29b-41d4-a716-446655440001'
const projectId = 'b80e8400-e29b-41d4-a716-446655440002'
const reportId = 'b80e8400-e29b-41d4-a716-446655440003'
const authorization = { authorization: 'Bearer test-token' }
const uuid = (suffix: string) =>
  `b80e8400-e29b-41d4-a716-${suffix.padStart(12, '0')}`
const runId = ResearchRunId.make(uuid('10'))
const sourceVersionId = SourceVersionId.make(uuid('11'))

function finding(suffix: string): Finding {
  return Schema.decodeUnknownSync(Schema.typeSchema(Finding))({
    id: FindingId.make(uuid(`${suffix}01`)),
    workspaceId: WorkspaceId.make(workspaceId),
    projectId,
    runId,
    sourceVersionIds: [sourceVersionId],
    titleRevisions: [{
      id: ContentRevisionId.make(uuid(`${suffix}02`)),
      revision: 0,
      content: `Finding ${suffix}`,
      authorship: {
        kind: 'generated',
        runId,
        model: 'test',
        promptVersion: 'v1',
      },
      idempotencyKey: `finding-title:${suffix}`,
      createdAt: 1n,
    }],
    currentRevision: 0,
    claims: [{
      id: ClaimId.make(uuid(`${suffix}03`)),
      claimSignature: `sha256:${suffix.repeat(64)}`,
      citation: {
        citationId: CitationId.make(uuid(`${suffix}04`)),
        state: 'draft',
        revision: 0,
        supersededBy: null,
        lastIdempotencyKey: null,
        updatedAt: 1n,
      },
      origin: { kind: 'research-run', runId },
      revisions: [{
        id: ContentRevisionId.make(uuid(`${suffix}05`)),
        revision: 0,
        content: `Evidence ${suffix}`,
        authorship: {
          kind: 'generated',
          runId,
          model: 'test',
          promptVersion: 'v1',
        },
        idempotencyKey: `claim:${suffix}`,
        createdAt: 1n,
      }],
      currentRevision: 0,
      support: { kind: 'unsupported', reason: 'test evidence' },
      createdAt: 1n,
    }],
    supersededBy: null,
    createdAt: 1n,
    updatedAt: 1n,
  })
}

function publishableClaim(suffix: string): Claim {
  const base = finding(suffix).claims[0]!
  return Schema.decodeUnknownSync(Schema.typeSchema(Claim))({
    ...base,
    citation: {
      ...base.citation,
      state: 'publishable',
    },
    support: {
      kind: 'supported',
      mode: 'document',
      evidence: [{
        id: `sha256:${suffix.repeat(64)}`,
        claimSignature: base.claimSignature,
        stance: 'supports',
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
          kind: 'document',
          chunkId: uuid(`${suffix}06`),
          documentId: uuid(`${suffix}07`),
          sourceVersionId,
          chunkingVersion: 'v1',
          ordinal: 0,
          locator: {
            page: 1,
            section: 'Evidence',
            paragraph: 1,
            charStart: 0,
            charEnd: 8,
            byteStart: 0,
            byteEnd: 8,
          },
          citationLocator: 'document:chars:0-8,bytes:0-8',
          excerpt: `Evidence ${suffix}`,
          trust: 'untrusted-evidence',
        },
        limitations: [],
      }],
    },
  })
}

async function composedReport(
  findings: ReadonlyArray<Finding>,
  key = 'report:create',
): Promise<Report> {
  return Effect.runPromise(composeReport(
    Schema.decodeUnknownSync(ComposeReportInput)({
      id: ReportId.make(reportId),
      workspaceId,
      projectId,
      runId,
      title: 'Mixed evidence report',
      titleRevisionId: ContentRevisionId.make(uuid('20')),
      idempotencyKey: key,
      model: 'test',
      promptVersion: 'v1',
      sections: findings.map((item, index) => ({
        id: ReportSectionId.make(uuid(String(30 + index))),
        revisionId: ContentRevisionId.make(uuid(String(40 + index))),
        heading: `Section ${index + 1}`,
        findingIds: [item.id],
      })),
      occurredAt: 2,
    }),
    findings,
  ))
}

function artifactRequest(
  path: string,
  method: 'POST' | 'PATCH',
  key: string,
  body: unknown,
) {
  return new Request(`http://localhost${path}`, {
    method,
    headers: {
      ...authorization,
      'Idempotency-Key': key,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  })
}

function deps(
  overrides: Partial<DurableArtifactRouteDeps> = {},
): DurableArtifactRouteDeps {
  return {
    authorize: () => Effect.void,
    saveFinding: () => Effect.die('not used'),
    listFindings: () => Effect.succeed([]),
    findFinding: () => Effect.die('not used'),
    saveReport: () => Effect.die('not used'),
    findReport: () => Effect.die('not used'),
    findReportRevision: () => Effect.die('not used'),
    findReportRevisionByKey: () => Effect.succeed(Option.none()),
    ...overrides,
  }
}

describe('durable artifact API routes', () => {
  it('lists only the authorized project notebook', async () => {
    let received: ReadonlyArray<unknown> = []
    const response = await Effect.runPromise(durableArtifactRoute(
      new Request(
        `http://localhost/api/projects/${projectId}/findings`
        + `?workspaceId=${workspaceId}`,
        { headers: authorization },
      ),
      deps({
        authorize: (token, workspace, project) => {
          received = [token, workspace, project]
          return Effect.void
        },
      }),
    ))
    expect(response?.status).toBe(200)
    expect(await response?.json()).toEqual([])
    expect(received).toEqual(['test-token', workspaceId, projectId])
  })

  it('requires a credential before reading any artifact', async () => {
    let read = false
    const response = await Effect.runPromise(durableArtifactRoute(
      new Request(
        `http://localhost/api/projects/${projectId}/findings`
        + `?workspaceId=${workspaceId}`,
      ),
      deps({
        authorize: () => Effect.die('must not authorize'),
        listFindings: () => {
          read = true
          return Effect.succeed([])
        },
      }),
    ))
    expect(response?.status).toBe(401)
    expect(read).toBe(false)
  })

  it('does not enumerate another workspace after authorization denial', async () => {
    let read = false
    const response = await Effect.runPromise(durableArtifactRoute(
      new Request(
        `http://localhost/api/projects/${projectId}/findings`
        + `?workspaceId=${workspaceId}`,
        { headers: authorization },
      ),
      deps({
        authorize: () => Effect.fail(new DatasetQueryAuthorizationError({
          message: 'foreign workspace',
        })),
        listFindings: () => {
          read = true
          return Effect.succeed([])
        },
      }),
    ))
    expect(response?.status).toBe(404)
    expect(await response?.json()).toEqual({ error: 'ArtifactNotFound' })
    expect(read).toBe(false)
  })

  it('maps invalid credentials to 401 and rejects blank idempotency keys', async () => {
    const badCredential = await Effect.runPromise(durableArtifactRoute(
      new Request(
        `http://localhost/api/projects/${projectId}/findings`
        + `?workspaceId=${workspaceId}`,
        { headers: authorization },
      ),
      deps({
        authorize: () => Effect.fail({
          _tag: 'DatasetQueryAuthenticationError',
        }),
      }),
    ))
    expect(badCredential?.status).toBe(401)

    for (const key of ['', '   ']) {
      const invalid = await Effect.runPromise(durableArtifactRoute(
        new Request(
          `http://localhost/api/projects/${projectId}/findings`,
          {
            method: 'POST',
            headers: {
              ...authorization,
              'Idempotency-Key': key,
              'Content-Type': 'application/json',
            },
            body: '{}',
          },
        ),
        deps(),
      ))
      expect(invalid?.status).toBe(400)
    }
  })

  it('maps scoped missing reports and malformed identifiers to typed responses', async () => {
    const missing = await Effect.runPromise(durableArtifactRoute(
      new Request(
        `http://localhost/api/projects/${projectId}/reports/${reportId}`
        + `?workspaceId=${workspaceId}`,
        { headers: authorization },
      ),
      deps({
        findReport: (workspace, project, id) =>
          Effect.fail(new DurableArtifactScopeError({
            entity: 'report',
            id,
            workspaceId: workspace,
            projectId: project,
            message: 'not found',
          })),
      }),
    ))
    expect(missing?.status).toBe(404)
    expect(await missing?.json()).toEqual({ error: 'ArtifactNotFound' })

    const invalid = await Effect.runPromise(durableArtifactRoute(
      new Request(
        `http://localhost/api/projects/not-a-project/reports/${reportId}`
        + `?workspaceId=${workspaceId}`,
        { headers: authorization },
      ),
      deps(),
    ))
    expect(invalid?.status).toBe(400)
    expect(await invalid?.json()).toEqual({ error: 'InvalidArtifactRequest' })
  })

  it('passes exact finding replays through and maps changed payload conflicts', async () => {
    const item = finding('1')
    const encoded = Schema.encodeSync(Finding)(item)
    let stored: Finding | undefined
    const routeDeps = deps({
      saveFinding: (candidate, key) => {
        if (stored === undefined) {
          stored = candidate
          return Effect.succeed(candidate)
        }
        return JSON.stringify(Schema.encodeSync(Finding)(stored))
          === JSON.stringify(Schema.encodeSync(Finding)(candidate))
          ? Effect.succeed(stored)
          : Effect.fail(new DurableArtifactConflictError({
            entity: 'finding',
            id: candidate.id,
            idempotencyKey: key,
            message: 'changed replay',
          }))
      },
    })
    for (let index = 0; index < 2; index++) {
      const response = await Effect.runPromise(durableArtifactRoute(
        artifactRequest(
          `/api/projects/${projectId}/findings`,
          'POST',
          'finding:save',
          encoded,
        ),
        routeDeps,
      ))
      expect(response?.status).toBe(200)
    }
    const conflict = await Effect.runPromise(durableArtifactRoute(
      artifactRequest(
        `/api/projects/${projectId}/findings`,
        'POST',
        'finding:save',
        { ...encoded, updatedAt: 2 },
      ),
      routeDeps,
    ))
    expect(conflict?.status).toBe(409)
  })

  it('requires report key equality and composes all selected findings', async () => {
    const findings = [finding('1'), finding('2')]
    const composition = {
      id: reportId,
      workspaceId,
      projectId,
      runId,
      title: 'Mixed evidence report',
      titleRevisionId: uuid('20'),
      idempotencyKey: 'report:create',
      model: 'test',
      promptVersion: 'v1',
      sections: findings.map((item, index) => ({
        id: uuid(String(30 + index)),
        revisionId: uuid(String(40 + index)),
        heading: `Section ${index + 1}`,
        findingIds: [item.id],
      })),
      occurredAt: 2,
    }
    const body = {
      workspaceId,
      findingIds: findings.map((item) => item.id),
      composition,
    }
    const mismatch = await Effect.runPromise(durableArtifactRoute(
      artifactRequest(
        `/api/projects/${projectId}/reports`,
        'POST',
        'different-key',
        body,
      ),
      deps(),
    ))
    expect(mismatch?.status).toBe(400)

    let saved: Report | undefined
    const created = await Effect.runPromise(durableArtifactRoute(
      artifactRequest(
        `/api/projects/${projectId}/reports`,
        'POST',
        'report:create',
        body,
      ),
      deps({
        findFinding: (_workspace, _project, id) =>
          Effect.succeed(findings.find((item) => item.id === id)!),
        saveReport: (candidate) => {
          saved = candidate
          return Effect.succeed(candidate)
        },
      }),
    ))
    expect(created?.status).toBe(200)
    expect(saved?.findingIds).toEqual(findings.map((item) => item.id))
    expect(saved?.claims.map((claim) => claim.id)).toEqual(
      findings.map((item) => item.claims[0]!.id),
    )
  })

  it('supports add, reorder, edit, and remove report mutations', async () => {
    const first = finding('1')
    const second = finding('2')
    let current = await composedReport([first])
    const routeDeps = deps({
      findFinding: (_workspace, _project, id) =>
        Effect.succeed(id === first.id ? first : second),
      findReport: () => Effect.succeed(current),
      saveReport: (next) => {
        current = next
        return Effect.succeed(next)
      },
    })
    const mutate = async (key: string, body: unknown) => {
      const response = await Effect.runPromise(durableArtifactRoute(
        artifactRequest(
          `/api/projects/${projectId}/reports/${reportId}`,
          'PATCH',
          key,
          body,
        ),
        routeDeps,
      ))
      expect(response?.status).toBe(200)
    }
    await mutate('section:add', {
      kind: 'add',
      workspaceId,
      findingId: second.id,
      input: {
        sectionId: uuid('31'),
        revisionId: uuid('41'),
        heading: 'Second',
        expectedReportRevision: 0,
        idempotencyKey: 'section:add',
        model: 'test',
        promptVersion: 'v1',
        occurredAt: 3,
      },
    })
    expect(current.sections).toHaveLength(2)
    await mutate('section:reorder', {
      kind: 'reorder',
      workspaceId,
      orderedSectionIds: [current.sections[1]!.id, current.sections[0]!.id],
      expectedReportRevision: 1,
      occurredAt: 4,
    })
    expect(current.sections[0]!.findingIds).toEqual([second.id])
    await mutate('section:edit', {
      kind: 'edit',
      workspaceId,
      input: {
        sectionId: current.sections[0]!.id,
        revisionId: uuid('50'),
        content: 'Focused user edit',
        actorId: uuid('51'),
        expectedReportRevision: 2,
        idempotencyKey: 'section:edit',
        occurredAt: 5,
      },
    })
    expect(current.sections[0]!.revisions.at(-1)?.content)
      .toBe('Focused user edit')
    await mutate('section:remove', {
      kind: 'remove',
      workspaceId,
      sectionId: current.sections[0]!.id,
      expectedReportRevision: 3,
      occurredAt: 6,
    })
    expect(current.findingIds).toEqual([first.id])
    expect(current.sections).toHaveLength(1)
  })

  it('returns exact mutation replays before stale reads and maps failures', async () => {
    const item = finding('1')
    const replay = await composedReport([item])
    let readCurrent = false
    const replayed = await Effect.runPromise(durableArtifactRoute(
      artifactRequest(
        `/api/projects/${projectId}/reports/${reportId}`,
        'PATCH',
        'section:replay',
        {
          kind: 'reorder',
          workspaceId,
          orderedSectionIds: [replay.sections[0]!.id],
          expectedReportRevision: 999,
          occurredAt: 3,
        },
      ),
      deps({
        findReportRevisionByKey: () => Effect.succeed(Option.some(replay)),
        findReport: () => {
          readCurrent = true
          return Effect.die('must not read stale state')
        },
      }),
    ))
    expect(replayed?.status).toBe(200)
    expect(readCurrent).toBe(false)

    const stale = await Effect.runPromise(durableArtifactRoute(
      artifactRequest(
        `/api/projects/${projectId}/reports/${reportId}`,
        'PATCH',
        'section:stale',
        {
          kind: 'reorder',
          workspaceId,
          orderedSectionIds: [replay.sections[0]!.id],
          expectedReportRevision: 9,
          occurredAt: 3,
        },
      ),
      deps({ findReport: () => Effect.succeed(replay) }),
    ))
    expect(stale?.status).toBe(409)

    const unavailable = await Effect.runPromise(durableArtifactRoute(
      artifactRequest(
        `/api/projects/${projectId}/findings`,
        'POST',
        'finding:failure',
        Schema.encodeSync(Finding)(item),
      ),
      deps({
        saveFinding: () => Effect.fail(new DurableArtifactPersistenceError({
          operation: 'save finding',
          message: 'database unavailable',
        })),
      }),
    ))
    expect(unavailable?.status).toBe(503)
  })

  it('loads an exact historical revision and executes auditable repair gates', async () => {
    const first = finding('1')
    const secondClaim = finding('2').claims[0]!
    const replacement = publishableClaim('3')
    const combined = Finding.make({
      ...first,
      claims: [...first.claims, secondClaim, replacement],
    })
    const composed = await composedReport([combined])
    const initial = Report.make({
      ...composed,
      claims: composed.claims.filter((claim) => claim.id !== replacement.id),
      sections: composed.sections.map((section) => ({
        ...section,
        claimIds: section.claimIds.filter((claimId) =>
          claimId !== replacement.id),
      })),
    })
    const historical = Report.make({
      ...initial,
      sections: initial.sections.map((section) => ({
        ...section,
        revisions: [{
          ...section.revisions[0]!,
          content: 'Historical exact text',
        }],
      })),
    })
    let requestedRevision = -1
    const historyResponse = await Effect.runPromise(durableArtifactRoute(
      new Request(
        `http://localhost/api/projects/${projectId}/reports/${reportId}`
        + `?workspaceId=${workspaceId}&revision=0`,
        { headers: authorization },
      ),
      deps({
        findReportRevision: (_workspace, _project, _report, revision) => {
          requestedRevision = revision
          return Effect.succeed(historical)
        },
      }),
    ))
    expect(historyResponse?.status).toBe(200)
    expect(requestedRevision).toBe(0)
    expect((await historyResponse?.json()).sections[0].revisions[0].content)
      .toBe('Historical exact text')

    const invalidHistory = await Effect.runPromise(durableArtifactRoute(
      new Request(
        `http://localhost/api/projects/${projectId}/reports/${reportId}`
        + `?workspaceId=${workspaceId}&revision=01`,
        { headers: authorization },
      ),
      deps(),
    ))
    expect(invalidHistory?.status).toBe(400)

    let current = initial
    const mutate = async (key: string, body: unknown) => {
      const response = await Effect.runPromise(durableArtifactRoute(
        artifactRequest(
          `/api/projects/${projectId}/reports/${reportId}`,
          'PATCH',
          key,
          body,
        ),
        deps({
          findReport: () => Effect.succeed(current),
          findFinding: () => Effect.succeed(combined),
          saveReport: (next) => {
            current = next
            return Effect.succeed(next)
          },
        }),
      ))
      return response
    }

    const regenerated = await mutate('repair:regenerate', {
      kind: 'regenerate',
      workspaceId,
      sectionId: current.sections[0]!.id,
      revisionId: uuid('71'),
      expectedReportRevision: 0,
      occurredAt: 7,
    })
    expect(regenerated?.status).toBe(200)
    expect(current.sections[0]!.revisions).toHaveLength(2)
    expect(current.sections[0]!.revisions[1]!.authorship).toEqual({
      kind: 'generated',
      runId,
      model: 'deterministic-report-repair',
      promptVersion: 'immutable-claims-v1',
    })

    const staleRegeneration = await mutate('repair:stale-regenerate', {
      kind: 'regenerate',
      workspaceId,
      sectionId: current.sections[0]!.id,
      revisionId: uuid('72'),
      expectedReportRevision: 0,
      occurredAt: 8,
    })
    expect(staleRegeneration?.status).toBe(409)

    const invalidReplacement = await mutate('repair:replace-invalid', {
      kind: 'replace-claim',
      workspaceId,
      claimId: secondClaim.id,
      replacementFindingId: combined.id,
      replacementClaimId: first.claims[0]!.id,
      revisionId: uuid('73'),
      expectedReportRevision: 1,
      occurredAt: 9,
    })
    expect(invalidReplacement?.status).toBe(409)

    const replaced = await mutate('repair:replace-valid', {
      kind: 'replace-claim',
      workspaceId,
      claimId: secondClaim.id,
      replacementFindingId: combined.id,
      replacementClaimId: replacement.id,
      revisionId: uuid('74'),
      expectedReportRevision: 1,
      occurredAt: 10,
    })
    expect(replaced?.status).toBe(200)
    expect(current.claims.some((claim) => claim.id === secondClaim.id)).toBe(false)
    expect(current.claims.some((claim) =>
      claim.citation.citationId === secondClaim.citation.citationId)).toBe(false)
    expect(current.sections[0]!.revisions).toHaveLength(3)
    expect(current.sections[0]!.revisions.at(-1)?.content)
      .toContain(replacement.revisions[0]!.content)
    expect(current.publicationState).toBe('draft')
    expect(historical.claims.map((claim) => claim.id))
      .toEqual([first.claims[0]!.id, secondClaim.id])

    const removed = await mutate('repair:remove', {
      kind: 'remove-claim',
      workspaceId,
      claimId: first.claims[0]!.id,
      revisionId: uuid('75'),
      expectedReportRevision: 2,
      occurredAt: 11,
    })
    expect(removed?.status).toBe(200)
    expect(current.claims.map((claim) => claim.id)).toEqual([replacement.id])
    expect(current.sections[0]!.revisions.at(-1)?.content)
      .toBe(replacement.revisions[0]!.content)
    expect(historical.sections[0]!.revisions[0]!.content)
      .toBe('Historical exact text')

    const lastClaim = await mutate('repair:last-claim', {
      kind: 'remove-claim',
      workspaceId,
      claimId: replacement.id,
      revisionId: uuid('76'),
      expectedReportRevision: 3,
      occurredAt: 12,
    })
    expect(lastClaim?.status).toBe(409)

    const publicationPrepared = await mutate('publish:prepare', {
      kind: 'prepare-publication',
      workspaceId,
      expectedReportRevision: 3,
      occurredAt: 13,
    })
    expect(publicationPrepared?.status).toBe(200)
    expect(current.publicationState).toBe('publishable')

    const published = await mutate('publish:direct', {
      kind: 'publish',
      workspaceId,
      expectedReportRevision: 4,
      occurredAt: 14,
    })
    expect(published?.status).toBe(200)
    expect(current.publicationState).toBe('published')
  })
})
