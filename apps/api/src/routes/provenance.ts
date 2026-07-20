import {
  DatasetCitationEvidence,
  SourceVersionId,
} from '@struct/domain'
/* eslint-disable no-unused-vars -- Babel does not mark type-only imports as used. */
import type { CrossSourceEvidence } from '@struct/domain'
import type {
  ProvenanceDocumentEvidenceProjection,
} from '@struct/persistence'
import {
  CitationTargetResolutionError,
  RECURSIVE_EVIDENCE_MEDIA_TYPE,
  computeRecursiveFindingId,
  renderRecursiveEvidenceExcerpt,
} from '@struct/research-engine'
import type { CitationEvidenceResolverShape } from '@struct/research-engine'
import type { ArtifactRef, StoredBytes } from '@struct/source-storage'
/* eslint-enable no-unused-vars */
import { Effect, Schema } from 'effect'

interface ProvenanceReadDependencies {
  readonly runExists: (
    workspaceId: Parameters<CitationEvidenceResolverShape['openOrigin']>[0]['workspaceId'],
    projectId: Parameters<CitationEvidenceResolverShape['openOrigin']>[0]['projectId'],
    runId: Extract<
      Parameters<CitationEvidenceResolverShape['openOrigin']>[1],
      { readonly kind: 'run' }
    >['runId'],
  ) => Effect.Effect<boolean, unknown>
  readonly recursiveFindingExists: (
    workspaceId: Parameters<CitationEvidenceResolverShape['openOrigin']>[0]['workspaceId'],
    projectId: Parameters<CitationEvidenceResolverShape['openOrigin']>[0]['projectId'],
    findingId: Extract<
      Parameters<CitationEvidenceResolverShape['openOrigin']>[1],
      { readonly kind: 'recursive-finding' }
    >['finding']['id'],
  ) => Effect.Effect<boolean, unknown>
  readonly sourceVersionExists: (
    workspaceId: Parameters<CitationEvidenceResolverShape['openRecursive']>[0]['workspaceId'],
    projectId: Parameters<CitationEvidenceResolverShape['openRecursive']>[0]['projectId'],
    sourceVersionId: typeof SourceVersionId.Type,
  ) => Effect.Effect<boolean, unknown>
  readonly openDocumentEvidence: (
    scope: Parameters<CitationEvidenceResolverShape['openDocument']>[0],
    evidence: CrossSourceEvidence,
  ) => Effect.Effect<ProvenanceDocumentEvidenceProjection, unknown>
  readonly reopenDatasetEvidence: (
    scope: Parameters<CitationEvidenceResolverShape['openDataset']>[0],
    evidence: CrossSourceEvidence,
  ) => Effect.Effect<DatasetCitationEvidence, unknown>
  readonly readArtifact: (
    ref: ArtifactRef,
  ) => Effect.Effect<StoredBytes, unknown>
}

function resolutionFailure(
  status: 'broken' | 'unauthorized' | 'incompatible',
  reason:
    | 'origin-not-found'
    | 'target-not-found'
    | 'target-not-visible'
    | 'evidence-kind-mismatch'
    | 'locator-mismatch'
    | 'artifact-hash-mismatch'
    | 'artifact-metadata-mismatch',
  message: string,
) {
  return new CitationTargetResolutionError({ status, reason, message })
}

function artifactRef(digest: string): ArtifactRef {
  return `artifact://sha256/${digest.slice('sha256:'.length)}`
}

const RecursiveArtifactLocatorIndex = Schema.Struct({
  kind: Schema.Literal('recursive-batch-evidence'),
  version: Schema.Literal('1'),
  sourceVersionIds: Schema.Array(SourceVersionId).pipe(Schema.minItems(1)),
  records: Schema.Array(Schema.Struct({
    locator: Schema.String,
    sourceVersionId: SourceVersionId,
    fields: Schema.Array(Schema.Unknown),
    excerpt: Schema.String.pipe(Schema.minLength(1), Schema.maxLength(4_096)),
  })),
})

export function makeCitationEvidenceResolver(
  deps: ProvenanceReadDependencies,
): CitationEvidenceResolverShape {
  return {
    openOrigin: (scope, origin) => {
      // User identity is intrinsic until the product has an actor directory.
      if (origin.kind === 'user') return Effect.void
      if (origin.kind === 'recursive-finding') {
        if (origin.finding.id !== computeRecursiveFindingId(origin.finding)) {
          return Effect.fail(resolutionFailure(
            'broken',
            'origin-not-found',
            'Recursive-finding provenance has a non-canonical identity',
          ))
        }
        return deps.recursiveFindingExists(
          scope.workspaceId,
          scope.projectId,
          origin.finding.id,
        ).pipe(
          Effect.mapError(() => resolutionFailure(
            'unauthorized',
            'target-not-visible',
            'Recursive-finding provenance is not visible in this scope',
          )),
          Effect.flatMap((exists) => exists
            ? Effect.void
            : Effect.fail(resolutionFailure(
                'broken',
                'origin-not-found',
                'Recursive-finding provenance no longer exists',
              ))),
        )
      }
      return deps.runExists(scope.workspaceId, scope.projectId, origin.runId).pipe(
        Effect.mapError(() => resolutionFailure(
          'unauthorized',
          'target-not-visible',
          'Research-run provenance is not visible in this scope',
        )),
        Effect.flatMap((exists) => exists
          ? Effect.void
          : Effect.fail(resolutionFailure(
              'broken',
              'origin-not-found',
              'Research-run provenance no longer exists',
            ))),
      )
    },
    openDocument: (scope, evidence) => {
      if (evidence.payload.kind !== 'document') {
        return Effect.fail(resolutionFailure(
          'incompatible',
          'evidence-kind-mismatch',
          'Document opener received non-document evidence',
        ))
      }
      const payload = evidence.payload
      return deps.openDocumentEvidence(scope, evidence).pipe(
        Effect.mapError(() => resolutionFailure(
          'unauthorized',
          'target-not-visible',
          'Document evidence is not visible in this scope',
        )),
        Effect.map((opened) => ({
          ...opened,
          citationLocator: payload.citationLocator,
        })),
      )
    },
    openDataset: (scope, evidence) => {
      if (evidence.payload.kind !== 'dataset') {
        return Effect.fail(resolutionFailure(
          'incompatible',
          'evidence-kind-mismatch',
          'Dataset opener received non-dataset evidence',
        ))
      }
      return deps.reopenDatasetEvidence(scope, evidence).pipe(
        Effect.mapError(() => resolutionFailure(
          'unauthorized',
          'target-not-visible',
          'Dataset evidence is not visible in this scope',
        )),
      )
    },
    openRecursive: (scope, evidence) => {
      if (evidence.payload.kind !== 'recursive') {
        return Effect.fail(resolutionFailure(
          'incompatible',
          'evidence-kind-mismatch',
          'Recursive opener received non-recursive evidence',
        ))
      }
      const { reference } = evidence.payload
      if (reference.artifact.mediaType !== RECURSIVE_EVIDENCE_MEDIA_TYPE) {
        return Effect.fail(resolutionFailure(
          'broken',
          'artifact-metadata-mismatch',
          'Recursive evidence media type is incompatible',
        ))
      }
      return deps.sourceVersionExists(
        scope.workspaceId,
        scope.projectId,
        reference.sourceVersionId,
      ).pipe(
        Effect.mapError(() => resolutionFailure(
          'unauthorized',
          'target-not-visible',
          'Recursive evidence source version is not visible in this scope',
        )),
        Effect.flatMap((visible) => visible
          ? Effect.void
          : Effect.fail(resolutionFailure(
              'unauthorized',
              'target-not-visible',
              'Recursive evidence source version is not visible in this scope',
            ))),
        Effect.flatMap(() =>
          deps.readArtifact(artifactRef(reference.artifact.digest)).pipe(
            Effect.mapError(() => resolutionFailure(
              'broken',
              'target-not-found',
              'Recursive evidence artifact is unavailable',
            )),
          )),
        Effect.flatMap((stored) => {
          const actualHash = `sha256:${new Bun.CryptoHasher('sha256')
            .update(stored.bytes)
            .digest('hex')}`
          if (actualHash !== reference.artifact.digest) {
            return Effect.fail(resolutionFailure(
              'broken',
              'artifact-hash-mismatch',
              'Recursive evidence artifact hash does not match',
            ))
          }
          if (stored.byteLength !== reference.artifact.byteLength) {
            return Effect.fail(resolutionFailure(
              'broken',
              'artifact-metadata-mismatch',
              'Recursive evidence artifact length does not match',
            ))
          }
          return Effect.try({
            try: () => JSON.parse(new TextDecoder().decode(stored.bytes)),
            catch: () => resolutionFailure(
              'broken',
              'artifact-metadata-mismatch',
              'Recursive evidence artifact is not valid JSON',
            ),
          }).pipe(
            Effect.flatMap(Schema.decodeUnknown(RecursiveArtifactLocatorIndex)),
            Effect.mapError(() => resolutionFailure(
              'broken',
              'artifact-metadata-mismatch',
              'Recursive evidence artifact cannot be decoded',
            )),
            Effect.flatMap((artifact) => {
              if (!artifact.sourceVersionIds.includes(reference.sourceVersionId)) {
                return Effect.fail(resolutionFailure(
                  'broken',
                  'artifact-metadata-mismatch',
                  'Recursive evidence source version is absent from its artifact scope',
                ))
              }
              const record = artifact.records.find((candidate) =>
                candidate.locator === reference.locator
                && candidate.sourceVersionId === reference.sourceVersionId)
              return record === undefined
                ? Effect.fail(resolutionFailure(
                    'broken',
                    'locator-mismatch',
                    'Recursive evidence locator and source version are absent from its artifact',
                  ))
                : record.excerpt !== renderRecursiveEvidenceExcerpt(record)
                  ? Effect.fail(resolutionFailure(
                      'broken',
                      'artifact-metadata-mismatch',
                      'Recursive evidence excerpt is not canonical',
                    ))
                  : Effect.succeed({ reference, excerpt: record.excerpt })
            }),
          )
        }),
      )
    },
  }
}
