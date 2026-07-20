import { describe, expect, it } from 'bun:test'
import {
  ProjectId,
  ReportId,
  Sha256Digest,
  SourceVersionId,
  WorkspaceId,
  CrossSourceEvidence,
  RecursiveFindingId,
  type CrossSourceEvidenceInput,
} from '@struct/domain'
import {
  computeCrossSourceEvidenceId,
  computeCoverageSnapshotId,
  computeRecursiveEvidenceId,
  computeRecursiveFindingId,
  renderRecursiveEvidenceExcerpt,
} from '@struct/research-engine'
import { Effect, Schema } from 'effect'
import { makeCitationEvidenceResolver } from './provenance.js'

const uuid = (suffix: string) =>
  `850e8400-e29b-41d4-a716-${suffix.padStart(12, '0')}`
const workspaceId = WorkspaceId.make(uuid('1'))
const projectId = ProjectId.make(uuid('2'))
const sourceVersionId = SourceVersionId.make(uuid('3'))

function digest(bytes: Uint8Array): typeof Sha256Digest.Type {
  return Sha256Digest.make(
    `sha256:${new Bun.CryptoHasher('sha256').update(bytes).digest('hex')}`,
  )
}

function recursiveEvidence(bytes: Uint8Array): CrossSourceEvidence {
  const referenceInput = {
    sourceVersionId,
    artifact: {
      digest: digest(bytes),
      byteLength: bytes.byteLength,
      mediaType: 'application/vnd.struct.recursive-batch-evidence+json',
    },
    locator: 'partition:0/finding:0',
  }
  const input: CrossSourceEvidenceInput = {
    claimSignature: Sha256Digest.make(`sha256:${'a'.repeat(64)}`),
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
      kind: 'recursive',
      reference: {
        ...referenceInput,
        id: computeRecursiveEvidenceId(referenceInput),
      },
      excerpt: 'Expected excerpt',
      trust: 'untrusted-evidence',
    },
    limitations: [],
  }
  return Schema.decodeUnknownSync(Schema.typeSchema(CrossSourceEvidence))({
    ...input,
    id: computeCrossSourceEvidenceId(input),
  })
}

const scope = {
  workspaceId,
  projectId,
  reportId: ReportId.make(uuid('4')),
  reportRevision: 0,
}

function resolverFor(bytes: Uint8Array) {
  return makeCitationEvidenceResolver({
    runExists: () => Effect.succeed(true),
    recursiveFindingExists: () => Effect.succeed(true),
    sourceVersionExists: () => Effect.succeed(true),
    openDocumentEvidence: () => Effect.die('unused document opener'),
    reopenDatasetEvidence: () => Effect.die('unused dataset opener'),
    readArtifact: () => Effect.succeed({
      bytes,
      byteLength: bytes.byteLength,
    }),
  })
}

describe('citation provenance resolver', () => {
  it('derives recursive excerpts from the exact scoped artifact record', async () => {
    const fields = [{ name: 'quote', value: 'Actual excerpt' }]
    const excerpt = renderRecursiveEvidenceExcerpt({ fields })
    const bytes = new TextEncoder().encode(JSON.stringify({
      kind: 'recursive-batch-evidence',
      version: '1',
      sourceVersionIds: [sourceVersionId],
      records: [{
        locator: 'partition:0/finding:0',
        sourceVersionId,
        fields,
        excerpt,
      }],
    }))
    const opened = await Effect.runPromise(
      resolverFor(bytes).openRecursive(scope, recursiveEvidence(bytes)),
    )
    expect(opened.excerpt).toBe(excerpt)
  })

  it('returns a typed failure for malformed stored recursive bytes', async () => {
    const bytes = new TextEncoder().encode('{not-json')
    const error = await Effect.runPromise(
      Effect.flip(
        resolverFor(bytes).openRecursive(scope, recursiveEvidence(bytes)),
      ),
    )
    expect(error._tag).toBe('CitationTargetResolutionError')
    expect(error.reason).toBe('artifact-metadata-mismatch')
  })

  it('requires locator and source-version identity to match the same record', async () => {
    const bytes = new TextEncoder().encode(JSON.stringify({
      kind: 'recursive-batch-evidence',
      version: '1',
      sourceVersionIds: [sourceVersionId],
      records: [{
        locator: 'partition:0/finding:0',
        sourceVersionId: SourceVersionId.make(uuid('5')),
        fields: [{ name: 'quote', value: 'Foreign excerpt' }],
        excerpt: renderRecursiveEvidenceExcerpt({
          fields: [{ name: 'quote', value: 'Foreign excerpt' }],
        }),
      }],
    }))
    const error = await Effect.runPromise(
      Effect.flip(
        resolverFor(bytes).openRecursive(scope, recursiveEvidence(bytes)),
      ),
    )
    expect(error.reason).toBe('locator-mismatch')
  })

  it('rejects a stored excerpt that violates the canonical rendering contract', async () => {
    const bytes = new TextEncoder().encode(JSON.stringify({
      kind: 'recursive-batch-evidence',
      version: '1',
      sourceVersionIds: [sourceVersionId],
      records: [{
        locator: 'partition:0/finding:0',
        sourceVersionId,
        fields: [{ name: 'quote', value: 'Actual excerpt' }],
        excerpt: 'Tampered excerpt',
      }],
    }))
    const error = await Effect.runPromise(
      Effect.flip(
        resolverFor(bytes).openRecursive(scope, recursiveEvidence(bytes)),
      ),
    )
    expect(error.reason).toBe('artifact-metadata-mismatch')
  })

  it('checks canonical recursive-finding identity before scoped existence', async () => {
    const bytes = new TextEncoder().encode(JSON.stringify({
      kind: 'recursive-batch-evidence',
      version: '1',
      sourceVersionIds: [sourceVersionId],
      records: [{
        locator: 'partition:0/finding:0',
        sourceVersionId,
        fields: [{ name: 'quote', value: 'Actual excerpt' }],
        excerpt: renderRecursiveEvidenceExcerpt({
          fields: [{ name: 'quote', value: 'Actual excerpt' }],
        }),
      }],
    }))
    const item = recursiveEvidence(bytes)
    if (item.payload.kind !== 'recursive') {
      throw new Error('fixture recursive evidence missing')
    }
    const coverageInput = {
      expectedItems: 1,
      examinedItems: 1,
      missingItems: 0,
      excludedItems: 0,
      expectedPartitions: 1,
      examinedPartitions: 1,
      status: 'complete' as const,
    }
    const identity = {
      claimSignature: item.claimSignature,
      evidence: [item.payload.reference],
      confidence: 0.8,
      importance: 0.7,
      coverage: {
        ...coverageInput,
        id: computeCoverageSnapshotId(coverageInput),
      },
      supportingExamples: [item.payload.reference.id],
      counterEvidence: [],
      contradictions: [],
    }
    const finding = {
      ...identity,
      id: computeRecursiveFindingId(identity),
      claim: 'Canonical recursive finding',
      limitations: [],
      tags: [],
    }
    let existenceChecks = 0
    const resolver = makeCitationEvidenceResolver({
      runExists: () => Effect.succeed(true),
      recursiveFindingExists: () => {
        existenceChecks += 1
        return Effect.succeed(true)
      },
      sourceVersionExists: () => Effect.succeed(true),
      openDocumentEvidence: () => Effect.die('unused document opener'),
      reopenDatasetEvidence: () => Effect.die('unused dataset opener'),
      readArtifact: () => Effect.succeed({
        bytes,
        byteLength: bytes.byteLength,
      }),
    })
    await Effect.runPromise(resolver.openOrigin(scope, {
      kind: 'recursive-finding',
      finding,
    }))
    expect(existenceChecks).toBe(1)

    const error = await Effect.runPromise(Effect.flip(
      resolver.openOrigin(scope, {
        kind: 'recursive-finding',
        finding: {
          ...finding,
          id: RecursiveFindingId.make(
            Sha256Digest.make(`sha256:${'f'.repeat(64)}`),
          ),
        },
      }),
    ))
    expect(error.reason).toBe('origin-not-found')
    expect(existenceChecks).toBe(1)
  })

  it('preserves source-scope denial instead of remapping it as a missing artifact', async () => {
    const fields = [{ name: 'quote', value: 'Actual excerpt' }]
    const bytes = new TextEncoder().encode(JSON.stringify({
      kind: 'recursive-batch-evidence',
      version: '1',
      sourceVersionIds: [sourceVersionId],
      records: [{
        locator: 'partition:0/finding:0',
        sourceVersionId,
        fields,
        excerpt: renderRecursiveEvidenceExcerpt({ fields }),
      }],
    }))
    let artifactReads = 0
    const resolver = makeCitationEvidenceResolver({
      runExists: () => Effect.succeed(true),
      recursiveFindingExists: () => Effect.succeed(true),
      sourceVersionExists: () => Effect.fail('scope denied'),
      openDocumentEvidence: () => Effect.die('unused document opener'),
      reopenDatasetEvidence: () => Effect.die('unused dataset opener'),
      readArtifact: () => {
        artifactReads += 1
        return Effect.succeed({ bytes, byteLength: bytes.byteLength })
      },
    })

    const error = await Effect.runPromise(Effect.flip(
      resolver.openRecursive(scope, recursiveEvidence(bytes)),
    ))
    expect(error.status).toBe('unauthorized')
    expect(error.reason).toBe('target-not-visible')
    expect(artifactReads).toBe(0)
  })
})
