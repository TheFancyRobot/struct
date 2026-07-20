import {
  RecursiveCorpusManifest,
  RecursiveDecompositionNodeId,
  RecursivePartitionId,
  RecursivePartitionPlan,
  RecursiveSchedulerState,
  ResearchContractValidationError,
  type RecursivePartition,
  type RecursivePartitionClaim,
  type SourceVersionId,
} from '@struct/domain'
import { Effect, Schema } from 'effect'
import {
  computeRecursiveDecompositionNodeId,
  computeRecursivePartitionId,
  validateRecursiveDecompositionContract,
  validateRecursiveRequestContract,
} from './aggregation-schema.js'

interface PartitionDraft {
  readonly id: RecursivePartitionId
  readonly ordinal: number
  readonly schemaFamily: string
  readonly pathGroup: string
  readonly sizeBand: 'empty' | 'tiny' | 'small' | 'medium' | 'large'
  readonly planId: RecursivePartition['planId']
  readonly sourceVersionIds: ReadonlyArray<SourceVersionId>
  readonly entryKeys: ReadonlyArray<string>
  readonly byteLength: number
  readonly estimatedTokens: number
  readonly estimatedCostMicros: number
  readonly estimatedArtifactBytes: number
}

interface NodeDraft {
  readonly id: RecursiveDecompositionNodeId
  readonly childIds: ReadonlyArray<RecursiveDecompositionNodeId>
  readonly partitionIds: ReadonlyArray<RecursivePartitionId>
  readonly sourceVersionIds: ReadonlyArray<SourceVersionId>
}

function stableHash(label: string, value: unknown): `sha256:${string}` {
  const digest = new Bun.CryptoHasher('sha256')
    .update(`${label}\0${canonicalJson(value)}`)
    .digest('hex')
  return `sha256:${digest}`
}

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

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize)
  if (value !== null && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value)
        .filter(([, child]) => child !== undefined)
        .sort(([left], [right]) => compareUtf8(left, right))
        .map(([key, child]) => [key, canonicalize(child)]),
    )
  }
  return value
}

function canonicalJson(value: unknown): string {
  return JSON.stringify(canonicalize(value))
}

function failure(
  reason: 'malformed' | 'invalid-identity' | 'missing-dependency' | 'cyclic-dependency' | 'fan-out-exceeded' | 'invalid-budget' | 'invalid-lineage',
  path: string,
  message: string,
): ResearchContractValidationError {
  return new ResearchContractValidationError({
    contract: 'recursive-decomposition',
    reason,
    path,
    message,
  })
}

function sizeBand(
  byteLength: number,
  maximumBytes: number,
): PartitionDraft['sizeBand'] {
  if (byteLength === 0) return 'empty'
  const ratio = byteLength / maximumBytes
  if (ratio <= 0.0625) return 'tiny'
  if (ratio <= 0.25) return 'small'
  if (ratio <= 0.5) return 'medium'
  return 'large'
}

function pathGroup(path: string): string {
  const segments = path.split('/')
  return segments.length === 1 ? '_root' : segments[0]!
}

function compareEntries(
  left: import('@struct/domain').RecursiveCorpusManifestEntry,
  right: import('@struct/domain').RecursiveCorpusManifestEntry,
  policy: import('@struct/domain').RecursiveAnalysisPolicy,
): number {
  const leftGroup = [
    left.schemaFamily,
    pathGroup(left.normalizedPath),
    sizeBand(left.byteLength, policy.maximumPartitionBytes),
    left.normalizedPath,
    left.entryKey,
  ]
  const rightGroup = [
    right.schemaFamily,
    pathGroup(right.normalizedPath),
    sizeBand(right.byteLength, policy.maximumPartitionBytes),
    right.normalizedPath,
    right.entryKey,
  ]
  return compareUtf8(canonicalJson(leftGroup), canonicalJson(rightGroup))
}

function uniqueSources(
  entries: ReadonlyArray<
    Pick<import('@struct/domain').RecursiveCorpusManifestEntry, 'sourceVersionId'>
  >,
): ReadonlyArray<SourceVersionId> {
  return Array.from(new Set(entries.map((entry) => entry.sourceVersionId)))
    .sort(compareUtf8)
}

function sameSet(
  left: ReadonlyArray<string>,
  right: ReadonlyArray<string>,
): boolean {
  const values = new Set(right)
  return values.size === left.length && left.every((value) => values.has(value))
}

function createPartitionDrafts(
  planId: string,
  researchPlanId: RecursivePartition['planId'],
  entries: ReadonlyArray<import('@struct/domain').RecursiveCorpusManifestEntry>,
  policy: import('@struct/domain').RecursiveAnalysisPolicy,
): {
  readonly partitions: ReadonlyArray<PartitionDraft>
  readonly skipped: RecursivePartitionPlan['skippedEntries']
} {
  const skipped: Array<RecursivePartitionPlan['skippedEntries'][number]> = []
  const included = entries
    .filter((entry) => {
      if (entry.disposition === 'included') return true
      skipped.push({
        entryKey: entry.entryKey,
        sourceVersionId: entry.sourceVersionId,
        normalizedPath: entry.normalizedPath,
        reason: entry.disposition,
        detail: entry.exclusionReason ?? `${entry.disposition} by manifest policy`,
      })
      return false
    })
    .sort((left, right) => compareEntries(left, right, policy))

  const drafts: PartitionDraft[] = []
  let current: import('@struct/domain').RecursiveCorpusManifestEntry[] = []
  let currentKey = ''
  let currentBytes = 0
  let currentArtifactBytes = 0

  const flush = () => {
    if (current.length === 0) return
    const ordinal = drafts.length
    const identityEntries = current.map((entry) => ({
      entryKey: entry.entryKey,
      sourceVersionId: entry.sourceVersionId,
      normalizedPath: entry.normalizedPath,
      contentDigest: entry.contentDigest,
      byteLength: entry.byteLength,
    }))
    drafts.push({
      id: RecursivePartitionId.make(stableHash('recursive-partition', {
        planId,
        group: currentKey,
        entries: identityEntries,
      })),
      ordinal,
      schemaFamily: current[0]!.schemaFamily,
      pathGroup: pathGroup(current[0]!.normalizedPath),
      sizeBand: sizeBand(
        current[0]!.byteLength,
        policy.maximumPartitionBytes,
      ),
      planId: researchPlanId,
      sourceVersionIds: uniqueSources(current),
      entryKeys: current.map((entry) => entry.entryKey),
      byteLength: current.reduce((total, entry) => total + entry.byteLength, 0),
      estimatedTokens: current.reduce(
        (total, entry) => total + entry.estimatedTokens,
        0,
      ),
      estimatedCostMicros: current.reduce(
        (total, entry) => total + entry.estimatedCostMicros,
        0,
      ),
      estimatedArtifactBytes: current.reduce(
        (total, entry) => total + entry.estimatedArtifactBytes,
        0,
      ),
    })
    current = []
    currentBytes = 0
    currentArtifactBytes = 0
  }

  for (const entry of included) {
    if (
      entry.byteLength > policy.maximumPartitionBytes
      || entry.estimatedArtifactBytes > policy.maximumArtifactBytes
    ) {
      flush()
      skipped.push({
        entryKey: entry.entryKey,
        sourceVersionId: entry.sourceVersionId,
        normalizedPath: entry.normalizedPath,
        reason: 'oversized',
        detail: entry.byteLength > policy.maximumPartitionBytes
          ? 'entry exceeds the partition byte budget'
          : 'entry exceeds the artifact byte budget',
      })
      continue
    }
    const group = canonicalJson([
      entry.schemaFamily,
      pathGroup(entry.normalizedPath),
      sizeBand(entry.byteLength, policy.maximumPartitionBytes),
      planId,
    ])
    const crossesBoundary = current.length > 0 && (
      group !== currentKey
      || current.length >= policy.maximumPartitionItems
      || currentBytes + entry.byteLength > policy.maximumPartitionBytes
      || currentArtifactBytes + entry.estimatedArtifactBytes
        > policy.maximumArtifactBytes
    )
    if (crossesBoundary) flush()
    currentKey = group
    current.push(entry)
    currentBytes += entry.byteLength
    currentArtifactBytes += entry.estimatedArtifactBytes
  }
  flush()

  return {
    partitions: drafts,
    skipped: skipped.sort((left, right) =>
      compareUtf8(left.entryKey, right.entryKey)),
  }
}

function createTree(
  request: import('@struct/domain').RecursiveAnalysisRequest,
  drafts: ReadonlyArray<PartitionDraft>,
): Effect.Effect<{
  readonly nodes: RecursivePartitionPlan['decomposition']['nodes']
  readonly partitions: ReadonlyArray<RecursivePartition>
}, ResearchContractValidationError> {
  return Effect.gen(function* () {
    const fanOut = request.policy.maximumFanOut
    if (fanOut === 1 && drafts.length > 1) {
      return yield* failure(
        'fan-out-exceeded',
        'request.policy.maximumFanOut',
        'A fan-out of one cannot represent more than one partition',
      )
    }

    let level: NodeDraft[] = []
    for (let index = 0; index < drafts.length; index += fanOut) {
      const members = drafts.slice(index, index + fanOut)
      level.push({
        id: RecursiveDecompositionNodeId.make(stableHash('recursive-leaf', {
          requestId: request.id,
          partitionIds: members.map((member) => member.id),
        })),
        childIds: [],
        partitionIds: members.map((member) => member.id),
        sourceVersionIds: Array.from(
          new Set(members.flatMap((member) => member.sourceVersionIds)),
        ).sort(compareUtf8),
      })
    }

    const all = [...level]
    while (level.length > 1) {
      const parents: NodeDraft[] = []
      for (let index = 0; index < level.length; index += fanOut) {
        const children = level.slice(index, index + fanOut)
        parents.push({
          id: RecursiveDecompositionNodeId.make(stableHash('recursive-parent', {
            requestId: request.id,
            childIds: children.map((child) => child.id),
          })),
          childIds: children.map((child) => child.id),
          partitionIds: [],
          sourceVersionIds: Array.from(
            new Set(children.flatMap((child) => child.sourceVersionIds)),
          ).sort(compareUtf8),
        })
      }
      all.push(...parents)
      level = parents
    }

    const root = level[0]
    if (root === undefined) {
      return yield* failure(
        'missing-dependency',
        'manifest.entries',
        'At least one schedulable corpus entry is required',
      )
    }
    const parentByChild = new Map<RecursiveDecompositionNodeId, RecursiveDecompositionNodeId>()
    const nodeById = new Map<RecursiveDecompositionNodeId, NodeDraft>()
    for (const node of all) {
      for (const childId of node.childIds) parentByChild.set(childId, node.id)
      nodeById.set(node.id, node)
    }
    const depthById = new Map<RecursiveDecompositionNodeId, number>([[root.id, 0]])
    const queue = [root.id]
    for (let head = 0; head < queue.length; head += 1) {
      const parentId = queue[head]!
      const parent = nodeById.get(parentId)!
      const depth = depthById.get(parentId)!
      for (const childId of parent.childIds) {
        depthById.set(childId, depth + 1)
        queue.push(childId)
      }
    }
    const maximumDepth = Math.max(...depthById.values())
    if (maximumDepth > request.policy.maximumDepth) {
      return yield* failure(
        'invalid-budget',
        'request.policy.maximumDepth',
        'The requested depth cannot represent the bounded partition tree',
      )
    }

    const topologyNodes = all
      .map((node) => ({
        id: node.id,
        groupKey: node.id,
        requestId: request.id,
        parentId: parentByChild.get(node.id) ?? null,
        depth: depthById.get(node.id)!,
        sourceVersionIds: node.id === root.id
          ? request.sourceVersionIds
          : node.sourceVersionIds,
        partitionIds: node.partitionIds,
      }))
      .sort((left, right) =>
        left.depth - right.depth || compareUtf8(left.id, right.id))
    const canonicalIdByTopologyId = new Map<
      RecursiveDecompositionNodeId,
      RecursiveDecompositionNodeId
    >()
    const nodesWithTopologyPartitionIds = topologyNodes.map((node) => {
      const parentId = node.parentId === null
        ? null
        : canonicalIdByTopologyId.get(node.parentId)!
      const withoutId = {
        groupKey: node.groupKey,
        requestId: node.requestId,
        parentId,
        depth: node.depth,
        sourceVersionIds: node.sourceVersionIds,
      }
      const id = computeRecursiveDecompositionNodeId(withoutId)
      canonicalIdByTopologyId.set(node.id, id)
      return { ...withoutId, id, partitionIds: node.partitionIds }
    })
    const nodeByPartition = new Map<RecursivePartitionId, RecursiveDecompositionNodeId>()
    for (const node of topologyNodes) {
      for (const partitionId of node.partitionIds) {
        nodeByPartition.set(
          partitionId,
          canonicalIdByTopologyId.get(node.id)!,
        )
      }
    }
    const canonicalPartitionIdByTopologyId = new Map<
      RecursivePartitionId,
      RecursivePartitionId
    >()
    const partitions = drafts.map((draft) => {
      const withoutId = {
        nodeId: nodeByPartition.get(draft.id)!,
        schemaFamily: draft.schemaFamily,
        pathGroup: draft.pathGroup,
        sizeBand: draft.sizeBand,
        planId: draft.planId,
        sourceVersionIds: draft.sourceVersionIds,
        entryKeys: draft.entryKeys,
        byteLength: draft.byteLength,
        estimatedTokens: draft.estimatedTokens,
        estimatedCostMicros: draft.estimatedCostMicros,
        estimatedArtifactBytes: draft.estimatedArtifactBytes,
      }
      const id = computeRecursivePartitionId(withoutId)
      canonicalPartitionIdByTopologyId.set(draft.id, id)
      return { ...withoutId, id, ordinal: draft.ordinal }
    })
    const nodes = nodesWithTopologyPartitionIds.map((node) => ({
      ...node,
      partitionIds: node.partitionIds.map((partitionId) =>
        canonicalPartitionIdByTopologyId.get(partitionId)!),
    }))
    return { nodes, partitions }
  })
}

function assertPlan(
  plan: RecursivePartitionPlan,
): Effect.Effect<void, ResearchContractValidationError> {
  return Effect.gen(function* () {
    const decoded = Schema.decodeUnknownEither(RecursivePartitionPlan)(plan)
    if (decoded._tag === 'Left') {
      return yield* failure(
        'malformed',
        'plan',
        'Reconstructed recursive partition plan is malformed',
      )
    }
    yield* validateRecursiveRequestContract(plan.request)
    yield* validateRecursiveDecompositionContract(plan.decomposition)
    if (plan.decomposition.request.id !== plan.request.id) {
      return yield* failure(
        'invalid-lineage',
        'plan.decomposition.request',
        'Partition plan and decomposition must carry the same request',
      )
    }
    const expectedPlanId = stableHash('recursive-partition-plan', {
      manifestDigest: plan.manifestDigest,
      requestId: plan.request.id,
      objectiveSignature: plan.request.objectiveSignature,
      planId: plan.request.planId,
      sourceVersionIds: Array.from(plan.request.sourceVersionIds)
        .sort(compareUtf8),
      policy: plan.request.policy,
    })
    if (plan.id !== expectedPlanId) {
      return yield* failure(
        'invalid-identity',
        'plan.id',
        'Partition plan identity does not match its canonical inputs',
      )
    }
    const partitionIds = new Set(plan.partitions.map((partition) => partition.id))
    const nodeIds = new Set(plan.decomposition.nodes.map((node) => node.id))
    const referencedPartitionIds = plan.decomposition.nodes.flatMap(
      (node) => node.partitionIds,
    )
    if (
      partitionIds.size !== plan.partitions.length
      || new Set(referencedPartitionIds).size !== referencedPartitionIds.length
      || referencedPartitionIds.length !== plan.partitions.length
      || referencedPartitionIds.some((id) => !partitionIds.has(id))
    ) {
      return yield* failure(
        'invalid-lineage',
        'plan.partitions',
        'Decomposition nodes must cover every partition exactly once',
      )
    }
    for (const [ordinal, partition] of plan.partitions.entries()) {
      if (
        partition.ordinal !== ordinal
        || partition.planId !== plan.request.planId
        || !nodeIds.has(partition.nodeId)
        || partition.id !== computeRecursivePartitionId(partition)
        || partition.entryKeys.length
          > plan.request.policy.maximumPartitionItems
        || partition.byteLength > plan.request.policy.maximumPartitionBytes
        || partition.estimatedArtifactBytes
          > plan.request.policy.maximumArtifactBytes
      ) {
        return yield* failure(
          'invalid-lineage',
          `plan.partitions.${partition.id}`,
          'Partition identity, ordinal, lineage, or bounds are invalid',
        )
      }
    }
    const estimatedTokens = plan.partitions.reduce(
      (total, partition) => total + partition.estimatedTokens,
      0,
    )
    const estimatedCostMicros = plan.partitions.reduce(
      (total, partition) => total + partition.estimatedCostMicros,
      0,
    )
    const estimatedArtifactBytes = plan.partitions.reduce(
      (total, partition) => total + partition.estimatedArtifactBytes,
      0,
    )
    if (
      plan.partitions.length > plan.request.policy.maximumArtifacts
      || plan.estimatedTokens !== estimatedTokens
      || plan.estimatedCostMicros !== estimatedCostMicros
      || plan.estimatedArtifactBytes !== estimatedArtifactBytes
      || estimatedTokens > plan.request.policy.maximumTokens
      || estimatedCostMicros
        > plan.request.policy.maximumEstimatedCostMicros
    ) {
      return yield* failure(
        'invalid-budget',
        'plan',
        'Partition plan estimates do not match its bounded partitions',
      )
    }
  })
}

function assertState(
  plan: RecursivePartitionPlan,
  state: RecursiveSchedulerState,
): Effect.Effect<void, ResearchContractValidationError> {
  return Effect.gen(function* () {
    yield* assertPlan(plan)
    const decoded = Schema.decodeUnknownEither(RecursiveSchedulerState)(state)
    if (decoded._tag === 'Left') {
      return yield* failure(
        'malformed',
        'scheduler',
        'Reconstructed scheduler state is malformed',
      )
    }
    if (state.planId !== plan.id || state.manifestDigest !== plan.manifestDigest) {
      return yield* failure(
        'invalid-identity',
        'scheduler',
        'Scheduler state does not match the recursive partition plan',
      )
    }
    const expected = new Set(plan.partitions.map((partition) => partition.id))
    if (
      state.progress.length !== expected.size
      || new Set(state.progress.map((progress) => progress.partitionId)).size
        !== state.progress.length
      || state.progress.some((progress) => !expected.has(progress.partitionId))
    ) {
      return yield* failure(
        'invalid-lineage',
        'scheduler.progress',
        'Scheduler progress must cover every partition exactly once',
      )
    }
    if (
      state.consumedTokens > plan.request.policy.maximumTokens
      || state.consumedCostMicros
        > plan.request.policy.maximumEstimatedCostMicros
      || state.progress.some((progress) =>
        progress.artifact !== null
        && progress.artifact.byteLength
          > plan.request.policy.maximumArtifactBytes)
    ) {
      return yield* failure(
        'invalid-budget',
        'scheduler',
        'Scheduler state exceeds the recursive execution budget',
      )
    }
    const committedArtifactBytes = state.progress.reduce(
      (total, item) => total + (item.artifact?.byteLength ?? 0),
      0,
    )
    if (state.committedArtifactBytes !== committedArtifactBytes) {
      return yield* failure(
        'invalid-lineage',
        'scheduler.committedArtifactBytes',
        'Committed artifact bytes must equal the retained partition artifacts',
      )
    }
    for (const item of state.progress) {
      const running = item.status === 'running'
      const completed = item.status === 'completed'
      const terminal = item.status === 'failed' || item.status === 'cancelled'
      if (
        (running && (
          item.lease === null
          || item.lease.attempt !== item.attempt
          || item.lease.id !== stableHash('recursive-partition-lease', {
            planId: plan.id,
            partitionId: item.partitionId,
            attempt: item.attempt,
          })
          || item.artifact !== null
          || item.terminalReason !== null
        ))
        || (completed && (
          item.lease !== null
          || item.artifact === null
          || item.terminalReason?.kind !== 'completed'
        ))
        || (terminal && (
          item.lease !== null
          || item.artifact !== null
          || item.terminalReason === null
        ))
        || (
          (item.status === 'queued' || item.status === 'retryable')
          && (
            item.lease !== null
            || item.artifact !== null
            || item.terminalReason !== null
          )
        )
      ) {
        return yield* failure(
          'invalid-lineage',
          `scheduler.progress.${item.partitionId}`,
          'Partition progress lease, artifact, and terminal metadata are inconsistent',
        )
      }
    }
    const allCompleted = state.progress.every(
      (item) => item.status === 'completed',
    )
    const allTerminal = state.progress.every((item) =>
      item.status === 'completed'
      || item.status === 'failed'
      || item.status === 'cancelled')
    if (
      (state.status === 'completed' && !allCompleted)
      || (
        (state.status === 'failed' || state.status === 'partial')
        && (!allTerminal || allCompleted)
      )
      || (
        state.status === 'cancelled'
        && state.progress.some((item) =>
          item.status !== 'completed' && item.status !== 'cancelled')
      )
      || (
        (state.status === 'queued'
          || state.status === 'running'
          || state.status === 'paused')
        && allTerminal
      )
    ) {
      return yield* failure(
        'invalid-lineage',
        'scheduler.status',
        'Scheduler status does not match its partition progress',
      )
    }
  })
}

function isCounter(value: number): boolean {
  return Number.isFinite(value) && Number.isInteger(value) && value >= 0
}

export class CorpusPartitioning extends Effect.Service<CorpusPartitioning>()(
  'CorpusPartitioning',
  {
    accessors: true,
    effect: Effect.succeed({
      validate: Effect.fn('CorpusPartitioning.validate')(function* (
        plan: RecursivePartitionPlan,
        state: RecursiveSchedulerState,
      ) {
        yield* assertState(plan, state)
        return { plan, state }
      }),

      plan: Effect.fn('CorpusPartitioning.plan')(function* (
        manifestInput: unknown,
        requestInput: unknown,
      ) {
        const decodedRequest = yield* validateRecursiveRequestContract(requestInput)
        const request: import('@struct/domain').RecursiveAnalysisRequest = {
          ...decodedRequest,
          sourceVersionIds: Array.from(decodedRequest.sourceVersionIds)
            .sort(compareUtf8),
        }
        const manifest = yield* Schema.decodeUnknown(RecursiveCorpusManifest)(
          manifestInput,
        ).pipe(
          Effect.mapError(() =>
            failure(
              'malformed',
              'manifest',
              'Recursive corpus manifest metadata is invalid',
            )),
        )
        const manifestSources = uniqueSources(manifest.entries)
        if (!sameSet(request.sourceVersionIds, manifestSources)) {
          return yield* failure(
            'invalid-lineage',
            'manifest.entries.sourceVersionId',
            'Manifest source versions must exactly match the recursive request',
          )
        }
        const planId = stableHash('recursive-partition-plan', {
          manifestDigest: manifest.digest,
          requestId: request.id,
          objectiveSignature: request.objectiveSignature,
          planId: request.planId,
          sourceVersionIds: Array.from(request.sourceVersionIds)
            .sort(compareUtf8),
          policy: request.policy,
        })
        const created = createPartitionDrafts(
          planId,
          request.planId,
          manifest.entries,
          request.policy,
        )
        if (created.partitions.length > request.policy.maximumArtifacts) {
          return yield* failure(
            'invalid-budget',
            'request.policy.maximumArtifacts',
            'Partition count exceeds the artifact count budget',
          )
        }
        const estimatedTokens = created.partitions.reduce(
          (total, partition) => total + partition.estimatedTokens,
          0,
        )
        const estimatedCostMicros = created.partitions.reduce(
          (total, partition) => total + partition.estimatedCostMicros,
          0,
        )
        const estimatedArtifactBytes = created.partitions.reduce(
          (total, partition) => total + partition.estimatedArtifactBytes,
          0,
        )
        if (estimatedTokens > request.policy.maximumTokens) {
          return yield* failure(
            'invalid-budget',
            'request.policy.maximumTokens',
            'Estimated partition tokens exceed the recursive token budget',
          )
        }
        if (estimatedCostMicros > request.policy.maximumEstimatedCostMicros) {
          return yield* failure(
            'invalid-budget',
            'request.policy.maximumEstimatedCostMicros',
            'Estimated partition cost exceeds the recursive model-cost budget',
          )
        }
        const tree = yield* createTree(request, created.partitions)
        const decomposition = yield* validateRecursiveDecompositionContract({
          request,
          nodes: tree.nodes,
        })
        return {
          version: '1' as const,
          id: planId,
          manifestDigest: manifest.digest,
          request,
          decomposition,
          partitions: tree.partitions,
          skippedEntries: created.skipped,
          estimatedTokens,
          estimatedCostMicros,
          estimatedArtifactBytes,
        } satisfies RecursivePartitionPlan
      }),

      initialState: Effect.fn('CorpusPartitioning.initialState')((
        plan: RecursivePartitionPlan,
      ) => Effect.succeed({
        version: '1' as const,
        planId: plan.id,
        manifestDigest: plan.manifestDigest,
        status: 'queued' as const,
        elapsedMilliseconds: 0,
        consumedTokens: 0,
        consumedCostMicros: 0,
        committedArtifactBytes: 0,
        progress: plan.partitions.map((partition) => ({
          partitionId: partition.id,
          status: 'queued' as const,
          attempt: 0,
          lease: null,
          artifact: null,
          terminalReason: null,
        })),
      } satisfies RecursiveSchedulerState)),

      claim: Effect.fn('CorpusPartitioning.claim')(function* (
        plan: RecursivePartitionPlan,
        state: RecursiveSchedulerState,
        elapsedMilliseconds: number,
      ) {
        yield* assertState(plan, state)
        if (
          !isCounter(elapsedMilliseconds)
          || elapsedMilliseconds < state.elapsedMilliseconds
        ) {
          return yield* failure(
            'malformed',
            'scheduler.elapsedMilliseconds',
            'Elapsed time must be a monotonic non-negative integer',
          )
        }
        if (
          state.status === 'cancelled'
          || state.status === 'completed'
          || state.status === 'failed'
          || state.status === 'partial'
        ) {
          return { state, claims: [] as ReadonlyArray<RecursivePartitionClaim> }
        }
        if (elapsedMilliseconds > plan.request.policy.maximumElapsedMilliseconds) {
          const progress = state.progress.map((item) =>
            item.status === 'completed'
              || item.status === 'failed'
              || item.status === 'cancelled'
              ? item
              : {
                  ...item,
                  status: 'failed' as const,
                  lease: null,
                  terminalReason: {
                    kind: 'time-limit' as const,
                    limit: plan.request.policy.maximumElapsedMilliseconds,
                  },
                })
          return {
            state: {
              ...state,
              status: 'failed' as const,
              elapsedMilliseconds,
              progress,
            },
            claims: [] as ReadonlyArray<RecursivePartitionClaim>,
          }
        }
        const active = state.progress.filter((item) => item.status === 'running').length
        const capacity = Math.max(
          0,
          plan.request.policy.maximumConcurrency - active,
        )
        const selected = state.progress
          .filter((item) => item.status === 'queued' || item.status === 'retryable')
          .slice(0, capacity)
        const claims = selected.map((item) => {
          const partition = plan.partitions.find(
            (candidate) => candidate.id === item.partitionId,
          )!
          const attempt = item.attempt + 1
          return {
            partition,
            lease: {
              id: stableHash('recursive-partition-lease', {
                planId: plan.id,
                partitionId: item.partitionId,
                attempt,
              }),
              attempt,
            },
          }
        })
        const leases = new Map(
          claims.map((claim) => [claim.partition.id, claim.lease] as const),
        )
        const progress = state.progress.map((item) => {
          const lease = leases.get(item.partitionId)
          return lease === undefined
            ? item
            : {
                ...item,
                status: 'running' as const,
                attempt: lease.attempt,
                lease,
                terminalReason: null,
              }
        })
        const terminal = claims.length === 0
          && active === 0
          && progress.every((item) =>
            item.status === 'completed'
            || item.status === 'failed'
            || item.status === 'cancelled')
        const terminalStatus = terminal
          ? progress.every((item) => item.status === 'completed')
            ? 'completed' as const
            : 'partial' as const
          : undefined
        return {
          state: {
            ...state,
            status: terminalStatus
              ?? (claims.length > 0 || active > 0
                ? 'running' as const
                : state.status),
            elapsedMilliseconds,
            progress,
          },
          claims,
        }
      }),

      commit: Effect.fn('CorpusPartitioning.commit')(function* (
        plan: RecursivePartitionPlan,
        state: RecursiveSchedulerState,
        claim: RecursivePartitionClaim,
        artifact: import('@struct/domain').ResearchArtifactRef,
        usage: {
          readonly tokens: number
          readonly estimatedCostMicros: number
        },
      ) {
        yield* assertState(plan, state)
        if (
          !isCounter(usage.tokens)
          || !isCounter(usage.estimatedCostMicros)
        ) {
          return yield* failure(
            'malformed',
            'scheduler.usage',
            'Partition usage must contain non-negative integer counters',
          )
        }
        const current = state.progress.find(
          (item) => item.partitionId === claim.partition.id,
        )
        if (current === undefined) {
          return yield* failure(
            'missing-dependency',
            'scheduler.progress',
            'Claimed partition is absent from scheduler state',
          )
        }
        if (current.status === 'completed') {
          if (current.artifact?.digest === artifact.digest) return state
          return yield* failure(
            'invalid-lineage',
            'scheduler.progress.artifact',
            'A committed partition cannot be replaced by a different artifact',
          )
        }
        if (
          current.status !== 'running'
          || current.lease?.id !== claim.lease.id
          || current.lease.attempt !== claim.lease.attempt
        ) {
          return yield* failure(
            'invalid-identity',
            'scheduler.progress.lease',
            'Partition commit requires the active attempt-fenced lease',
          )
        }
        const consumedTokens = state.consumedTokens + usage.tokens
        const consumedCostMicros = state.consumedCostMicros
          + usage.estimatedCostMicros
        const committedArtifactBytes = state.committedArtifactBytes
          + artifact.byteLength
        if (consumedTokens > plan.request.policy.maximumTokens) {
          return yield* failure(
            'invalid-budget',
            'scheduler.consumedTokens',
            'Partition commit exceeds the recursive token budget',
          )
        }
        if (
          consumedCostMicros
          > plan.request.policy.maximumEstimatedCostMicros
        ) {
          return yield* failure(
            'invalid-budget',
            'scheduler.consumedCostMicros',
            'Partition commit exceeds the recursive model-cost budget',
          )
        }
        if (artifact.byteLength > plan.request.policy.maximumArtifactBytes) {
          return yield* failure(
            'invalid-budget',
            'scheduler.artifact.byteLength',
            'Partition artifact exceeds the per-artifact byte budget',
          )
        }
        const progress = state.progress.map((item) =>
          item.partitionId === current.partitionId
            ? {
                ...item,
                status: 'completed' as const,
                lease: null,
                artifact,
                terminalReason: { kind: 'completed' as const },
              }
            : item)
        const allTerminal = progress.every((item) =>
          item.status === 'completed'
          || item.status === 'failed'
          || item.status === 'cancelled')
        return {
          ...state,
          status: allTerminal
            ? progress.every((item) => item.status === 'completed')
              ? 'completed' as const
              : 'partial' as const
            : 'running' as const,
          consumedTokens,
          consumedCostMicros,
          committedArtifactBytes,
          progress,
        }
      }),

      fail: Effect.fn('CorpusPartitioning.fail')(function* (
        plan: RecursivePartitionPlan,
        state: RecursiveSchedulerState,
        claim: RecursivePartitionClaim,
      ) {
        yield* assertState(plan, state)
        const current = state.progress.find(
          (item) => item.partitionId === claim.partition.id,
        )
        if (
          current?.status !== 'running'
          || current.lease?.id !== claim.lease.id
        ) {
          return yield* failure(
            'invalid-identity',
            'scheduler.progress.lease',
            'Partition failure requires the active attempt-fenced lease',
          )
        }
        const exhausted = current.attempt
          >= plan.request.policy.maximumPartitionAttempts
        const progress = state.progress.map((item) =>
          item.partitionId === current.partitionId
            ? {
                ...item,
                status: exhausted ? 'failed' as const : 'retryable' as const,
                lease: null,
                terminalReason: exhausted
                  ? {
                      kind: 'partition-attempts-exhausted' as const,
                      limit: plan.request.policy.maximumPartitionAttempts,
                    }
                  : null,
              }
            : item)
        const allTerminal = progress.every((item) =>
          item.status === 'completed'
          || item.status === 'failed'
          || item.status === 'cancelled')
        return {
          ...state,
          status: exhausted && allTerminal
            ? 'partial' as const
            : 'running' as const,
          progress,
        }
      }),

      resume: Effect.fn('CorpusPartitioning.resume')(function* (
        plan: RecursivePartitionPlan,
        state: RecursiveSchedulerState,
      ) {
        yield* assertState(plan, state)
        if (
          state.status === 'completed'
          || state.status === 'cancelled'
          || state.status === 'failed'
          || state.status === 'partial'
        ) return state
        const progress = state.progress.map((item) => {
          if (item.status !== 'running') return item
          if (
            item.attempt
            >= plan.request.policy.maximumPartitionAttempts
          ) {
            return {
              ...item,
              status: 'failed' as const,
              lease: null,
              terminalReason: {
                kind: 'partition-attempts-exhausted' as const,
                limit: plan.request.policy.maximumPartitionAttempts,
              },
            }
          }
          return {
            ...item,
            status: 'retryable' as const,
            lease: null,
          }
        })
        const allTerminal = progress.every((item) =>
          item.status === 'completed'
          || item.status === 'failed'
          || item.status === 'cancelled')
        return {
          ...state,
          status: allTerminal ? 'partial' as const : 'queued' as const,
          progress,
        }
      }),

      cancel: Effect.fn('CorpusPartitioning.cancel')(function* (
        plan: RecursivePartitionPlan,
        state: RecursiveSchedulerState,
      ) {
        yield* assertState(plan, state)
        if (
          state.status === 'completed'
          || state.status === 'cancelled'
          || state.status === 'failed'
          || state.status === 'partial'
        ) return state
        return {
          ...state,
          status: 'cancelled' as const,
          progress: state.progress.map((item) =>
            item.status === 'completed'
              ? item
              : {
                  ...item,
                  status: 'cancelled' as const,
                  lease: null,
                  terminalReason: { kind: 'cancelled' as const },
                }),
        }
      }),
    }),
  },
) {}
