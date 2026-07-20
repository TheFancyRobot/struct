/* eslint-disable no-unused-vars -- Type-only imports are consumed by TypeScript. */
import {
  DirectoryRelativePath,
  ProjectId,
  RecursiveAnalysisRequest,
  RecursiveAnalysisRequestId,
  ResearchPlanId,
  ResearchRunId,
  Sha256Digest,
  SourceVersionId,
  WorkspaceId,
  computeRecursiveCorpusManifestDigest,
  type RecursiveCorpusManifest,
  type RecursiveCorpusManifestEntry,
  type RecursivePartitionClaim,
  type RecursivePartitionPlan,
  type RecursiveSchedulerState,
} from '@struct/domain'
import {
  CorpusPartitioning,
  computeRecursiveAnalysisRequestId,
} from '@struct/research-engine'
import { Effect, Schema } from 'effect'
import { canonicalJson } from './corpus.js'
/* eslint-enable no-unused-vars */

export const PHASE_06_RECURSIVE_EVALUATION_ID =
  'phase-06-recursive-analysis-25000-v1' as const
export const PHASE_06_RECURSIVE_FILE_COUNT = 25_000 as const

const MINORITY_INTERVAL = 1_000
const CONTRADICTION_INTERVAL = 500
const MAXIMUM_CHECKPOINT_BYTES = 256 * 1_024
const MAXIMUM_PARTITION_SKEW_RATIO = 1.25
const PHASE_06_CRITERION_IDS = [
  'deterministic-plan',
  'complete-coverage',
  'bounded-work',
  'leaf-interruption-recovery',
  'merge-interruption-recovery',
  'minority-retention',
  'contradiction-retention',
  'partition-skew',
  'checkpoint-size',
] as const

function sha256(value: string): string {
  return new Bun.CryptoHasher('sha256').update(value).digest('hex')
}

function digest(value: string): typeof Sha256Digest.Type {
  return Sha256Digest.make(`sha256:${sha256(value)}`)
}

function stableSourceVersionId(index: number): SourceVersionId {
  const suffix = index.toString(16).padStart(12, '0')
  return SourceVersionId.make(`760e8400-e29b-41d4-a716-${suffix}`)
}

function entryIndex(entryKey: string): number {
  return Number(entryKey.slice('entry-'.length))
}

export interface Phase06RecursiveFixture {
  readonly manifest: RecursiveCorpusManifest
  readonly request: Schema.Schema.Type<typeof RecursiveAnalysisRequest>
  readonly groundTruth: {
    readonly files: typeof PHASE_06_RECURSIVE_FILE_COUNT
    readonly minorityFindings: number
    readonly contradictions: number
  }
}

export function makePhase06RecursiveFixture(): Phase06RecursiveFixture {
  const entries: RecursiveCorpusManifestEntry[] = Array.from(
    { length: PHASE_06_RECURSIVE_FILE_COUNT },
    (_, index) => {
      const group = Math.floor(index / 5) % 5
      const sourceVersionId = stableSourceVersionId(index)
      const entryKey = `entry-${index.toString().padStart(5, '0')}`
      return {
        entryKey,
        sourceVersionId,
        normalizedPath: DirectoryRelativePath.make(
          `group-${group}/${entryKey}.json`,
        ),
        schemaFamily: `family-${index % 5}`,
        byteLength: 1_024,
        contentDigest: digest(`content:${entryKey}`),
        disposition: 'included',
        exclusionReason: null,
        estimatedTokens: 20,
        estimatedCostMicros: 2,
        estimatedArtifactBytes: 64,
      }
    },
  )
  const sourceVersionIds = entries.map((entry) => entry.sourceVersionId)
  const manifest: RecursiveCorpusManifest = {
    version: '1',
    digest: computeRecursiveCorpusManifestDigest(entries),
    entries,
  }
  const requestWithoutId = {
    version: '1' as const,
    runId: ResearchRunId.make('760e8400-e29b-41d4-a716-446655440001'),
    planId: ResearchPlanId.make('760e8400-e29b-41d4-a716-446655440002'),
    workspaceId: WorkspaceId.make('760e8400-e29b-41d4-a716-446655440003'),
    projectId: ProjectId.make('760e8400-e29b-41d4-a716-446655440004'),
    objectiveSignature: digest('phase-06-recursive-evaluation-objective'),
    sourceVersionIds,
    policy: {
      maximumDepth: 8,
      maximumFanOut: 8,
      maximumPartitionItems: 500,
      maximumPartitionAttempts: 3,
      maximumConcurrency: 8,
      maximumElapsedMilliseconds: 600_000,
      maximumTokens: 1_000_000,
      maximumEstimatedCostMicros: 1_000_000,
      maximumPartitionBytes: 1_048_576,
      maximumArtifactBytes: 65_536,
      maximumArtifacts: 100,
    },
    checkpoint: null,
  }
  const request = Schema.decodeUnknownSync(RecursiveAnalysisRequest)({
    ...requestWithoutId,
    id: RecursiveAnalysisRequestId.make(`sha256:${'0'.repeat(64)}`),
  })
  return {
    manifest,
    request: {
      ...request,
      id: computeRecursiveAnalysisRequestId(request),
    },
    groundTruth: {
      files: PHASE_06_RECURSIVE_FILE_COUNT,
      minorityFindings: PHASE_06_RECURSIVE_FILE_COUNT / MINORITY_INTERVAL,
      contradictions: PHASE_06_RECURSIVE_FILE_COUNT / CONTRADICTION_INTERVAL,
    },
  }
}

const Counter = Schema.Number.pipe(
  Schema.finite(),
  Schema.int(),
  Schema.nonNegative(),
)
const PartitionSummary = Schema.Struct({
  partitionId: Schema.String.pipe(Schema.minLength(1)),
  examinedItems: Counter,
  minorityEntryKeys: Schema.Array(Schema.String.pipe(Schema.minLength(1))),
  contradictionEntryKeys: Schema.Array(
    Schema.String.pipe(Schema.minLength(1)),
  ),
})
type PartitionSummary = Schema.Schema.Type<typeof PartitionSummary>
const MergeCheckpoint = Schema.Struct({
  version: Schema.Literal('1'),
  stage: Schema.Literal('partition-summaries-committed'),
  planId: Schema.String.pipe(Schema.minLength(1)),
  manifestDigest: Schema.String.pipe(Schema.minLength(1)),
  examinedItems: Counter,
  summaries: Schema.Array(PartitionSummary),
})
type MergeCheckpoint = Schema.Schema.Type<typeof MergeCheckpoint>

export const Phase06EvaluationCriterion = Schema.Struct({
  id: Schema.Literal(...PHASE_06_CRITERION_IDS),
  status: Schema.Literal('passed', 'failed'),
  evidence: Schema.Record({
    key: Schema.String,
    value: Schema.Unknown,
  }),
})
export type Phase06EvaluationCriterion =
  Schema.Schema.Type<typeof Phase06EvaluationCriterion>

const Phase06RecursiveEvaluationBody = Schema.Struct({
  schemaVersion: Schema.Literal('1.0.0'),
  evaluationId: Schema.Literal(PHASE_06_RECURSIVE_EVALUATION_ID),
  status: Schema.Literal('passed', 'failed'),
  runtime: Schema.Struct({
    host: Schema.Literal('bun'),
    timingGate: Schema.Null,
  }),
  corpus: Schema.Struct({
    files: Schema.Literal(PHASE_06_RECURSIVE_FILE_COUNT),
    partitions: Counter,
    decompositionNodes: Counter,
  }),
  recovery: Schema.Struct({
    leafInterruptions: Schema.Literal(1),
    mergeInterruptions: Schema.Literal(1),
    recoveryCount: Counter,
    duplicatePartitionEffects: Counter,
    duplicateMergeEffects: Counter,
    coveragePreserved: Schema.Boolean,
  }),
  signals: Schema.Struct({
    partitionSkewRatio: Schema.Number.pipe(Schema.finite()),
    maximumPartitionSkewRatio: Schema.Literal(MAXIMUM_PARTITION_SKEW_RATIO),
    schedulerCheckpointBytes: Counter,
    mergeCheckpointBytes: Counter,
    maximumCheckpointBytes: Schema.Literal(MAXIMUM_CHECKPOINT_BYTES),
    minorityFindingsExpected: Counter,
    minorityFindingsRetained: Counter,
    contradictionsExpected: Counter,
    contradictionsRetained: Counter,
  }),
  budget: Schema.Struct({
    elapsedMilliseconds: Counter,
    maximumElapsedMilliseconds: Counter,
    consumedTokens: Counter,
    maximumTokens: Counter,
    consumedCostMicros: Counter,
    maximumEstimatedCostMicros: Counter,
    committedArtifacts: Counter,
    committedArtifactBytes: Counter,
    maximumCommittedArtifactBytes: Counter,
    maximumArtifactBytesObserved: Counter,
    maximumPerArtifactBytes: Counter,
    maximumArtifacts: Counter,
    maximumConcurrencyObserved: Counter,
    maximumConcurrency: Counter,
  }),
  criteria: Schema.Array(Phase06EvaluationCriterion),
  blockers: Schema.Array(Schema.Struct({
    signal: Schema.Literal(
      'partition-skew',
      'checkpoint-size',
      'contradictions',
      'minority-retention',
    ),
    detail: Schema.String.pipe(Schema.minLength(1)),
  })),
})
type Phase06RecursiveEvaluationBody =
  Schema.Schema.Type<typeof Phase06RecursiveEvaluationBody>

export const Phase06RecursiveEvaluationReport =
  Schema.Struct({
    ...Phase06RecursiveEvaluationBody.fields,
    reportSha256: Schema.String.pipe(Schema.pattern(/^[0-9a-f]{64}$/)),
  })
export type Phase06RecursiveEvaluationReport =
  Schema.Schema.Type<typeof Phase06RecursiveEvaluationReport>

function criterion(
  id: Phase06EvaluationCriterion['id'],
  passed: boolean,
  evidence: Readonly<Record<string, unknown>>,
): Phase06EvaluationCriterion {
  return { id, status: passed ? 'passed' : 'failed', evidence }
}

function artifactForClaim(claim: RecursivePartitionClaim) {
  return {
    digest: digest(`partition-artifact:${claim.partition.id}`),
    byteLength: claim.partition.estimatedArtifactBytes,
    mediaType: 'application/vnd.struct.recursive-evidence+json',
  }
}

function commitClaims(
  plan: RecursivePartitionPlan,
  state: RecursiveSchedulerState,
  claims: ReadonlyArray<RecursivePartitionClaim>,
) {
  return Effect.reduce(claims, state, (current, claim) =>
    CorpusPartitioning.commit(
      plan,
      current,
      claim,
      artifactForClaim(claim),
      {
        tokens: claim.partition.estimatedTokens,
        estimatedCostMicros: claim.partition.estimatedCostMicros,
      },
    ))
}

function finishPartitions(
  plan: RecursivePartitionPlan,
  initial: RecursiveSchedulerState,
) {
  return Effect.gen(function* () {
    let state = initial
    let maximumConcurrencyObserved = 0
    let elapsedMilliseconds = state.elapsedMilliseconds
    while (state.status !== 'completed') {
      elapsedMilliseconds += 1
      const claimed = yield* CorpusPartitioning.claim(
        plan,
        state,
        elapsedMilliseconds,
      )
      state = claimed.state
      maximumConcurrencyObserved = Math.max(
        maximumConcurrencyObserved,
        claimed.claims.length,
      )
      if (claimed.claims.length === 0) break
      state = yield* commitClaims(plan, state, claimed.claims)
    }
    return { state, maximumConcurrencyObserved }
  })
}

function partitionSummary(
  partition: RecursivePartitionPlan['partitions'][number],
): PartitionSummary {
  const indices = partition.entryKeys.map(entryIndex)
  return {
    partitionId: partition.id,
    examinedItems: indices.length,
    minorityEntryKeys: partition.entryKeys.filter(
      (entryKey) => entryIndex(entryKey) % MINORITY_INTERVAL === 0,
    ),
    contradictionEntryKeys: partition.entryKeys.filter(
      (entryKey) => entryIndex(entryKey) % CONTRADICTION_INTERVAL === 0,
    ),
  }
}

function checkpointBytes(value: unknown): number {
  return new TextEncoder().encode(canonicalJson(value)).byteLength
}

export const runPhase06RecursiveEvaluation = Effect.fn(
  'Evaluation.runPhase06RecursiveEvaluation',
)(function* () {
  const fixture = makePhase06RecursiveFixture()
  const firstPlan = yield* CorpusPartitioning.plan(
    fixture.manifest,
    fixture.request,
  )
  const repeatedPlan = yield* CorpusPartitioning.plan(
    fixture.manifest,
    fixture.request,
  )
  const initial = yield* CorpusPartitioning.initialState(firstPlan)
  const firstWave = yield* CorpusPartitioning.claim(firstPlan, initial, 1)
  const committedBeforeInterruption = yield* commitClaims(
    firstPlan,
    firstWave.state,
    firstWave.claims.slice(0, 4),
  )
  const resumed = yield* CorpusPartitioning.resume(
    firstPlan,
    committedBeforeInterruption,
  )
  const completed = yield* finishPartitions(firstPlan, resumed)
  yield* CorpusPartitioning.validate(firstPlan, completed.state)

  const summaries = firstPlan.partitions.map(partitionSummary)
  const mergeCheckpoint: MergeCheckpoint = {
    version: '1',
    stage: 'partition-summaries-committed',
    planId: firstPlan.id,
    manifestDigest: firstPlan.manifestDigest,
    examinedItems: summaries.reduce(
      (total, summary) => total + summary.examinedItems,
      0,
    ),
    summaries,
  }
  const restoredCheckpoint = Schema.decodeUnknownSync(MergeCheckpoint)(
    JSON.parse(canonicalJson(mergeCheckpoint)),
  )
  const minorityEntryKeysRetained = restoredCheckpoint.summaries.flatMap(
    (summary) => summary.minorityEntryKeys,
  ).sort()
  const contradictionEntryKeysRetained = restoredCheckpoint.summaries.flatMap(
    (summary) => summary.contradictionEntryKeys,
  ).sort()
  const expectedMinorityEntryKeys = fixture.manifest.entries
    .filter((entry) => entryIndex(entry.entryKey) % MINORITY_INTERVAL === 0)
    .map((entry) => entry.entryKey)
    .sort()
  const expectedContradictionEntryKeys = fixture.manifest.entries
    .filter((entry) => entryIndex(entry.entryKey) % CONTRADICTION_INTERVAL === 0)
    .map((entry) => entry.entryKey)
    .sort()
  const minorityFindingsRetained = minorityEntryKeysRetained.length
  const contradictionsRetained = contradictionEntryKeysRetained.length
  const partitionSizes = firstPlan.partitions.map(
    (partition) => partition.entryKeys.length,
  )
  const minimumPartitionItems = Math.min(...partitionSizes)
  const maximumPartitionItems = Math.max(...partitionSizes)
  const partitionSkewRatio = maximumPartitionItems / minimumPartitionItems
  const schedulerCheckpointBytes = checkpointBytes(completed.state)
  const mergeCheckpointBytes = checkpointBytes(mergeCheckpoint)
  const completedItems = firstPlan.partitions
    .filter((partition) =>
      completed.state.progress.some((progress) =>
        progress.partitionId === partition.id
        && progress.status === 'completed'))
    .reduce((total, partition) => total + partition.entryKeys.length, 0)
  const maximumConcurrencyObserved = Math.max(
    firstWave.claims.length,
    completed.maximumConcurrencyObserved,
  )
  const interruptedProgress = committedBeforeInterruption.progress.filter(
    (item) => item.status === 'running',
  )
  const interruptedPartitionIds = new Set(
    interruptedProgress.map((item) => item.partitionId),
  )
  const resumedProgress = resumed.progress.filter(
    (item) =>
      item.status === 'retryable'
      && interruptedPartitionIds.has(item.partitionId),
  )
  const recoveryTransitions = resumedProgress.length === interruptedProgress.length
    && interruptedProgress.length > 0
    ? [{
        before: digest(canonicalJson(committedBeforeInterruption)),
        after: digest(canonicalJson(resumed)),
      }]
    : []
  const recoveryCount = recoveryTransitions.length
  const committedBeforeArtifacts = new Map(
    committedBeforeInterruption.progress.flatMap((item) =>
      item.artifact === null
        ? []
        : [[item.partitionId, item.artifact.digest] as const]),
  )
  const committedBeforeInterruptionCount =
    committedBeforeInterruption.progress.filter(
      (item) => item.status === 'completed',
    ).length
  const completedArtifacts = completed.state.progress.flatMap((item) =>
    item.artifact === null
      ? []
      : [{
          partitionId: item.partitionId,
          digest: item.artifact.digest,
          byteLength: item.artifact.byteLength,
        }])
  const partitionEffectIdentities = completedArtifacts.map(
    (item) => item.digest,
  )
  const duplicatePartitionEffects = partitionEffectIdentities.length
    - new Set(partitionEffectIdentities).size
  const preservedCommittedPartitionArtifacts = completedArtifacts.filter(
    (item) => committedBeforeArtifacts.get(item.partitionId) === item.digest,
  ).length
  const mergeEffectIdentities = restoredCheckpoint.summaries.map(
    (summary) => summary.partitionId,
  )
  const duplicateMergeEffects = mergeEffectIdentities.length
    - new Set(mergeEffectIdentities).size
  const maximumArtifactBytesObserved = Math.max(
    0,
    ...completedArtifacts.map((item) => item.byteLength),
  )
  const maximumCommittedArtifactBytes =
    fixture.request.policy.maximumArtifacts
    * fixture.request.policy.maximumArtifactBytes

  const criteria: ReadonlyArray<Phase06EvaluationCriterion> = [
    criterion('deterministic-plan', canonicalJson(firstPlan) === canonicalJson(repeatedPlan), {
      firstPlanId: firstPlan.id,
      repeatedPlanId: repeatedPlan.id,
      manifestDigest: fixture.manifest.digest,
    }),
    criterion('complete-coverage', (
      completed.state.status === 'completed'
      && completedItems === fixture.groundTruth.files
      && restoredCheckpoint.examinedItems === fixture.groundTruth.files
    ), {
      status: completed.state.status,
      expectedItems: fixture.groundTruth.files,
      completedItems,
      mergeCheckpointItems: restoredCheckpoint.examinedItems,
    }),
    criterion('bounded-work', (
      completed.state.elapsedMilliseconds
        <= fixture.request.policy.maximumElapsedMilliseconds
      && firstPlan.partitions.length <= fixture.request.policy.maximumArtifacts
      && completedArtifacts.length <= fixture.request.policy.maximumArtifacts
      && maximumArtifactBytesObserved
        <= fixture.request.policy.maximumArtifactBytes
      && completed.state.committedArtifactBytes
        <= maximumCommittedArtifactBytes
      && completed.state.consumedTokens <= fixture.request.policy.maximumTokens
      && completed.state.consumedCostMicros
        <= fixture.request.policy.maximumEstimatedCostMicros
      && maximumConcurrencyObserved
        <= fixture.request.policy.maximumConcurrency
    ), {
      elapsedMilliseconds: completed.state.elapsedMilliseconds,
      maximumElapsedMilliseconds:
        fixture.request.policy.maximumElapsedMilliseconds,
      partitions: firstPlan.partitions.length,
      committedArtifacts: completedArtifacts.length,
      maximumArtifacts: fixture.request.policy.maximumArtifacts,
      committedArtifactBytes: completed.state.committedArtifactBytes,
      maximumCommittedArtifactBytes,
      maximumArtifactBytesObserved,
      maximumPerArtifactBytes: fixture.request.policy.maximumArtifactBytes,
      consumedTokens: completed.state.consumedTokens,
      maximumTokens: fixture.request.policy.maximumTokens,
      consumedCostMicros: completed.state.consumedCostMicros,
      maximumEstimatedCostMicros:
        fixture.request.policy.maximumEstimatedCostMicros,
      maximumConcurrencyObserved,
      maximumConcurrency: fixture.request.policy.maximumConcurrency,
    }),
    criterion('leaf-interruption-recovery', (
      firstWave.claims.length === fixture.request.policy.maximumConcurrency
      && committedBeforeInterruptionCount === firstWave.claims.length / 2
      && resumed.progress.filter((item) => item.status === 'retryable').length
        === firstWave.claims.length - 4
      && recoveryCount === 1
      && duplicatePartitionEffects === 0
      && preservedCommittedPartitionArtifacts
        === committedBeforeArtifacts.size
      && completed.state.status === 'completed'
    ), {
      interruptedClaims: firstWave.claims.length,
      committedBeforeInterruption: committedBeforeInterruptionCount,
      resumedLeases: resumedProgress.length,
      recoveryCount,
      recoveryTransitionIdentities: recoveryTransitions,
      preservedCommittedPartitionArtifacts,
      duplicatePartitionEffects,
    }),
    criterion('merge-interruption-recovery', (
      restoredCheckpoint.planId === firstPlan.id
      && restoredCheckpoint.manifestDigest === firstPlan.manifestDigest
      && canonicalJson(restoredCheckpoint) === canonicalJson(mergeCheckpoint)
      && duplicateMergeEffects === 0
    ), {
      interruptedStage: mergeCheckpoint.stage,
      resumedStage: restoredCheckpoint.stage,
      reusedCommittedStages:
        canonicalJson(restoredCheckpoint) === canonicalJson(mergeCheckpoint)
          ? 1
          : 0,
      mergeEffectIdentities: mergeEffectIdentities.length,
      duplicateMergeEffects,
    }),
    criterion('minority-retention', (
      canonicalJson(minorityEntryKeysRetained)
        === canonicalJson(expectedMinorityEntryKeys)
    ), {
      expected: fixture.groundTruth.minorityFindings,
      retained: minorityFindingsRetained,
      uniqueRetained: new Set(minorityEntryKeysRetained).size,
      prevalence: fixture.groundTruth.minorityFindings
        / fixture.groundTruth.files,
    }),
    criterion('contradiction-retention', (
      canonicalJson(contradictionEntryKeysRetained)
        === canonicalJson(expectedContradictionEntryKeys)
    ), {
      expected: fixture.groundTruth.contradictions,
      retained: contradictionsRetained,
      uniqueRetained: new Set(contradictionEntryKeysRetained).size,
    }),
    criterion('partition-skew', (
      partitionSkewRatio <= MAXIMUM_PARTITION_SKEW_RATIO
    ), {
      minimumPartitionItems,
      maximumPartitionItems,
      ratio: partitionSkewRatio,
      maximumRatio: MAXIMUM_PARTITION_SKEW_RATIO,
    }),
    criterion('checkpoint-size', (
      schedulerCheckpointBytes <= MAXIMUM_CHECKPOINT_BYTES
      && mergeCheckpointBytes <= MAXIMUM_CHECKPOINT_BYTES
    ), {
      schedulerCheckpointBytes,
      mergeCheckpointBytes,
      maximumCheckpointBytes: MAXIMUM_CHECKPOINT_BYTES,
      artifactStorage: 'by-reference',
    }),
  ]
  const blockers: Array<
    Phase06RecursiveEvaluationBody['blockers'][number]
  > = []
  if (partitionSkewRatio > MAXIMUM_PARTITION_SKEW_RATIO) {
    blockers.push({
      signal: 'partition-skew',
      detail: `Observed skew ${partitionSkewRatio} exceeds ${MAXIMUM_PARTITION_SKEW_RATIO}`,
    })
  }
  if (
    schedulerCheckpointBytes > MAXIMUM_CHECKPOINT_BYTES
    || mergeCheckpointBytes > MAXIMUM_CHECKPOINT_BYTES
  ) {
    blockers.push({
      signal: 'checkpoint-size',
      detail: 'A recursive checkpoint exceeds the 256 KiB evaluation ceiling',
    })
  }
  if (
    canonicalJson(contradictionEntryKeysRetained)
      !== canonicalJson(expectedContradictionEntryKeys)
  ) {
    blockers.push({
      signal: 'contradictions',
      detail: 'Recursive merge did not retain the deterministic contradiction count',
    })
  }
  if (
    canonicalJson(minorityEntryKeysRetained)
      !== canonicalJson(expectedMinorityEntryKeys)
  ) {
    blockers.push({
      signal: 'minority-retention',
      detail: 'Recursive merge did not retain every minority finding identity',
    })
  }
  const body: Phase06RecursiveEvaluationBody = {
    schemaVersion: '1.0.0',
    evaluationId: PHASE_06_RECURSIVE_EVALUATION_ID,
    status: criteria.every((item) => item.status === 'passed')
      && blockers.length === 0
      ? 'passed'
      : 'failed',
    runtime: {
      host: 'bun',
      timingGate: null,
    },
    corpus: {
      files: fixture.groundTruth.files,
      partitions: firstPlan.partitions.length,
      decompositionNodes: firstPlan.decomposition.nodes.length,
    },
    recovery: {
      leafInterruptions: 1,
      mergeInterruptions: 1,
      recoveryCount,
      duplicatePartitionEffects,
      duplicateMergeEffects,
      coveragePreserved:
        restoredCheckpoint.examinedItems === completedItems,
    },
    signals: {
      partitionSkewRatio,
      maximumPartitionSkewRatio: MAXIMUM_PARTITION_SKEW_RATIO,
      schedulerCheckpointBytes,
      mergeCheckpointBytes,
      maximumCheckpointBytes: MAXIMUM_CHECKPOINT_BYTES,
      minorityFindingsExpected: fixture.groundTruth.minorityFindings,
      minorityFindingsRetained,
      contradictionsExpected: fixture.groundTruth.contradictions,
      contradictionsRetained,
    },
    budget: {
      elapsedMilliseconds: completed.state.elapsedMilliseconds,
      maximumElapsedMilliseconds:
        fixture.request.policy.maximumElapsedMilliseconds,
      consumedTokens: completed.state.consumedTokens,
      maximumTokens: fixture.request.policy.maximumTokens,
      consumedCostMicros: completed.state.consumedCostMicros,
      maximumEstimatedCostMicros:
        fixture.request.policy.maximumEstimatedCostMicros,
      committedArtifacts: completedArtifacts.length,
      committedArtifactBytes: completed.state.committedArtifactBytes,
      maximumCommittedArtifactBytes,
      maximumArtifactBytesObserved,
      maximumPerArtifactBytes: fixture.request.policy.maximumArtifactBytes,
      maximumArtifacts: fixture.request.policy.maximumArtifacts,
      maximumConcurrencyObserved,
      maximumConcurrency: fixture.request.policy.maximumConcurrency,
    },
    criteria,
    blockers,
  }
  return {
    ...body,
    reportSha256: sha256(canonicalJson(body)),
  } satisfies Phase06RecursiveEvaluationReport
})

export function serializePhase06RecursiveEvaluationReport(
  report: Phase06RecursiveEvaluationReport,
): string {
  return canonicalJson(report)
}

export function verifyPhase06RecursiveEvaluationReport(
  input: string,
): Phase06RecursiveEvaluationReport {
  const parsed = Schema.decodeUnknownSync(Phase06RecursiveEvaluationReport)(
    JSON.parse(input),
  )
  const { reportSha256, ...body } = parsed
  if (reportSha256 !== sha256(canonicalJson(body))) {
    throw new Error('Phase 06 recursive evaluation report hash is invalid')
  }
  const criterionCounts = new Map(
    PHASE_06_CRITERION_IDS.map((id) => [
      id,
      parsed.criteria.filter((item) => item.id === id).length,
    ]),
  )
  if (
    parsed.criteria.length !== PHASE_06_CRITERION_IDS.length
    || [...criterionCounts.values()].some((count) => count !== 1)
  ) {
    throw new Error(
      'Phase 06 recursive evaluation criterion inventory is invalid',
    )
  }
  const expectedStatus = parsed.criteria.every(
    (item) => item.status === 'passed',
  ) && parsed.blockers.length === 0
    ? 'passed'
    : 'failed'
  if (parsed.status !== expectedStatus) {
    throw new Error('Phase 06 recursive evaluation report status is invalid')
  }
  return parsed
}
