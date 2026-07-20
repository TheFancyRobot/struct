/* eslint-disable no-unused-vars -- Babel's parser does not mark type-only imports as used. */
import { Effect, Option, Runtime, Schema } from 'effect'
import {
  ResearchAnswer as ResearchAnswerSchema,
  ResearchCheckpointId,
  ResearchPlanNode,
  ResearchToolInputValidationError,
  ResearchToolProviderUnavailableError,
  Sha256Digest,
  TextEvidence as TextEvidenceSchema,
  type ProjectId as typeProjectId,
  type ResearchAnswer as typeResearchAnswer,
  type ResearchExecutionCheckpoint,
  type ResearchPlan as typeResearchPlan,
  type ResearchToolFailure,
  type TextEvidence,
  type WorkspaceId as typeWorkspaceId,
} from '@struct/domain'
import {
  initialResearchGraphState,
  ResearchActionResult,
  ResearchProviderFailure,
  validateAnswerCitations,
} from '@struct/research-engine'
import {
  DeterministicDatasetQueryOutput,
  type DeterministicDatasetQueryOutput as DeterministicDatasetQueryOutputType,
} from '@struct/data-engine'
import type {
  ArtifactStoreShape,
  ArtifactRef as typeArtifactRef,
} from '@struct/source-storage'
import {
  makeRegistryResearchToolResolver,
  makeResearchToolRegistry,
  runFredBoundedResearchGraph,
  runFredResearchCritique,
  runFredResearchSynthesis,
  type FredRuntimeConfig,
  type ResearchModelRoutingPolicy as typeResearchModelRoutingPolicy,
  type ResolvedModelRoute as typeResolvedModelRoute,
} from '@struct/workflows'
import type { ResearchWorkerDeps } from './run-research.js'
/* eslint-enable no-unused-vars */

const EvidenceArtifact = Schema.Struct({
  kind: Schema.Literal('research-evidence'),
  evidence: Schema.Array(TextEvidenceSchema).pipe(Schema.maxItems(80)),
})
const AnswerArtifact = Schema.Struct({
  kind: Schema.Literal('research-answer'),
  answer: ResearchAnswerSchema,
})

type Artifact = ResearchExecutionCheckpoint['state']['completed'][number]['artifacts'][number]
const MAX_COMBINED_EVIDENCE = 80

export interface ProductionResearchWorkflowDeps {
  readonly storage: ArtifactStoreShape
  readonly runtime: Runtime.Runtime<never>
  readonly fredConfig: FredRuntimeConfig
  readonly retrieve: (input: {
    readonly workspaceId: typeWorkspaceId
    readonly projectId: typeProjectId
    readonly sourceVersionIds: ReadonlyArray<
      typeof import('@struct/domain').SourceVersionId.Type
    >
    readonly query: string
    readonly limit: number
  }) => Effect.Effect<
    ReadonlyArray<TextEvidence>,
    unknown,
    never
  >
  readonly queryDataset: (input: {
    readonly plan: typeResearchPlan
    readonly node: typeof ResearchPlanNode.Type
  }) => Effect.Effect<
    DeterministicDatasetQueryOutputType,
    ResearchToolFailure,
    never
  >
  readonly loadDurableState: (
    workspaceId: typeWorkspaceId,
    projectId: typeProjectId,
    runId: typeof import('@struct/domain').ResearchRunId.Type,
  ) => ReturnType<ResearchWorkerDeps['jobs']['loadDurableState']>
  readonly runGraph?: typeof runFredBoundedResearchGraph
  readonly runCritique?: typeof runFredResearchCritique
  readonly runSynthesis?: typeof runFredResearchSynthesis
}

function routing(config: FredRuntimeConfig): typeResearchModelRoutingPolicy {
  const route = (
    outputContract:
      | 'question-classification.v1'
      | 'research-plan.v1'
      | 'evidence-assessment.v1'
      | 'research-answer.v1',
  ) => ({
    primary: {
      platform: config.providerPackage,
      model: config.model,
      maxSteps: 1 as const,
      outputContract,
    },
    fallback: null,
  })
  return {
    classification: route('question-classification.v1'),
    planning: route('research-plan.v1'),
    critique: route('evidence-assessment.v1'),
    synthesis: route('research-answer.v1'),
  }
}

export function makeProductionResearchWorkflow(
  dependencies: ProductionResearchWorkflowDeps,
): ResearchWorkerDeps['workflow'] {
  const runGraph = dependencies.runGraph ?? runFredBoundedResearchGraph
  const runCritique = dependencies.runCritique ?? runFredResearchCritique
  const runSynthesis = dependencies.runSynthesis ?? runFredResearchSynthesis
  return {
    run: ({
      run,
      workspaceId,
      projectId,
      sourceVersionIds,
      plan,
      resumeCheckpoint,
      onCheckpoint,
      onRetrievalCompleted,
    }) =>
      Effect.gen(function* () {
        let evidence: ReadonlyArray<TextEvidence> = []
        let datasetResults:
          ReadonlyArray<DeterministicDatasetQueryOutputType> = []
        let answer: typeResearchAnswer | undefined
        const appendEvidence = (items: ReadonlyArray<TextEvidence>): void => {
          const identities = new Set(
            evidence.map((item) =>
              `${item.sourceVersionId}\u0000${item.locator}\u0000${item.excerpt}`
            ),
          )
          const unique = items.filter((item) => {
            const identity =
              `${item.sourceVersionId}\u0000${item.locator}\u0000${item.excerpt}`
            if (identities.has(identity)) return false
            identities.add(identity)
            return true
          })
          evidence = [...evidence, ...unique].slice(0, MAX_COMBINED_EVIDENCE)
        }
        const commitDatasetResult = (
          result: DeterministicDatasetQueryOutputType,
        ): void => {
          if (!datasetResults.some((item) => item.result.id === result.result.id)) {
            datasetResults = [...datasetResults, result]
          }
        }
        const datasetCitationsAreExact = (
          candidate: typeResearchAnswer,
        ): boolean => {
          const expected = datasetResults.flatMap(
            (result) => result.citations,
          )
          const actual = candidate.datasetCitations ?? []
          return expected.length === actual.length
            && expected.every((citation) =>
              actual.some((item) =>
                item.id === citation.id
                && item.queryResultSnapshotId
                  === citation.queryResultSnapshotId
                && item.resultHash === citation.resultHash
                && item.resultArtifactHash === citation.resultArtifactHash))
        }
        let eventSequence = Option.match(resumeCheckpoint, {
          onNone: () => 0,
          onSome: (checkpoint) => checkpoint.state.lastEventSequence,
        })
        const artifactsByNode = new Map<
          typeof ResearchPlanNode.Type['id'],
          Artifact[]
        >()

        const writeArtifact = Effect.fn('ResearchWorkflow.writeArtifact')(
          function* (
            nodeId: typeof ResearchPlanNode.Type['id'],
            value: unknown,
            mediaType: string,
          ) {
            const stored = yield* dependencies.storage.writeObject(
              new TextEncoder().encode(JSON.stringify(value)),
              { mediaType },
            )
            const artifact: Artifact = {
              digest: Sha256Digest.make(stored.hash),
              byteLength: stored.byteLength,
              mediaType,
            }
            const existing = artifactsByNode.get(nodeId) ?? []
            if (!existing.some((item) =>
              item.digest === artifact.digest
              && item.mediaType === artifact.mediaType
            )) {
              artifactsByNode.set(nodeId, [...existing, artifact])
            }
            return artifact
          },
        )

        if (Option.isSome(resumeCheckpoint)) {
          for (const completed of resumeCheckpoint.value.state.completed) {
            artifactsByNode.set(completed.nodeId, [...completed.artifacts])
            for (const artifact of completed.artifacts) {
              const ref: typeArtifactRef =
                `artifact://sha256/${artifact.digest.slice('sha256:'.length)}`
              const stored = yield* dependencies.storage.readObject(ref)
              const decoded: unknown = JSON.parse(
                new TextDecoder().decode(stored.bytes),
              )
              if (
                artifact.mediaType
                === 'application/vnd.struct.research-evidence+json'
              ) {
                appendEvidence(
                  Schema.decodeUnknownSync(EvidenceArtifact)(decoded).evidence,
                )
              } else if (
                artifact.mediaType
                === 'application/vnd.struct.research-answer+json'
              ) {
                answer = Schema.decodeUnknownSync(AnswerArtifact)(decoded).answer
              } else if (
                artifact.mediaType
                === 'application/vnd.struct.research-dataset-result+json'
              ) {
                const value = Schema.decodeUnknownSync(
                  Schema.Struct({
                    kind: Schema.Literal('research-dataset-result'),
                    result: DeterministicDatasetQueryOutput,
                  }),
                )(decoded)
                commitDatasetResult(value.result)
              }
            }
          }
        }

        const active = Effect.fn('ResearchWorkflow.active')(function* () {
          const loaded = yield* dependencies.loadDurableState(
            workspaceId,
            projectId,
            run.id,
          ).pipe(
            Effect.mapError(() =>
              new ResearchProviderFailure({
                message: 'Research cancellation state could not be loaded',
              }),
            ),
          )
          return Option.isSome(loaded)
            && loaded.value.cancellationStatus !== 'none'
        })

        const registry = makeResearchToolRegistry([
          {
            toolId: 'hybrid-retrieval',
            capability: 'document:retrieve',
            input: ResearchPlanNode,
            output: ResearchActionResult,
            timeoutMilliseconds: Math.min(
              30_000,
              plan.budget.maximumElapsedMilliseconds,
            ),
            idempotent: true,
            authorize: (context) => Effect.succeed(
              context.workspaceId === workspaceId
              && context.projectId === projectId
              && context.runId === run.id,
            ),
            execute: (input, context) =>
              Effect.gen(function* () {
                const node = yield* Schema.decodeUnknown(ResearchPlanNode)(input)
                  .pipe(Effect.mapError(() =>
                    new ResearchToolInputValidationError({
                      toolId: 'hybrid-retrieval',
                      capability: 'document:retrieve',
                      nodeId: context.nodeId,
                      runId: context.runId,
                      message: 'Document retrieval node is invalid',
                    })))
                const result = yield* dependencies.retrieve({
                  workspaceId,
                  projectId,
                  sourceVersionIds: node.inputRefs.flatMap((ref) =>
                    ref.kind === 'source-version'
                    && sourceVersionIds.includes(ref.sourceVersionId)
                      ? [ref.sourceVersionId]
                      : []),
                  query: node.goal,
                  limit: 10,
                }).pipe(Effect.mapError(() =>
                  new ResearchToolProviderUnavailableError({
                    toolId: 'hybrid-retrieval',
                    capability: 'document:retrieve',
                    nodeId: node.id,
                    runId: run.id,
                    message: 'Document retrieval provider failed',
                  })))
                const artifact = yield* writeArtifact(
                  node.id,
                  { kind: 'research-evidence', evidence: result },
                  'application/vnd.struct.research-evidence+json',
                ).pipe(Effect.mapError(() =>
                  new ResearchToolProviderUnavailableError({
                    toolId: 'hybrid-retrieval',
                    capability: 'document:retrieve',
                    nodeId: node.id,
                    runId: run.id,
                    message: 'Research evidence artifact could not be stored',
                  })))
                appendEvidence(result)
                yield* onRetrievalCompleted(result).pipe(
                  Effect.asVoid,
                  Effect.mapError(() =>
                    new ResearchToolProviderUnavailableError({
                      toolId: 'hybrid-retrieval',
                      capability: 'document:retrieve',
                      nodeId: node.id,
                      runId: run.id,
                      message: 'Research retrieval event could not be persisted',
                    })),
                )
                return {
                  progressFingerprint: `retrieval:${node.id}`,
                  artifacts: [artifact],
                }
              }),
          },
          {
            toolId: 'directory-navigation',
            capability: 'directory:navigate',
            input: ResearchPlanNode,
            output: ResearchActionResult,
            timeoutMilliseconds: 30_000,
            idempotent: true,
            authorize: (context) => Effect.succeed(
              context.workspaceId === workspaceId
              && context.projectId === projectId
              && context.runId === run.id,
            ),
            execute: (input, context) =>
              Effect.gen(function* () {
                const node = yield* Schema.decodeUnknown(ResearchPlanNode)(input)
                  .pipe(Effect.mapError(() =>
                    new ResearchToolInputValidationError({
                      toolId: 'directory-navigation',
                      capability: 'directory:navigate',
                      nodeId: context.nodeId,
                      runId: context.runId,
                      message: 'Directory navigation node is invalid',
                    })))
                if (node.toolInput?.kind !== 'directory-navigation') {
                  return yield* new ResearchToolInputValidationError({
                    toolId: 'directory-navigation',
                    capability: 'directory:navigate',
                    nodeId: node.id,
                    runId: run.id,
                    message: 'Directory navigation requires a typed query spec',
                  })
                }
                const result = yield* dependencies.retrieve({
                  workspaceId,
                  projectId,
                  sourceVersionIds: node.inputRefs.flatMap((ref) =>
                    ref.kind === 'source-version'
                    && sourceVersionIds.includes(ref.sourceVersionId)
                      ? [ref.sourceVersionId]
                      : []),
                  query: node.toolInput.query,
                  limit: node.toolInput.maximumResults,
                }).pipe(Effect.mapError(() =>
                  new ResearchToolProviderUnavailableError({
                    toolId: 'directory-navigation',
                    capability: 'directory:navigate',
                    nodeId: node.id,
                    runId: run.id,
                    message: 'Directory navigation provider failed',
                  })))
                const artifact = yield* writeArtifact(
                  node.id,
                  { kind: 'research-evidence', evidence: result },
                  'application/vnd.struct.research-evidence+json',
                ).pipe(Effect.mapError(() =>
                  new ResearchToolProviderUnavailableError({
                    toolId: 'directory-navigation',
                    capability: 'directory:navigate',
                    nodeId: node.id,
                    runId: run.id,
                    message: 'Directory evidence artifact could not be stored',
                  })))
                appendEvidence(result)
                return {
                  progressFingerprint: `directory:${node.id}`,
                  artifacts: [artifact],
                }
              }),
          },
          {
            toolId: 'dataset-query',
            capability: 'dataset:query',
            input: ResearchPlanNode,
            output: ResearchActionResult,
            timeoutMilliseconds: 30_000,
            idempotent: true,
            authorize: (context) => Effect.succeed(
              context.workspaceId === workspaceId
              && context.projectId === projectId
              && context.runId === run.id,
            ),
            execute: (input, context) =>
              Effect.gen(function* () {
                const node = yield* Schema.decodeUnknown(ResearchPlanNode)(input)
                  .pipe(Effect.mapError(() =>
                    new ResearchToolInputValidationError({
                      toolId: 'dataset-query',
                      capability: 'dataset:query',
                      nodeId: context.nodeId,
                      runId: context.runId,
                      message: 'Dataset query node is invalid',
                    })))
                const result = yield* dependencies.queryDataset({ plan, node })
                const encodedResult = yield* Schema.encode(
                  DeterministicDatasetQueryOutput,
                )(result).pipe(Effect.mapError(() =>
                  new ResearchToolInputValidationError({
                    toolId: 'dataset-query',
                    capability: 'dataset:query',
                    nodeId: node.id,
                    runId: run.id,
                    message: 'Dataset query output could not be encoded',
                  })))
                const artifact = yield* writeArtifact(
                  node.id,
                  { kind: 'research-dataset-result', result: encodedResult },
                  'application/vnd.struct.research-dataset-result+json',
                ).pipe(Effect.mapError(() =>
                  new ResearchToolProviderUnavailableError({
                    toolId: 'dataset-query',
                    capability: 'dataset:query',
                    nodeId: node.id,
                    runId: run.id,
                    message: 'Dataset result artifact could not be stored',
                  })))
                commitDatasetResult(result)
                return {
                  progressFingerprint: `dataset:${node.id}`,
                  artifacts: [artifact],
                }
              }),
          },
          {
            toolId: 'citation-validation',
            capability: 'citation:validate',
            input: ResearchPlanNode,
            output: ResearchActionResult,
            timeoutMilliseconds: 5_000,
            idempotent: true,
            authorize: (context) => Effect.succeed(
              context.workspaceId === workspaceId
              && context.projectId === projectId
              && context.runId === run.id,
            ),
            execute: (_input, context) =>
              answer === undefined
                ? Effect.fail(new ResearchToolInputValidationError({
                    toolId: 'citation-validation',
                    capability: 'citation:validate',
                    nodeId: context.nodeId,
                    runId: context.runId,
                    message: 'Citation validation requires an answer',
                  }))
                : (
                    !datasetCitationsAreExact(answer)
                      ? Effect.fail(new Error(
                          'Dataset citations are incomplete',
                        ))
                      : evidence.length === 0
                        ? Effect.succeed(answer)
                        : validateAnswerCitations(
                            answer,
                            evidence,
                            run.question,
                          )
                  ).pipe(
                    Effect.as({
                      progressFingerprint: `citations:${context.nodeId}`,
                      artifacts: [],
                    }),
                    Effect.mapError(() =>
                      new ResearchToolInputValidationError({
                        toolId: 'citation-validation',
                        capability: 'citation:validate',
                        nodeId: context.nodeId,
                        runId: context.runId,
                        message: 'Research citations are invalid',
                      })),
                  ),
          },
        ], { trace: (entry) => Effect.log('Research tool dispatch', entry) })

        const tools = makeRegistryResearchToolResolver(
          registry,
          {
            maximumAttempts: 3,
            initialBackoffMilliseconds: 100,
            maximumBackoffMilliseconds: 1_000,
          },
          {
            workspaceId,
            projectId,
            runId: run.id,
            signal: new AbortController().signal,
            idempotencyKey: (nodeId) => `${run.id}:${nodeId}`,
            sleep: (milliseconds) => Effect.sleep(`${milliseconds} millis`),
            onRetryAttempt: (attempt) =>
              Effect.log('Research tool retry', attempt),
          },
        )
        const models = {
          resolve: (route: typeResolvedModelRoute) => Effect.succeed({
            execute: (node: typeof ResearchPlanNode.Type) =>
              (route.role === 'critique'
                ? runCritique({
                    question: run.question,
                    node,
                    evidence: [...evidence],
                    datasetResults: [...datasetResults],
                  }, route.primary.model, dependencies.fredConfig).pipe(
                    Effect.flatMap((assessment) =>
                      writeArtifact(
                        node.id,
                        { kind: 'research-critique', assessment },
                        'application/vnd.struct.research-critique+json',
                      )),
                    Effect.map((artifact) => ({
                      progressFingerprint: `critique:${node.id}`,
                      artifacts: [artifact],
                    })),
                    Effect.mapError(() =>
                      new ResearchProviderFailure({
                        message: 'Research critique failed',
                      })),
                  )
                : runSynthesis({
                    question: run.question,
                    node,
                    evidence: [...evidence],
                    datasetResults: [...datasetResults],
                  }, route.primary.model, dependencies.fredConfig).pipe(
                    Effect.tap((value) => Effect.sync(() => {
                      answer = value
                    })),
                    Effect.flatMap((value) =>
                      Schema.encode(ResearchAnswerSchema)(value).pipe(
                        Effect.flatMap((encodedAnswer) =>
                          writeArtifact(
                            node.id,
                            {
                              kind: 'research-answer',
                              answer: encodedAnswer,
                            },
                            'application/vnd.struct.research-answer+json',
                          )),
                      )),
                    Effect.map((artifact) => ({
                      progressFingerprint: `synthesis:${node.id}`,
                      artifacts: [artifact],
                    })),
                    Effect.mapError(() =>
                      new ResearchProviderFailure({
                        message: 'Research synthesis failed',
                      })),
                  )).pipe(
                Effect.timeoutFail({
                  duration: Math.min(
                    dependencies.fredConfig.maxElapsedMs,
                    plan.budget.maximumElapsedMilliseconds,
                  ),
                  onTimeout: () =>
                    new ResearchProviderFailure({
                      message: 'Research model exceeded elapsed-time budget',
                    }),
                }),
              ),
          }),
        }
        const initial = Option.match(resumeCheckpoint, {
          onNone: () => initialResearchGraphState({
            runId: run.id,
            planId: plan.id,
            workspaceId,
            projectId,
          }, Date.now()),
          onSome: (checkpoint) => ({
            ...initialResearchGraphState({
              runId: run.id,
              planId: plan.id,
              workspaceId,
              projectId,
            }, Date.now() - checkpoint.state.budget.used.elapsedMilliseconds),
            status: 'running' as const,
            steps: checkpoint.state.budget.used.steps,
            modelCalls: checkpoint.state.budget.used.modelCalls,
            toolCalls: checkpoint.state.budget.used.toolCalls,
            estimatedCostMicros:
              checkpoint.state.budget.used.estimatedCostMicros,
            completedNodeIds: checkpoint.state.completed.map(
              (completed) => completed.nodeId,
            ),
            artifacts: checkpoint.state.completed.flatMap(
              (completed) => completed.artifacts,
            ),
          }),
        })
        const finalized = Option.isSome(resumeCheckpoint)
          && resumeCheckpoint.value.state.status === 'paused'
          && resumeCheckpoint.value.state.completed.length === plan.nodes.length
        if (!finalized) {
          yield* Effect.tryPromise({
            try: (signal) => Runtime.runPromise(dependencies.runtime)(
              runGraph(
                plan,
                initial,
                routing(dependencies.fredConfig),
                {
                  maximumDuplicateActions: 1,
                  maximumNoProgressActions: 2,
                },
                {
                  tools,
                  models,
                  now: () => Date.now(),
                  estimatedCostMicros: () => 1,
                  isCancellationRequested: active,
                  onStateCommitted: (state) =>
                    Effect.gen(function* () {
                      if (yield* active()) {
                        return yield* new ResearchProviderFailure({
                          message: 'Research execution was cancelled',
                        })
                      }
                      eventSequence += 1
                      const current = plan.nodes.find(
                        (node) => !state.completedNodeIds.includes(node.id),
                      )
                      yield* onCheckpoint({
                        version: '1',
                        id: ResearchCheckpointId.make(crypto.randomUUID()),
                        state: {
                          version: '1',
                          runId: run.id,
                          planId: plan.id,
                          status: state.status === 'completed'
                            ? 'paused'
                            : 'running',
                          currentNodeId: current?.id ?? null,
                          completed: state.completedNodeIds.map((nodeId) => ({
                            nodeId,
                            artifacts: artifactsByNode.get(nodeId) ?? [],
                          })),
                          budget: {
                            limits: plan.budget,
                            used: {
                              steps: state.steps,
                              modelCalls: state.modelCalls,
                              toolCalls: state.toolCalls,
                              tokens: 0,
                              elapsedMilliseconds: state.elapsedMilliseconds,
                              estimatedCostMicros: state.estimatedCostMicros,
                              revisions: 0,
                            },
                          },
                          cancellation: 'none',
                          duplicateActionCount: state.duplicateActionCount,
                          noProgressCount: state.noProgressCount,
                          fredCorrelation: run.id,
                          lastEventSequence: eventSequence,
                        },
                      }).pipe(Effect.mapError(() =>
                        new ResearchProviderFailure({
                          message: 'Research checkpoint persistence failed',
                        })))
                    }),
                },
                dependencies.fredConfig,
                signal,
              ),
              { signal },
            ),
            catch: () =>
              new ResearchProviderFailure({
                message: 'Bounded research graph failed',
              }),
          })
        }
        if (answer === undefined) {
          return yield* new ResearchProviderFailure({
            message: 'Bounded research graph produced no answer',
          })
        }
        if (!datasetCitationsAreExact(answer)) {
          return yield* new ResearchProviderFailure({
            message: 'Research answer dataset citations are invalid',
          })
        }
        const validated = evidence.length === 0
          ? answer
          : yield* validateAnswerCitations(answer, evidence, run.question)
        return {
          plan: {
            query: run.question,
            maxSteps: 5 as const,
            maxToolCalls: 1 as const,
            maxModelCalls: 1 as const,
          },
          evidence,
          answer: validated,
        }
      }),
  }
}
