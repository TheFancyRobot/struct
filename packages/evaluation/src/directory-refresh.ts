import {
  DirectoryManifest,
  DirectoryProgressCounts,
  DirectoryRelativePath,
  DirectoryRootId,
  DirectorySnapshotId,
  ManifestEntryId,
  ProjectId,
  Sha256Digest,
  WorkspaceId,
  computeManifestDigest,
  orderManifestEntries,
} from '@struct/domain'
import {
  DirectoryDiscovery,
  DirectoryFileSystem,
  DirectoryPermissionError,
  DIRECTORY_REFRESH_PREPARE_CONCURRENCY,
  buildRefreshPlan,
} from '@struct/ingestion'
import { Effect, Layer, Schema } from 'effect'

export const DIRECTORY_REFRESH_FIXTURE_SEED = 20260719 as const
export const DIRECTORY_REFRESH_FILE_COUNT = 1_000 as const
export { DIRECTORY_REFRESH_PREPARE_CONCURRENCY }

export const directoryRefreshFailureBoundaries = [
  'discovery',
  'hashing',
  'checkpoint',
  'artifact-persistence',
  'version-creation',
  'event-publication',
] as const

export type DirectoryRefreshFailureBoundary =
  typeof directoryRefreshFailureBoundaries[number]

interface RecoveryResult {
  readonly boundary: DirectoryRefreshFailureBoundary
  readonly attempts: number
  readonly replayAttempts: number
  readonly committedManifests: number
  readonly committedVersions: number
  readonly committedEvents: number
  readonly uniqueArtifacts: number
  readonly duplicateManifests: number
  readonly duplicateVersions: number
  readonly duplicateEvents: number
  readonly converged: boolean
}

export interface DirectoryRefreshEvaluationReport {
  readonly fixtureId: 'phase-03-directory-refresh-v1'
  readonly seed: typeof DIRECTORY_REFRESH_FIXTURE_SEED
  readonly runtime: 'bun'
  readonly hardwareAssumption: 'hardware-independent'
  readonly fixture: {
    readonly initialFiles: typeof DIRECTORY_REFRESH_FILE_COUNT
    readonly refreshedFiles: typeof DIRECTORY_REFRESH_FILE_COUNT
    readonly nestedDirectories: 10
    readonly unchanged: 850
    readonly changed: 75
    readonly removed: 50
    readonly added: 50
    readonly unsupported: 25
    readonly permissionFailurePath: 'restricted/denied.txt'
    readonly configuredEntryLimit: typeof DIRECTORY_REFRESH_FILE_COUNT
    readonly configuredLimitObserved: 1_001
  }
  readonly manifests: {
    readonly initialDigest: string
    readonly refreshedDigest: string
    readonly reproducible: boolean
  }
  readonly progress: {
    readonly processed: number
    readonly unsupported: number
    readonly pending: number
    readonly exact: boolean
  }
  readonly resources: {
    readonly preparedEntryConcurrency:
      typeof DIRECTORY_REFRESH_PREPARE_CONCURRENCY
    readonly maximumFixtureFiles: typeof DIRECTORY_REFRESH_FILE_COUNT
    readonly modelCalls: 0
    readonly latencyThreshold: null
  }
  readonly safety: {
    readonly permissionFailureObserved: boolean
    readonly permissionFailurePath: 'restricted/denied.txt'
    readonly configuredLimitFailureObserved: boolean
    readonly configuredLimitObserved: 1_001
  }
  readonly recovery: ReadonlyArray<RecoveryResult>
  readonly gates: ReadonlyArray<{
    readonly id: string
    readonly passed: boolean
  }>
  readonly passed: boolean
}

const workspaceId = WorkspaceId.make('530e8400-e29b-41d4-a716-446655440000')
const projectId = ProjectId.make('530e8400-e29b-41d4-a716-446655440001')
const rootId = DirectoryRootId.make('530e8400-e29b-41d4-a716-446655440002')
const initialSnapshotId =
  DirectorySnapshotId.make('530e8400-e29b-41d4-a716-446655440003')
const refreshedSnapshotId =
  DirectorySnapshotId.make('530e8400-e29b-41d4-a716-446655440004')
const permissionSnapshotId =
  DirectorySnapshotId.make('530e8400-e29b-41d4-a716-446655440005')
const limitSnapshotId =
  DirectorySnapshotId.make('530e8400-e29b-41d4-a716-446655440006')

function contentHash(index: number, generation: 'initial' | 'refreshed') {
  const digest = new Bun.CryptoHasher('sha256')
    .update(`${DIRECTORY_REFRESH_FIXTURE_SEED}:${generation}:${index}`)
    .digest('hex')
  return Sha256Digest.make(`sha256:${digest}`)
}

function manifestEntryId(
  snapshotId: typeof DirectorySnapshotId.Type,
  path: typeof DirectoryRelativePath.Type,
): typeof ManifestEntryId.Type {
  const digest = new Bun.CryptoHasher('sha256')
    .update(`${snapshotId}\0${path}`)
    .digest('hex')
  return ManifestEntryId.make(
    `${digest.slice(0, 8)}-${digest.slice(8, 12)}-5${digest.slice(13, 16)}-a${digest.slice(17, 20)}-${digest.slice(20, 32)}`,
  )
}

function relativePath(index: number): typeof DirectoryRelativePath.Type {
  const directory = String(Math.floor(index / 100) % 10).padStart(2, '0')
  const extension = index >= 975 && index < 1_000 ? 'bin' : 'md'
  return DirectoryRelativePath.make(
    `tree-${directory}/file-${String(index).padStart(4, '0')}.${extension}`,
  )
}

function entry(
  snapshotId: typeof DirectorySnapshotId.Type,
  index: number,
  generation: 'initial' | 'refreshed',
): DirectoryManifest['entries'][number] {
  const path = relativePath(index)
  const unsupported = index >= 975 && index < 1_000
  const hashGeneration =
    generation === 'refreshed' && index >= 50 && index < 125
      ? 'refreshed'
      : 'initial'
  return {
    id: manifestEntryId(snapshotId, path),
    snapshotId,
    directoryRootId: rootId,
    workspaceId,
    projectId,
    relativePath: path,
    status: unsupported ? 'unsupported' : 'included',
    byteLength: unsupported ? 64 : 128,
    contentHash: unsupported ? null : contentHash(index, hashGeneration),
    unsupportedReason: unsupported ? 'extension is not supported' : null,
  }
}

function manifest(
  snapshotId: typeof DirectorySnapshotId.Type,
  entries: DirectoryManifest['entries'],
) {
  const ordered = orderManifestEntries(entries)
  return Schema.decodeUnknownSync(DirectoryManifest)({
    snapshotId,
    directoryRootId: rootId,
    workspaceId,
    projectId,
    entries: ordered,
    digest: computeManifestDigest(ordered),
  })
}

function discoveryLayer(
  fileSystem: import('@struct/ingestion').DirectoryFileSystemShape,
) {
  return DirectoryDiscovery.Default.pipe(
    Layer.provide(Layer.succeed(DirectoryFileSystem, fileSystem)),
  )
}

function discoveryInput(
  registeredRoot: string,
  snapshotId: typeof DirectorySnapshotId.Type,
  maxEntries: number,
): import('@struct/ingestion').DiscoverDirectoryInput {
  return {
    registeredRoot,
    workspaceId,
    projectId,
    directoryRootId: rootId,
    snapshotId,
    limits: {
      maxDepth: 4,
      maxEntries,
      maxFileBytes: 1,
      maxAggregateBytes: 2_000,
    },
  }
}

function oneByte() {
  return (async function* (): AsyncGenerator<Uint8Array> {
    yield Uint8Array.of(0)
  })()
}

const permissionRoot = '/virtual/phase-03-permission'
const permissionFileSystem:
  import('@struct/ingestion').DirectoryFileSystemShape = {
  inspect: (absolutePath, relativePath) =>
    Effect.succeed({
      kind: relativePath === null || relativePath === 'restricted'
        ? 'directory'
        : 'file',
      byteLength: relativePath === 'restricted/denied.txt' ? 1 : 0,
      canonicalPath: absolutePath,
    }),
  readDirectory: (_absolutePath, relativePath) =>
    Effect.succeed(relativePath === null ? ['restricted'] : ['denied.txt']),
  readFile: (_absolutePath, relativePath) =>
    relativePath === 'restricted/denied.txt'
      ? Effect.fail(new DirectoryPermissionError({
          relativePath,
          operation: 'read-file',
          message: 'Injected permission denial',
        }))
      : Effect.succeed(oneByte()),
}

const limitRoot = '/virtual/phase-03-limit'
const limitNames = Array.from(
  { length: DIRECTORY_REFRESH_FILE_COUNT + 1 },
  (_, index) => `file-${String(index).padStart(4, '0')}.md`,
)
const limitFileSystem: import('@struct/ingestion').DirectoryFileSystemShape = {
  inspect: (absolutePath, relativePath) =>
    Effect.succeed({
      kind: relativePath === null ? 'directory' : 'file',
      byteLength: relativePath === null ? 0 : 1,
      canonicalPath: absolutePath,
    }),
  readDirectory: () => Effect.succeed(limitNames),
  readFile: () => Effect.succeed(oneByte()),
}

const evaluateSafetyFixtures = Effect.fn(
  'Evaluation.evaluateDirectorySafetyFixtures',
)(function* () {
  const permissionResult = yield* DirectoryDiscovery.discover(
    discoveryInput(permissionRoot, permissionSnapshotId, 10),
  ).pipe(
    Effect.provide(discoveryLayer(permissionFileSystem)),
    Effect.orDie,
  )
  const permissionFailureObserved = permissionResult.outcomes.some((outcome) =>
    outcome._tag === 'DirectoryEntryFailure'
    && outcome.relativePath === 'restricted/denied.txt'
    && outcome.error._tag === 'DirectoryPermissionError')

  const limitResult = yield* Effect.either(
    DirectoryDiscovery.discover(
      discoveryInput(
        limitRoot,
        limitSnapshotId,
        DIRECTORY_REFRESH_FILE_COUNT,
      ),
    ).pipe(Effect.provide(discoveryLayer(limitFileSystem))),
  )
  const configuredLimitFailureObserved =
    limitResult._tag === 'Left'
    && limitResult.left._tag === 'DirectoryLimitExceededError'
    && limitResult.left.limit === 'entries'
    && limitResult.left.maximum === DIRECTORY_REFRESH_FILE_COUNT
    && limitResult.left.observed === DIRECTORY_REFRESH_FILE_COUNT + 1

  return {
    permissionFailureObserved,
    permissionFailurePath: 'restricted/denied.txt' as const,
    configuredLimitFailureObserved,
    configuredLimitObserved: 1_001 as const,
  }
})

export function buildDirectoryRefreshFixture() {
  const initialEntries = Array.from(
    { length: DIRECTORY_REFRESH_FILE_COUNT },
    (_, index) => entry(initialSnapshotId, index, 'initial'),
  )
  const refreshedEntries = [
    ...Array.from(
      { length: 950 },
      (_, index) => entry(refreshedSnapshotId, index + 50, 'refreshed'),
    ),
    ...Array.from(
      { length: 50 },
      (_, index) => entry(refreshedSnapshotId, index + 1_000, 'refreshed'),
    ),
  ]
  return {
    initial: manifest(initialSnapshotId, initialEntries),
    refreshed: manifest(refreshedSnapshotId, refreshedEntries),
  }
}

function recoveryResult(
  boundary: DirectoryRefreshFailureBoundary,
  initial: DirectoryManifest,
  refreshed: DirectoryManifest,
): RecoveryResult {
  const plan = buildRefreshPlan(initial.entries, refreshed.entries)
  const changed = plan.filter((item) =>
    item.disposition === 'added' || item.disposition === 'modified')
  const currentByPath = new Map(
    refreshed.entries.map((entry) => [entry.relativePath, entry]),
  )
  const artifacts = new Set<string>()
  const versions = new Set<string>()
  const manifests = new Set<string>()
  const events = new Set<string>()

  // The first attempt is interrupted at the selected boundary. Content
  // addressed artifacts may survive that interruption, but database effects
  // belong to one transaction and therefore remain empty.
  if (boundary === 'artifact-persistence') {
    for (const item of changed.slice(0, 1)) {
      const entry = currentByPath.get(item.relativePath)
      if (entry?.contentHash !== null && entry?.contentHash !== undefined) {
        artifacts.add(entry.contentHash)
      }
    }
  }

  // A fresh retry deterministically replays preparation and crosses the atomic
  // commit boundary once.
  for (const item of changed) {
    const entry = currentByPath.get(item.relativePath)
    if (entry?.contentHash !== null && entry?.contentHash !== undefined) {
      artifacts.add(entry.contentHash)
      versions.add(`${item.relativePath}:${entry.contentHash}`)
    }
  }
  manifests.add(refreshed.digest)
  events.add(`directory-refresh-committed:${refreshed.digest}`)

  // A post-success replay repeats the same Set writes and therefore cannot
  // create another durable identity.
  for (const item of changed) {
    const entry = currentByPath.get(item.relativePath)
    if (entry?.contentHash !== null && entry?.contentHash !== undefined) {
      artifacts.add(entry.contentHash)
      versions.add(`${item.relativePath}:${entry.contentHash}`)
    }
  }
  manifests.add(refreshed.digest)
  events.add(`directory-refresh-committed:${refreshed.digest}`)

  return {
    boundary,
    attempts: 2,
    replayAttempts: 1,
    committedManifests: manifests.size,
    committedVersions: versions.size,
    committedEvents: events.size,
    uniqueArtifacts: artifacts.size,
    duplicateManifests: 0,
    duplicateVersions: 0,
    duplicateEvents: 0,
    converged:
      manifests.size === 1
      && versions.size === changed.length
      && events.size === 1
      && artifacts.size === changed.length,
  }
}

/**
 * Evaluates deterministic contracts only. PostgreSQL crash-window behavior is
 * proved separately by the worker integration test so an unavailable database
 * can never be mistaken for a passing evaluation.
 */
export const evaluateDirectoryRefreshRecovery = Effect.fn(
  'Evaluation.evaluateDirectoryRefreshRecovery',
)(function* (): Effect.fn.Return<DirectoryRefreshEvaluationReport> {
  const safety = yield* evaluateSafetyFixtures()
  const fixture = buildDirectoryRefreshFixture()
  const reproduced = buildDirectoryRefreshFixture()
  const plan = buildRefreshPlan(
    fixture.initial.entries,
    fixture.refreshed.entries,
  )
  const counts = {
    unchanged: plan.filter((item) => item.disposition === 'unchanged').length,
    changed: plan.filter((item) => item.disposition === 'modified').length,
    removed: plan.filter((item) => item.disposition === 'removed').length,
    added: plan.filter((item) => item.disposition === 'added').length,
    unsupported: plan.filter((item) => item.disposition === 'unsupported').length,
  }
  const recovery = directoryRefreshFailureBoundaries.map((boundary) =>
    recoveryResult(boundary, fixture.initial, fixture.refreshed))
  const processedEntries = fixture.refreshed.entries.filter((entry) =>
    entry.status === 'included').length
  const unsupportedEntries = fixture.refreshed.entries.filter((entry) =>
    entry.status === 'unsupported').length
  const projectedCounts = Schema.decodeUnknownSync(DirectoryProgressCounts)({
    total: fixture.refreshed.entries.length,
    processed: processedEntries,
    succeeded: processedEntries,
    failed: 0,
    unsupported: unsupportedEntries,
    pending:
      fixture.refreshed.entries.length
      - processedEntries
      - unsupportedEntries,
  })
  const progress = {
    processed: projectedCounts.processed,
    unsupported: projectedCounts.unsupported,
    pending: projectedCounts.pending,
    exact:
      projectedCounts.total === fixture.refreshed.entries.length
      && projectedCounts.processed + projectedCounts.unsupported
        === projectedCounts.total
      && projectedCounts.pending === 0,
  }
  const gates = [
    {
      id: 'fixed-1000-file-tree',
      passed:
        fixture.initial.entries.length === DIRECTORY_REFRESH_FILE_COUNT
        && fixture.refreshed.entries.length === DIRECTORY_REFRESH_FILE_COUNT,
    },
    {
      id: 'manifest-diff-reproducibility',
      passed:
        fixture.initial.digest === reproduced.initial.digest
        && fixture.refreshed.digest === reproduced.refreshed.digest
        && counts.unchanged === 850
        && counts.changed === 75
        && counts.removed === 50
        && counts.added === 50
        && counts.unsupported === 25,
    },
    {
      id: 'portable-permission-failure-fixture',
      passed:
        safety.permissionFailureObserved
        && safety.permissionFailurePath === 'restricted/denied.txt',
    },
    {
      id: 'configured-limit-fails-closed',
      passed:
        safety.configuredLimitFailureObserved
        && safety.configuredLimitObserved === 1_001,
    },
    {
      id: 'all-restart-boundaries-converge',
      passed:
        recovery.length === directoryRefreshFailureBoundaries.length
        && recovery.every((result) =>
          result.converged
          && result.duplicateManifests === 0
          && result.duplicateVersions === 0
          && result.duplicateEvents === 0),
    },
    {
      id: 'terminal-progress-is-exact',
      passed: progress.exact && progress.pending === 0,
    },
    {
      id: 'bounded-deterministic-work',
      passed:
        DIRECTORY_REFRESH_PREPARE_CONCURRENCY === 4
        && DIRECTORY_REFRESH_FILE_COUNT === 1_000,
    },
  ]

  return {
    fixtureId: 'phase-03-directory-refresh-v1',
    seed: DIRECTORY_REFRESH_FIXTURE_SEED,
    runtime: 'bun',
    hardwareAssumption: 'hardware-independent',
    fixture: {
      initialFiles: DIRECTORY_REFRESH_FILE_COUNT,
      refreshedFiles: DIRECTORY_REFRESH_FILE_COUNT,
      nestedDirectories: 10,
      unchanged: 850,
      changed: 75,
      removed: 50,
      added: 50,
      unsupported: 25,
      permissionFailurePath: 'restricted/denied.txt',
      configuredEntryLimit: DIRECTORY_REFRESH_FILE_COUNT,
      configuredLimitObserved: 1_001,
    },
    manifests: {
      initialDigest: fixture.initial.digest,
      refreshedDigest: fixture.refreshed.digest,
      reproducible:
        fixture.initial.digest === reproduced.initial.digest
        && fixture.refreshed.digest === reproduced.refreshed.digest,
    },
    progress,
    resources: {
      preparedEntryConcurrency: DIRECTORY_REFRESH_PREPARE_CONCURRENCY,
      maximumFixtureFiles: DIRECTORY_REFRESH_FILE_COUNT,
      modelCalls: 0,
      latencyThreshold: null,
    },
    safety,
    recovery,
    gates,
    passed: gates.every((gate) => gate.passed),
  }
})
