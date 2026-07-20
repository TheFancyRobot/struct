import {
  DirectoryRelativePath,
  JobClaimError,
  Sha256Digest,
  type RecursiveBatchInput,
  type RecursiveEvidenceReference,
} from '@struct/domain'
import {
  BatchEvidenceArtifacts,
  RECURSIVE_EVIDENCE_MEDIA_TYPE,
  computeBatchEvidenceTransformationIdentity,
  computeRecursiveEvidenceId,
  validateRecursiveBatchInputContract,
  type BuiltRecursiveEvidenceArtifact,
} from '@struct/research-engine'
import {
  publishAnalysisArtifact,
  type ArtifactStoreShape,
} from '@struct/source-storage'
import {
  canonicalJson,
  validateBatchSelectionPlan,
  /* eslint-disable no-unused-vars -- Babel's parser does not mark type-only imports as used. */
  type BatchEvidenceSource,
  type BatchSelectionPlan,
  /* eslint-enable no-unused-vars */
} from '@struct/retrieval'
import { Effect, Option, Schema } from 'effect'
/* eslint-disable no-unused-vars -- Type-only import is consumed by TypeScript. */
import type {
  RecursiveProgressPublisher as typeRecursiveProgressPublisher,
} from './recursive-progress.js'
/* eslint-enable no-unused-vars */

export interface CommittedPartitionEvidenceArtifact {
  readonly version: '1'
  readonly batchId: RecursiveBatchInput['id']
  readonly partitionId: RecursiveBatchInput['partition']['id']
  readonly queryIdentity: typeof Sha256Digest.Type
  readonly transformationIdentity: typeof Sha256Digest.Type
  readonly commitDigest: typeof Sha256Digest.Type
  readonly evidenceCount: number
  readonly artifact: {
    readonly digest: typeof Sha256Digest.Type
    readonly byteLength: number
    readonly mediaType: BuiltRecursiveEvidenceArtifact['mediaType']
  }
  readonly evidence: ReadonlyArray<RecursiveEvidenceReference>
}

export type PartitionEvidenceArtifactEvent = {
  readonly type: 'partition-evidence-artifact-committed'
  readonly batchId: RecursiveBatchInput['id']
  readonly partitionId: RecursiveBatchInput['partition']['id']
  readonly queryIdentity: typeof Sha256Digest.Type
  readonly transformationIdentity: typeof Sha256Digest.Type
  readonly artifactDigest: typeof Sha256Digest.Type
}

export interface PartitionEvidenceArtifactJournal {
  readonly load: (
    batchId: RecursiveBatchInput['id'],
    transformationIdentity: typeof Sha256Digest.Type,
  ) => Effect.Effect<
    Option.Option<CommittedPartitionEvidenceArtifact>,
    JobClaimError
  >
  /**
   * Atomically commits the complete metadata set and event, or returns the
   * already committed value when another retry won the same stable identity.
   */
  readonly commitOrLoad: (
    candidate: CommittedPartitionEvidenceArtifact,
    event: PartitionEvidenceArtifactEvent,
  ) => Effect.Effect<{
    readonly value: CommittedPartitionEvidenceArtifact
    readonly disposition: 'created' | 'existing'
  }, JobClaimError>
}

export interface BuildPartitionArtifactsDependencies {
  readonly storage: ArtifactStoreShape
  readonly journal: PartitionEvidenceArtifactJournal
  readonly loadSources: (
    batch: RecursiveBatchInput,
  ) => Effect.Effect<
    ReadonlyArray<BatchEvidenceSource>,
    JobClaimError
  >
}

function conflict(message: string) {
  return new JobClaimError({
    operation: 'build-partition-evidence-artifact',
    reason: 'idempotency-conflict',
    message,
  })
}

function computeCommitDigest(
  committed: Omit<
    CommittedPartitionEvidenceArtifact,
    'commitDigest'
  >,
): typeof Sha256Digest.Type {
  return Sha256Digest.make(
    `sha256:${new Bun.CryptoHasher('sha256')
      .update(canonicalJson({
        version: committed.version,
        batchId: committed.batchId,
        partitionId: committed.partitionId,
        queryIdentity: committed.queryIdentity,
        transformationIdentity: committed.transformationIdentity,
        evidenceCount: committed.evidenceCount,
        artifact: committed.artifact,
        evidenceIds: committed.evidence.map((item) => item.id),
      }))
      .digest('hex')}`,
  )
}

function validateCommitted(
  committed: CommittedPartitionEvidenceArtifact,
  batch: RecursiveBatchInput,
  selectionPlan: BatchSelectionPlan,
  maximumArtifactBytes: number,
  transformationIdentity: typeof Sha256Digest.Type,
): Effect.Effect<CommittedPartitionEvidenceArtifact, JobClaimError> {
  const evidenceIds = committed.evidence.map((item) => item.id)
  const sourceVersionIds = new Set(batch.partition.sourceVersionIds)
  const { commitDigest, ...withoutCommitDigest } = committed
  if (
    committed.version !== '1'
    || committed.batchId !== batch.id
    || committed.partitionId !== batch.partition.id
    || committed.queryIdentity !== selectionPlan.id
    || committed.transformationIdentity !== transformationIdentity
    || !Schema.is(Sha256Digest)(committed.artifact.digest)
    || committed.artifact.byteLength < 1
    || committed.artifact.byteLength > maximumArtifactBytes
    || committed.artifact.mediaType !== RECURSIVE_EVIDENCE_MEDIA_TYPE
    || committed.evidenceCount !== committed.evidence.length
    || commitDigest !== computeCommitDigest(withoutCommitDigest)
    || new Set(evidenceIds).size !== evidenceIds.length
    || committed.evidence.some((item) =>
      item.artifact.digest !== committed.artifact.digest
      || item.artifact.byteLength !== committed.artifact.byteLength
      || item.artifact.mediaType !== committed.artifact.mediaType
      || !sourceVersionIds.has(item.sourceVersionId)
      || !validRecordLocator(item.locator)
      || item.id !== computeRecursiveEvidenceId({
        sourceVersionId: item.sourceVersionId,
        artifact: item.artifact,
        locator: item.locator,
      }))
  ) {
    return Effect.fail(conflict(
      'Committed partition evidence does not match its stable identities',
    ))
  }
  return Effect.succeed(committed)
}

function validRecordLocator(locator: string): boolean {
  const match = /^([^#]+)#(.*)$/.exec(locator)
  if (match === null || !Schema.is(DirectoryRelativePath)(match[1])) {
    return false
  }
  const pointer = match[2]
  return pointer === ''
    || /^\/(0|[1-9][0-9]*)$/.test(pointer)
    || /^\/records\/(0|[1-9][0-9]*)$/.test(pointer)
}

export const makeBuildPartitionArtifactsJob = (
  dependencies: BuildPartitionArtifactsDependencies,
) => {
  const execute = Effect.fn('BuildPartitionArtifactsJob.execute')(function* (
    batch: RecursiveBatchInput,
    selectionPlan: BatchSelectionPlan,
    maximumArtifactBytes: number,
  ) {
    const validatedBatch = yield* validateRecursiveBatchInputContract(batch)
    const validatedPlan = yield* validateBatchSelectionPlan(selectionPlan)
    if (
      !Number.isInteger(maximumArtifactBytes)
      || maximumArtifactBytes < 1
      || maximumArtifactBytes > 67_108_864
    ) {
      return yield* conflict(
        'Partition evidence artifact byte limit is invalid',
      )
    }
    const transformationIdentity =
      computeBatchEvidenceTransformationIdentity(
        validatedPlan.id,
        validatedBatch.evidenceSchemaVersion,
        maximumArtifactBytes,
      )
    const existing = yield* dependencies.journal.load(
      validatedBatch.id,
      transformationIdentity,
    )
    if (Option.isSome(existing)) {
      return {
        committed: yield* validateCommitted(
          existing.value,
          validatedBatch,
          validatedPlan,
          maximumArtifactBytes,
          transformationIdentity,
        ),
        reused: true,
      }
    }

    const sources = yield* dependencies.loadSources(validatedBatch)
    const built = yield* BatchEvidenceArtifacts.build(
      validatedBatch,
      sources,
      validatedPlan,
      maximumArtifactBytes,
    )
    const stored = yield* publishAnalysisArtifact(dependencies.storage, {
      bytes: built.bytes,
      digest: built.digest,
      mediaType: built.mediaType,
      maximumBytes: maximumArtifactBytes,
    })
    const artifact = {
      digest: Sha256Digest.make(stored.hash),
      byteLength: stored.byteLength,
      mediaType: built.mediaType,
    }
    const evidence = built.artifact.records.map((record) => {
      const withoutId = {
        sourceVersionId: record.sourceVersionId,
        artifact,
        locator: record.locator,
      }
      return {
        ...withoutId,
        id: computeRecursiveEvidenceId(withoutId),
      }
    })
    const withoutCommitDigest = {
      version: '1',
      batchId: validatedBatch.id,
      partitionId: validatedBatch.partition.id,
      queryIdentity: validatedPlan.id,
      transformationIdentity,
      artifact,
      evidenceCount: evidence.length,
      evidence,
    } satisfies Omit<CommittedPartitionEvidenceArtifact, 'commitDigest'>
    const candidate: CommittedPartitionEvidenceArtifact = {
      ...withoutCommitDigest,
      commitDigest: computeCommitDigest(withoutCommitDigest),
    }
    const commit = yield* dependencies.journal.commitOrLoad(candidate, {
      type: 'partition-evidence-artifact-committed',
      batchId: validatedBatch.id,
      partitionId: validatedBatch.partition.id,
      queryIdentity: validatedPlan.id,
      transformationIdentity,
      artifactDigest: artifact.digest,
    })
    return {
      committed: yield* validateCommitted(
        commit.value,
        validatedBatch,
        validatedPlan,
        maximumArtifactBytes,
        transformationIdentity,
      ),
      reused: commit.disposition === 'existing',
    }
  })
  return { execute } as const
}

export const makeObservableBuildPartitionArtifactsJob = (
  dependencies: BuildPartitionArtifactsDependencies,
  publisher: typeRecursiveProgressPublisher,
  now: () => number,
) => {
  const base = makeBuildPartitionArtifactsJob(dependencies)
  return {
    execute: Effect.fn('ObservableBuildPartitionArtifactsJob.execute')(
      function* (
        batch: RecursiveBatchInput,
        selectionPlan: BatchSelectionPlan,
        maximumArtifactBytes: number,
        attempt: number,
        startedAt: number | null,
      ) {
        const outcome = yield* base.execute(
          batch,
          selectionPlan,
          maximumArtifactBytes,
        )
        const committedAt = now()
        yield* publisher.partitionCommitted({
          requestId: batch.requestId,
          planId: batch.partition.planId,
          partition: {
            id: batch.partition.id,
            nodeId: batch.nodeId,
            ordinal: batch.partition.ordinal,
            status: 'running',
            attempt,
            batches: [{
              id: batch.id,
              status: 'committed',
              attempt,
              evidenceIds: outcome.committed.evidence.map(
                (evidence) => evidence.id,
              ),
              updatedAt: committedAt,
            }],
            failureTag: null,
            startedAt,
            updatedAt: committedAt,
          },
        })
        return outcome
      },
    ),
  } as const
}
