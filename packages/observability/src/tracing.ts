import {
  Cause,
  Config,
  Effect,
  Exit,
  Layer,
  Logger,
  Metric,
  Option,
  Schema,
} from 'effect'
import * as NodeSdk from '@effect/opentelemetry/NodeSdk'
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http'
import {
  BatchSpanProcessor,
  ConsoleSpanExporter,
  SimpleSpanProcessor,
  type SpanProcessor,
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
  | 'database'
  | 'data-engine'
  | 'sse'
  | 'report'

export const operationalBoundaries = [
  'request',
  'readiness',
  'workspace',
  'run',
  'job',
  'tool',
  'database',
  'sidecar',
  'sse',
  'report',
] as const

export type OperationalBoundary = typeof operationalBoundaries[number]

export const terminalClassifications = [
  'completed',
  'cancelled',
  'invalid-request',
  'not-found',
  'unauthorized',
  'dependency-unavailable',
  'timeout',
  'stalled',
  'capacity-exceeded',
  'internal-failure',
] as const

export type TerminalClassification = typeof terminalClassifications[number]

export type WalkingSliceMetric =
  | 'runs.started'
  | 'runs.completed'
  | 'runs.failed'
  | 'citations.validated'

export interface TraceIdentity {
  readonly workspaceId?: string
  readonly projectId?: string
  readonly sourceId?: string
  readonly runId?: string
  readonly jobId?: string
  readonly requestId?: string
  readonly reportId?: string
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
  ...(identity.workspaceId === undefined
    ? {}
    : { 'struct.workspace.id': boundedCorrelationId(identity.workspaceId) }),
  ...(identity.projectId === undefined
    ? {}
    : { 'struct.project.id': boundedCorrelationId(identity.projectId) }),
  ...(identity.sourceId === undefined
    ? {}
    : { 'struct.source.id': boundedCorrelationId(identity.sourceId) }),
  ...(identity.runId === undefined
    ? {}
    : { 'struct.run.id': boundedCorrelationId(identity.runId) }),
  ...(identity.jobId === undefined
    ? {}
    : { 'struct.job.id': boundedCorrelationId(identity.jobId) }),
  ...(identity.requestId === undefined
    ? {}
    : { 'struct.request.id': boundedCorrelationId(identity.requestId) }),
  ...(identity.reportId === undefined
    ? {}
    : { 'struct.report.id': boundedCorrelationId(identity.reportId) }),
})

const diagnosticIdentity = (identity: TraceIdentity): TraceIdentity => ({
  ...(identity.workspaceId === undefined
    ? {}
    : { workspaceId: boundedCorrelationId(identity.workspaceId) }),
  ...(identity.projectId === undefined
    ? {}
    : { projectId: boundedCorrelationId(identity.projectId) }),
  ...(identity.sourceId === undefined
    ? {}
    : { sourceId: boundedCorrelationId(identity.sourceId) }),
  ...(identity.runId === undefined
    ? {}
    : { runId: boundedCorrelationId(identity.runId) }),
  ...(identity.jobId === undefined
    ? {}
    : { jobId: boundedCorrelationId(identity.jobId) }),
  ...(identity.requestId === undefined
    ? {}
    : { requestId: boundedCorrelationId(identity.requestId) }),
  ...(identity.reportId === undefined
    ? {}
    : { reportId: boundedCorrelationId(identity.reportId) }),
})

const sensitiveKey = /(?:authorization|cookie|credential|secret|token|password|prompt|content|payload|provider|sql|query)/i
const credentialValue = /(?:bearer\s+[a-z0-9._~+/-]+|postgres(?:ql)?:\/\/[^\s:@/]+:[^\s@/]+@|\b(?:sk|pk)_[a-z0-9_-]{12,}\b)/gi
const emailValue = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi
const MAX_STRING_LENGTH = 160
const MAX_ARRAY_ITEMS = 10
const MAX_OBJECT_FIELDS = 24
const MAX_DIAGNOSTIC_BYTES = 4_096

const boundedCorrelationId = (value: string): string =>
  /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/.test(value)
    ? value
    : '[INVALID_CORRELATION_ID]'

const boundedString = (value: string): string => {
  const redacted = value
    .replace(credentialValue, '[REDACTED]')
    .replace(emailValue, '[REDACTED]')
  return redacted.length <= MAX_STRING_LENGTH
    ? redacted
    : `${redacted.slice(0, MAX_STRING_LENGTH - 12)}...[TRUNCATED]`
}

/** Deterministically redacts and bounds values before they reach telemetry. */
export const redactTelemetryValue = (
  value: unknown,
  depth = 0,
): unknown => {
  if (depth >= 3) return '[TRUNCATED]'
  if (typeof value === 'string') return boundedString(value)
  if (
    value === null
    || typeof value === 'number'
    || typeof value === 'boolean'
  ) return value
  if (typeof value === 'bigint') return value.toString()
  if (Array.isArray(value)) {
    return value.slice(0, MAX_ARRAY_ITEMS).map((item) =>
      redactTelemetryValue(item, depth + 1))
  }
  if (typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).slice(0, MAX_OBJECT_FIELDS).map(([key, item]) => [
        boundedString(key),
        sensitiveKey.test(key)
          ? '[REDACTED]'
          : redactTelemetryValue(item, depth + 1),
      ]),
    )
  }
  return `[${typeof value}]`
}

const safeTag = (value: unknown): string => {
  if (
    typeof value === 'object'
    && value !== null
    && '_tag' in value
    && typeof value._tag === 'string'
    && /^[A-Za-z][A-Za-z0-9]{0,63}$/.test(value._tag)
  ) return value._tag
  return 'UnknownFailure'
}

export const classifyTerminalFailure = (
  failure: unknown,
): Exclude<TerminalClassification, 'completed'> => {
  if (failure instanceof DependencyReadinessError) return failure.classification
  const tag = safeTag(failure).toLowerCase()
  if (tag.includes('cancel')) return 'cancelled'
  if (tag.includes('auth')) return 'unauthorized'
  if (tag.includes('notfound')) return 'not-found'
  if (tag.includes('validation') || tag.includes('parse')) return 'invalid-request'
  if (tag.includes('timeout') || tag.includes('elapsed')) return 'timeout'
  if (tag.includes('stale') || tag.includes('stall')) return 'stalled'
  if (tag.includes('capacity') || tag.includes('limit')) return 'capacity-exceeded'
  if (
    tag.includes('database')
    || tag.includes('queryerror')
    || tag.includes('storage')
    || tag.includes('transport')
    || tag.includes('dataengine')
    || tag.includes('sidecar')
    || tag.includes('providerunavailable')
  ) return 'dependency-unavailable'
  return 'internal-failure'
}

export class DependencyReadinessError
  extends Schema.TaggedError<DependencyReadinessError>()(
    'DependencyReadinessError',
    {
      dependency: Schema.Literal('database', 'data-engine', 'worker'),
      classification: Schema.Literal('dependency-unavailable', 'timeout', 'stalled'),
      message: Schema.String,
    },
  ) {}

export interface SupportDiagnostic {
  readonly schemaVersion: '1'
  readonly event: string
  readonly boundary: OperationalBoundary
  readonly outcome: 'success' | 'failure'
  readonly classification: TerminalClassification
  readonly identity: TraceIdentity
  readonly durationMs?: number
  readonly errorTag?: string
  readonly details?: unknown
}

export const makeSupportDiagnostic = (input: SupportDiagnostic): SupportDiagnostic => {
  const diagnostic: SupportDiagnostic = {
    schemaVersion: '1',
    event: boundedString(input.event),
    boundary: input.boundary,
    outcome: input.outcome,
    classification: input.classification,
    identity: diagnosticIdentity(input.identity),
    ...(input.durationMs === undefined
      ? {}
      : { durationMs: Math.max(0, Math.round(input.durationMs)) }),
    ...(input.errorTag === undefined
      ? {}
      : { errorTag: safeTag({ _tag: input.errorTag }) }),
    ...(input.details === undefined
      ? {}
      : { details: redactTelemetryValue(input.details) }),
  }
  if (new TextEncoder().encode(JSON.stringify(diagnostic)).byteLength <= MAX_DIAGNOSTIC_BYTES) {
    return diagnostic
  }
  return { ...diagnostic, details: '[TRUNCATED]' }
}

export const logWalkingSlice = (
  input: StructuredLog,
): Effect.Effect<void> =>
  Effect.logInfo(boundedString(input.event)).pipe(
    Effect.annotateLogs({
      ...traceAttributes(input.identity),
      ...(input.errorTag === undefined
        ? {}
        : { 'error.tag': safeTag({ _tag: input.errorTag }) }),
      ...(input.count === undefined
        ? {}
        : { count: Number.isSafeInteger(input.count) ? input.count : 0 }),
      ...(input.durationMs === undefined
        ? {}
        : { 'duration.ms': Number.isFinite(input.durationMs)
            ? Math.max(0, Math.round(input.durationMs))
            : 0 }),
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

const operationalOutcomes = ['success', 'failure'] as const
type OperationalOutcome = typeof operationalOutcomes[number]

const operationalMetricEntries = operationalBoundaries.flatMap((boundary) =>
  operationalOutcomes.map((outcome) => {
    const name = `struct_${boundary.replaceAll('-', '_')}_${outcome}_total`
    return { boundary, outcome, name, metric: Metric.counter(
      `struct_${boundary.replaceAll('-', '_')}_${outcome}_total`,
      { incremental: true },
    ) }
  }))

const incrementOperationalMetric = (
  boundary: OperationalBoundary,
  outcome: OperationalOutcome,
) => Metric.increment(Metric.counter(
  `struct_${boundary.replaceAll('-', '_')}_${outcome}_total`,
  { incremental: true },
))

export const observeBoundary = <A, E, R>(input: {
  readonly boundary: OperationalBoundary
  readonly event: string
  readonly identity: TraceIdentity
  readonly effect: Effect.Effect<A, E, R>
  readonly resultClassification?: (
    value: A,
  ) => Exclude<TerminalClassification, 'completed'> | undefined
}): Effect.Effect<A, E, R> => Effect.gen(function* () {
  const startedAt = yield* Effect.clockWith((clock) => clock.currentTimeMillis)
  const exit = yield* Effect.exit(input.effect).pipe(
    Effect.tap((exit) => Effect.gen(function* () {
      const durationMs = Math.max(
        0,
        (yield* Effect.clockWith((clock) => clock.currentTimeMillis)) - startedAt,
      )
      if (Exit.isSuccess(exit)) {
        const resultClassification = input.resultClassification?.(exit.value)
        const outcome = resultClassification === undefined ? 'success' : 'failure'
        const classification = resultClassification ?? 'completed'
        yield* incrementOperationalMetric(input.boundary, outcome)
        yield* Effect.annotateCurrentSpan({
          'struct.outcome': outcome,
          'struct.classification': classification,
        })
        const log = resultClassification === undefined
          ? Effect.logInfo(boundedString(input.event))
          : Effect.logWarning(boundedString(input.event))
        yield* log.pipe(Effect.annotateLogs({
          ...traceAttributes(input.identity),
          'struct.boundary': input.boundary,
          'struct.outcome': outcome,
          'struct.classification': classification,
          'duration.ms': durationMs,
        }))
        return
      }
      const failure = Option.getOrUndefined(Cause.failureOption(exit.cause))
      const classification = Cause.isInterruptedOnly(exit.cause)
        ? 'cancelled'
        : classifyTerminalFailure(failure)
      yield* incrementOperationalMetric(input.boundary, 'failure')
      yield* Effect.annotateCurrentSpan({
        'struct.outcome': 'failure',
        'struct.classification': classification,
        'error.tag': safeTag(failure),
      })
      yield* Effect.logWarning(boundedString(input.event)).pipe(Effect.annotateLogs({
        ...traceAttributes(input.identity),
        'struct.boundary': input.boundary,
        'struct.outcome': 'failure',
        'struct.classification': classification,
        'error.tag': safeTag(failure),
        'duration.ms': durationMs,
      }))
    })),
    Effect.annotateLogs(traceAttributes(input.identity)),
    Effect.annotateSpans(traceAttributes(input.identity)),
    Effect.withSpan(`struct.${input.boundary}`, {
      attributes: {
        ...traceAttributes(input.identity),
        'struct.boundary': input.boundary,
      },
    }),
  )
  return yield* exit
})

const stageBoundary: Record<WalkingSliceStage, OperationalBoundary> = {
  'api-request': 'request',
  command: 'workspace',
  'worker-job': 'job',
  'fred-run': 'run',
  'fred-step': 'tool',
  'model-call': 'tool',
  retrieval: 'tool',
  'citation-validation': 'tool',
  database: 'database',
  'data-engine': 'sidecar',
  sse: 'sse',
  report: 'report',
}

export const withWalkingSliceSpan = <A, E, R>(
  stage: WalkingSliceStage,
  identity: TraceIdentity,
  effect: Effect.Effect<A, E, R>,
): Effect.Effect<A, E, R> => observeBoundary({
  boundary: stageBoundary[stage],
  event: `struct.${stage}`,
  identity,
  effect,
})

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
    const operationalValues = yield* Effect.all(
      operationalMetricEntries.map((entry) =>
        Metric.value(entry.metric).pipe(
          Effect.map((value) => ({ ...entry, count: Number(value.count) })),
        )),
    )
    return `${values.map(([key, count]) => [
      `# TYPE ${metricNames[key]} counter`,
      `${metricNames[key]} ${count}`,
    ].join('\n')).join('\n')}\n${operationalValues.map(({ name, count }) =>
      `# TYPE ${name} counter\n${name} ${count}`).join('\n')}\n`
  },
)

export interface TracingSdkOptions {
  readonly serviceName: string
  readonly serviceVersion?: string
  readonly otlpEndpoint?: string
  /** Test-only or embedding override. Production defaults remain console plus optional OTLP. */
  readonly spanProcessor?: SpanProcessor
}

export const tracingOtlpEndpointConfig = Config.option(
  Config.string('OTEL_EXPORTER_OTLP_TRACES_ENDPOINT'),
).pipe(Config.map(Option.getOrUndefined))

export const makeTracingLayer = (
  options: TracingSdkOptions,
): Layer.Layer<never> => {
  const processors = options.spanProcessor === undefined
    ? [
        new SimpleSpanProcessor(new ConsoleSpanExporter()),
        ...(options.otlpEndpoint === undefined
          ? []
          : [
              new BatchSpanProcessor(
                new OTLPTraceExporter({ url: options.otlpEndpoint }),
              ),
            ]),
      ]
    : [options.spanProcessor]
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
