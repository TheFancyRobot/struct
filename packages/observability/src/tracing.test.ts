import { describe, expect, it } from 'bun:test'
import { Effect, Equal, Exit, FiberId, Metric, Schema } from 'effect'
import {
  InMemorySpanExporter,
  SimpleSpanProcessor,
} from '@opentelemetry/sdk-trace-base'
import {
  classifyTerminalFailure,
  incrementWalkingSliceMetric,
  makeSupportDiagnostic,
  makeTracingLayer,
  observeBoundary,
  redactTelemetryValue,
  renderWalkingSliceMetrics,
  walkingSliceMetrics,
  withWalkingSliceSpan,
} from './tracing'

class DataEngineTransportError
  extends Schema.TaggedError<DataEngineTransportError>()(
    'DataEngineTransportError',
    { message: Schema.String },
  ) {}

describe('walking-slice observability', () => {
  it('correlates an Effect span without changing its typed result', async () => {
    const result = await Effect.runPromise(
      withWalkingSliceSpan(
        'retrieval',
        {
          workspaceId: 'workspace-1',
          projectId: 'project-1',
          runId: 'run-1',
        },
        Effect.succeed('grounded'),
      ),
    )
    expect(result).toBe('grounded')
  })

  it('tracks only the four walking-slice counters', async () => {
    const before = await Effect.runPromise(
      Metric.value(walkingSliceMetrics['citations.validated']),
    )
    await Effect.runPromise(incrementWalkingSliceMetric('citations.validated', 2))
    const after = await Effect.runPromise(
      Metric.value(walkingSliceMetrics['citations.validated']),
    )
    expect(Number(after.count) - Number(before.count)).toBe(2)
  })

  it('configures stdout tracing without requiring an OTLP collector', async () => {
    const result = await Effect.runPromise(
      Effect.succeed('traced').pipe(
        Effect.withSpan('struct.test'),
        Effect.provide(makeTracingLayer({ serviceName: 'struct-test' })),
      ),
    )
    expect(result).toBe('traced')
  })

  it('renders the counters for operational scraping', async () => {
    const rendered = await Effect.runPromise(renderWalkingSliceMetrics)
    expect(rendered).toContain('# TYPE struct_research_runs_started_total counter')
    expect(rendered).toContain('struct_research_citations_validated_total')
    expect(rendered).toContain('struct_database_failure_total')
    expect(rendered).toContain('struct_sse_success_total')
  })

  it('preserves success and typed failure outcomes across correlated boundaries', async () => {
    const identity = {
      requestId: 'request-1',
      workspaceId: 'workspace-1',
      projectId: 'project-1',
      runId: 'run-1',
      jobId: 'job-1',
    }
    const before = await Effect.runPromise(renderWalkingSliceMetrics)
    const beforeRequestSuccess = Number(
      /^struct_request_success_total (\d+)$/m.exec(before)?.[1] ?? '-1',
    )
    const success = await Effect.runPromise(observeBoundary({
      boundary: 'request',
      event: 'research.accepted',
      identity,
      effect: observeBoundary({
        boundary: 'job',
        event: 'research.executed',
        identity,
        effect: observeBoundary({
          boundary: 'database',
          event: 'research.persisted',
          identity,
          effect: Effect.succeed('complete'),
        }),
      }),
    }))
    expect(success).toBe('complete')
    const after = await Effect.runPromise(renderWalkingSliceMetrics)
    expect(Number(
      /^struct_request_success_total (\d+)$/m.exec(after)?.[1] ?? '-1',
    )).toBe(beforeRequestSuccess + 1)

    const failure = await Effect.runPromiseExit(observeBoundary({
      boundary: 'sidecar',
      event: 'dataset.query.failed',
      identity,
      effect: Effect.fail(new DataEngineTransportError({
        message: 'Bearer secret-value must never be logged',
      })),
    }))
    expect(Exit.isFailure(failure)).toBe(true)
    expect(classifyTerminalFailure(new DataEngineTransportError({
      message: 'unavailable',
    }))).toBe('dependency-unavailable')
  })

  it('classifies failed HTTP responses without changing the response value', async () => {
    const before = await Effect.runPromise(renderWalkingSliceMetrics)
    const beforeFailures = Number(
      /^struct_request_failure_total (\d+)$/m.exec(before)?.[1] ?? '-1',
    )
    const response = new Response('unavailable', { status: 503 })
    const result = await Effect.runPromise(observeBoundary({
      boundary: 'request',
      event: 'api.request',
      identity: { requestId: 'request-503' },
      effect: Effect.succeed(response),
      resultClassification: (value) => value.status >= 500
        ? 'internal-failure'
        : undefined,
    }))
    expect(result).toBe(response)
    const after = await Effect.runPromise(renderWalkingSliceMetrics)
    expect(Number(
      /^struct_request_failure_total (\d+)$/m.exec(after)?.[1] ?? '-1',
    )).toBe(beforeFailures + 1)
  })

  it('preserves every Exit while exporting only sanitized failure telemetry', async () => {
    const exporter = new InMemorySpanExporter()
    const secretFailure = {
      _tag: 'ProviderUnavailableError',
      message: 'Bearer provider-secret-token',
      stack: 'source-content-stack-secret',
      cause: {
        prompt: 'private-prompt-secret',
        providerPayload: 'private-provider-payload',
      },
    } as const
    const successValue = { result: 'exact-success-reference' }
    const expectedFailure = Exit.fail(secretFailure)
    const expectedInterruption = Exit.interrupt(FiberId.make(42, 123))

    const captured = await Effect.runPromise(Effect.gen(function* () {
      const success = yield* Effect.exit(observeBoundary({
        boundary: 'request',
        event: 'request.completed',
        identity: { requestId: 'request-success' },
        effect: Effect.succeed(successValue),
      }))
      const failure = yield* Effect.exit(observeBoundary({
        boundary: 'sidecar',
        event: 'sidecar.failed',
        identity: { runId: 'run-failure' },
        effect: expectedFailure,
      }))
      const interruption = yield* Effect.exit(observeBoundary({
        boundary: 'job',
        event: 'job.interrupted',
        identity: { jobId: 'job-interrupted' },
        effect: expectedInterruption,
      }))
      return {
        success,
        failure,
        interruption,
        spans: exporter.getFinishedSpans().map((span) => ({
          name: span.name,
          attributes: span.attributes,
          events: span.events,
          status: span.status,
        })),
      }
    }).pipe(Effect.provide(makeTracingLayer({
      serviceName: 'struct-privacy-test',
      spanProcessor: new SimpleSpanProcessor(exporter),
    }))))

    expect(Exit.isSuccess(captured.success)).toBe(true)
    if (Exit.isSuccess(captured.success)) {
      expect(captured.success.value).toBe(successValue)
    }
    expect(Equal.equals(captured.failure, expectedFailure)).toBe(true)
    expect(Equal.equals(captured.interruption, expectedInterruption)).toBe(true)

    const failureSpan = captured.spans.find((span) =>
      span.name === 'struct.sidecar')
    expect(failureSpan?.status.code).toBe(1)
    expect(failureSpan?.attributes['struct.outcome']).toBe('failure')
    expect(failureSpan?.attributes['struct.classification'])
      .toBe('dependency-unavailable')
    expect(failureSpan?.attributes['error.tag']).toBe('ProviderUnavailableError')

    const interruptionSpan = captured.spans.find((span) =>
      span.name === 'struct.job')
    expect(interruptionSpan?.status.code).toBe(1)
    expect(interruptionSpan?.attributes['struct.classification'])
      .toBe('cancelled')

    const exportedTelemetry = JSON.stringify(captured.spans)
    for (const secret of [
      'provider-secret-token',
      'source-content-stack-secret',
      'private-prompt-secret',
      'private-provider-payload',
    ]) expect(exportedTelemetry).not.toContain(secret)
  })

  it('redacts sensitive nested fields and bounds support diagnostics', () => {
    const details = redactTelemetryValue({
      authorization: 'Bearer super-secret-token',
      prompt: 'private research prompt',
      nested: {
        databaseUrl: 'postgres://user:password@localhost/struct',
        email: 'person@example.com',
        safe: 'x'.repeat(500),
      },
      sourceContent: 'private document',
    })
    const rendered = JSON.stringify(details)
    expect(rendered).not.toContain('super-secret-token')
    expect(rendered).not.toContain('private research prompt')
    expect(rendered).not.toContain('password')
    expect(rendered).not.toContain('person@example.com')
    expect(rendered).not.toContain('private document')
    expect(rendered).toContain('[REDACTED]')
    expect(rendered).toContain('[TRUNCATED]')

    const diagnostic = makeSupportDiagnostic({
      schemaVersion: '1',
      event: 'support.bundle',
      boundary: 'run',
      outcome: 'failure',
      classification: 'dependency-unavailable',
      identity: {
        workspaceId: `workspace-${'private'.repeat(100)}`,
        runId: 'run-1',
      },
      errorTag: 'DataEngineTransportError',
      details: { safe: 'y'.repeat(20_000) },
    })
    expect(new TextEncoder().encode(JSON.stringify(diagnostic)).byteLength)
      .toBeLessThanOrEqual(4_096)
    expect(JSON.stringify(diagnostic)).not.toContain('y'.repeat(500))
    expect(JSON.stringify(diagnostic)).not.toContain('private')
    expect(JSON.stringify(diagnostic)).toContain('[INVALID_CORRELATION_ID]')
    expect(diagnostic.identity).toEqual({
      workspaceId: '[INVALID_CORRELATION_ID]',
      runId: 'run-1',
    })
  })
})
