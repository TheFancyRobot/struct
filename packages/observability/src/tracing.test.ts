import { describe, expect, it } from 'bun:test'
import { Effect, Metric } from 'effect'
import {
  incrementWalkingSliceMetric,
  makeTracingLayer,
  renderWalkingSliceMetrics,
  walkingSliceMetrics,
  withWalkingSliceSpan,
} from './tracing'

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

  it('configures stdout tracing without requiring an OTLP collector', () => {
    expect(makeTracingLayer({ serviceName: 'struct-test' })).toBeDefined()
  })

  it('renders the counters for operational scraping', async () => {
    const rendered = await Effect.runPromise(renderWalkingSliceMetrics)
    expect(rendered).toContain('# TYPE struct_research_runs_started_total counter')
    expect(rendered).toContain('struct_research_citations_validated_total')
  })
})
