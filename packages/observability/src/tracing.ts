import { Config, Effect, Layer, Logger, Metric, Option } from 'effect'
import * as NodeSdk from '@effect/opentelemetry/NodeSdk'
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http'
import {
  BatchSpanProcessor,
  ConsoleSpanExporter,
  SimpleSpanProcessor,
} from '@opentelemetry/sdk-trace-base'

export type WalkingSliceStage =
  | 'api-request'
  | 'command'
  | 'worker-job'
  | 'fred-run'
  | 'fred-step'
  | 'model-call'
  | 'retrieval'
  | 'citation-validation'

export type WalkingSliceMetric =
  | 'runs.started'
  | 'runs.completed'
  | 'runs.failed'
  | 'citations.validated'

export interface TraceIdentity {
  readonly workspaceId: string
  readonly projectId?: string
  readonly sourceId?: string
  readonly runId?: string
  readonly jobId?: string
}

export interface StructuredLog {
  readonly event: string
  readonly identity: TraceIdentity
  readonly errorTag?: string
  readonly count?: number
  readonly durationMs?: number
}

const traceAttributes = (
  identity: TraceIdentity,
): Record<string, string> => ({
  'struct.workspace.id': identity.workspaceId,
  ...(identity.projectId === undefined
    ? {}
    : { 'struct.project.id': identity.projectId }),
  ...(identity.sourceId === undefined
    ? {}
    : { 'struct.source.id': identity.sourceId }),
  ...(identity.runId === undefined
    ? {}
    : { 'struct.run.id': identity.runId }),
  ...(identity.jobId === undefined
    ? {}
    : { 'struct.job.id': identity.jobId }),
})

export const withWalkingSliceSpan = <A, E, R>(
  stage: WalkingSliceStage,
  identity: TraceIdentity,
  effect: Effect.Effect<A, E, R>,
): Effect.Effect<A, E, R> =>
  effect.pipe(
    Effect.annotateLogs(traceAttributes(identity)),
    Effect.annotateSpans(traceAttributes(identity)),
    Effect.withSpan(`struct.${stage}`, {
      attributes: traceAttributes(identity),
    }),
  )

export const logWalkingSlice = (
  input: StructuredLog,
): Effect.Effect<void> =>
  Effect.logInfo(input.event).pipe(
    Effect.annotateLogs({
      ...traceAttributes(input.identity),
      ...(input.errorTag === undefined ? {} : { 'error.tag': input.errorTag }),
      ...(input.count === undefined ? {} : { count: input.count }),
      ...(input.durationMs === undefined
        ? {}
        : { 'duration.ms': input.durationMs }),
    }),
  )

export const walkingSliceMetrics = {
  'runs.started': Metric.counter('struct_research_runs_started_total', {
    incremental: true,
  }),
  'runs.completed': Metric.counter('struct_research_runs_completed_total', {
    incremental: true,
  }),
  'runs.failed': Metric.counter('struct_research_runs_failed_total', {
    incremental: true,
  }),
  'citations.validated': Metric.counter(
    'struct_research_citations_validated_total',
    { incremental: true },
  ),
}

export const incrementWalkingSliceMetric = (
  metric: WalkingSliceMetric,
  amount = 1,
): Effect.Effect<void> =>
  Metric.incrementBy(walkingSliceMetrics[metric], amount)

const metricNames: Record<WalkingSliceMetric, string> = {
  'runs.started': 'struct_research_runs_started_total',
  'runs.completed': 'struct_research_runs_completed_total',
  'runs.failed': 'struct_research_runs_failed_total',
  'citations.validated': 'struct_research_citations_validated_total',
}

export const renderWalkingSliceMetrics: Effect.Effect<string> = Effect.gen(
  function* () {
    const values = yield* Effect.all(
      Object.entries(walkingSliceMetrics).map(
        ([key, metric]) =>
          Metric.value(metric).pipe(
            Effect.map((value) => [
              key as WalkingSliceMetric,
              Number(value.count),
            ] as const),
          ),
      ),
    )
    return `${values.map(([key, count]) => [
      `# TYPE ${metricNames[key]} counter`,
      `${metricNames[key]} ${count}`,
    ].join('\n')).join('\n')}\n`
  },
)

export interface TracingSdkOptions {
  readonly serviceName: string
  readonly serviceVersion?: string
  readonly otlpEndpoint?: string
}

export const tracingOtlpEndpointConfig = Config.option(
  Config.string('OTEL_EXPORTER_OTLP_TRACES_ENDPOINT'),
).pipe(Config.map(Option.getOrUndefined))

export const makeTracingLayer = (
  options: TracingSdkOptions,
): Layer.Layer<never> => {
  const processors = [
    new SimpleSpanProcessor(new ConsoleSpanExporter()),
    ...(options.otlpEndpoint === undefined
      ? []
      : [
          new BatchSpanProcessor(
            new OTLPTraceExporter({ url: options.otlpEndpoint }),
          ),
        ]),
  ]
  return Layer.merge(
    NodeSdk.layer(() => ({
      resource: {
        serviceName: options.serviceName,
        ...(options.serviceVersion === undefined
          ? {}
          : { serviceVersion: options.serviceVersion }),
      },
      spanProcessor: processors,
    })),
    Logger.json,
  )
}
