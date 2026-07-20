import { Schema } from 'effect'
import {
  RecursiveAnalysisRequest,
  RecursiveDecomposition,
  RecursivePartition,
  RecursivePartitionId,
  RecursiveTerminalReason,
} from './recursive-analysis.js'
import {
  DirectoryRelativePath,
  Sha256Digest,
} from './directory-manifest.js'
import {
  ResearchArtifactRef,
} from './research-execution.js'
import { SourceVersionId } from './branded-ids.js'

const Counter = Schema.Number.pipe(
  Schema.finite(),
  Schema.int(),
  Schema.nonNegative(),
)
const NonBlank = Schema.String.pipe(
  Schema.minLength(1),
  Schema.maxLength(512),
  Schema.filter((value) => value.trim().length > 0 || 'must not be blank'),
)
const StableIdentity = Schema.String.pipe(
  Schema.pattern(/^sha256:[0-9a-f]{64}$/),
)

function compareUtf8(left: string, right: string): number {
  const encoder = new TextEncoder()
  const leftBytes = encoder.encode(left)
  const rightBytes = encoder.encode(right)
  const sharedLength = Math.min(leftBytes.length, rightBytes.length)
  for (let index = 0; index < sharedLength; index += 1) {
    const difference = leftBytes[index]! - rightBytes[index]!
    if (difference !== 0) return difference
  }
  return leftBytes.length - rightBytes.length
}

export const RecursiveCorpusManifestEntry = Schema.Struct({
  entryKey: NonBlank,
  sourceVersionId: SourceVersionId,
  normalizedPath: DirectoryRelativePath,
  schemaFamily: NonBlank,
  byteLength: Counter,
  contentDigest: Schema.NullOr(Sha256Digest),
  disposition: Schema.Literal('included', 'excluded', 'unreadable'),
  exclusionReason: Schema.NullOr(NonBlank),
  estimatedTokens: Counter,
  estimatedCostMicros: Counter,
  estimatedArtifactBytes: Counter,
}).pipe(
  Schema.filter((entry) => [
    entry.disposition === 'included' && entry.contentDigest === null
      ? 'included corpus entries require a content digest'
      : undefined,
    entry.disposition === 'included' && entry.exclusionReason !== null
      ? 'included corpus entries cannot carry an exclusion reason'
      : undefined,
    entry.disposition !== 'included' && entry.exclusionReason === null
      ? 'excluded and unreadable corpus entries require a reason'
      : undefined,
  ]),
)
export type RecursiveCorpusManifestEntry =
  Schema.Schema.Type<typeof RecursiveCorpusManifestEntry>

export const RecursiveCorpusManifest = Schema.Struct({
  version: Schema.Literal('1'),
  digest: Sha256Digest,
  entries: Schema.Array(RecursiveCorpusManifestEntry).pipe(
    Schema.maxItems(25_000),
  ),
}).pipe(
  Schema.filter((manifest) => [
    new Set(manifest.entries.map((entry) => entry.entryKey)).size
      === manifest.entries.length
      ? undefined
      : 'corpus manifest entry keys must be unique',
    manifest.digest === computeRecursiveCorpusManifestDigest(manifest.entries)
      ? undefined
      : 'corpus manifest digest does not match its stable metadata',
  ]),
)
export type RecursiveCorpusManifest =
  Schema.Schema.Type<typeof RecursiveCorpusManifest>

export const RecursiveSkippedEntry = Schema.Struct({
  entryKey: NonBlank,
  sourceVersionId: SourceVersionId,
  normalizedPath: DirectoryRelativePath,
  reason: Schema.Literal('excluded', 'unreadable', 'oversized'),
  detail: NonBlank,
})
export type RecursiveSkippedEntry =
  Schema.Schema.Type<typeof RecursiveSkippedEntry>

export const RecursivePartitionPlan = Schema.Struct({
  version: Schema.Literal('1'),
  id: StableIdentity,
  manifestDigest: Sha256Digest,
  request: RecursiveAnalysisRequest,
  decomposition: RecursiveDecomposition,
  partitions: Schema.Array(RecursivePartition).pipe(
    Schema.maxItems(65_536),
  ),
  skippedEntries: Schema.Array(RecursiveSkippedEntry).pipe(
    Schema.maxItems(25_000),
  ),
  estimatedTokens: Counter,
  estimatedCostMicros: Counter,
  estimatedArtifactBytes: Counter,
})
export type RecursivePartitionPlan =
  Schema.Schema.Type<typeof RecursivePartitionPlan>

export const RecursivePartitionLease = Schema.Struct({
  id: StableIdentity,
  attempt: Counter.pipe(Schema.positive()),
})
export type RecursivePartitionLease =
  Schema.Schema.Type<typeof RecursivePartitionLease>

export const RecursivePartitionProgress = Schema.Struct({
  partitionId: RecursivePartitionId,
  status: Schema.Literal(
    'queued',
    'running',
    'retryable',
    'completed',
    'failed',
    'cancelled',
  ),
  attempt: Counter,
  lease: Schema.NullOr(RecursivePartitionLease),
  artifact: Schema.NullOr(ResearchArtifactRef),
  terminalReason: Schema.NullOr(RecursiveTerminalReason),
})
export type RecursivePartitionProgress =
  Schema.Schema.Type<typeof RecursivePartitionProgress>

export const RecursiveSchedulerState = Schema.Struct({
  version: Schema.Literal('1'),
  planId: StableIdentity,
  manifestDigest: Sha256Digest,
  status: Schema.Literal(
    'queued',
    'running',
    'paused',
    'completed',
    'failed',
    'cancelled',
    'partial',
  ),
  elapsedMilliseconds: Counter,
  consumedTokens: Counter,
  consumedCostMicros: Counter,
  committedArtifactBytes: Counter,
  progress: Schema.Array(RecursivePartitionProgress).pipe(
    Schema.maxItems(65_536),
  ),
})
export type RecursiveSchedulerState =
  Schema.Schema.Type<typeof RecursiveSchedulerState>

export const RecursivePartitionClaim = Schema.Struct({
  partition: RecursivePartition,
  lease: RecursivePartitionLease,
})
export type RecursivePartitionClaim =
  Schema.Schema.Type<typeof RecursivePartitionClaim>

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize)
  if (value !== null && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value)
        .sort(([left], [right]) => compareUtf8(left, right))
        .map(([key, child]) => [key, canonicalize(child)]),
    )
  }
  return value
}

export function computeRecursiveCorpusManifestDigest(
  entries: ReadonlyArray<RecursiveCorpusManifestEntry>,
): Sha256Digest {
  const stableEntries = Array.from(entries)
    .sort((left, right) => compareUtf8(left.entryKey, right.entryKey))
    .map((entry) => canonicalize(entry))
  const digest = new Bun.CryptoHasher('sha256')
    .update(JSON.stringify(stableEntries))
    .digest('hex')
  return Sha256Digest.make(`sha256:${digest}`)
}
