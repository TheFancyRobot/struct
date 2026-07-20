import { Effect } from 'effect'
import { DependencyReadinessError } from './tracing.js'

export interface ReadinessCheck {
  readonly dependency: DependencyReadinessError['dependency']
  readonly check: Effect.Effect<void, unknown>
}

export interface ReadinessReport {
  readonly status: 'ready' | 'not-ready'
  readonly failures: ReadonlyArray<{
    readonly dependency: DependencyReadinessError['dependency']
    readonly classification: DependencyReadinessError['classification']
  }>
}

export const checkReadiness = (
  checks: ReadonlyArray<ReadinessCheck>,
): Effect.Effect<ReadinessReport> => Effect.gen(function* () {
  const results = yield* Effect.forEach(checks, ({ dependency, check }) =>
    Effect.either(check).pipe(Effect.map((result) => ({ dependency, result }))), {
    concurrency: 'unbounded',
  })
  const failures = results.flatMap(({ dependency, result }) => {
    if (result._tag === 'Right') return []
    const classification: DependencyReadinessError['classification'] =
      result.left instanceof DependencyReadinessError
        ? result.left.classification
        : 'dependency-unavailable'
    return [{ dependency, classification }]
  })
  return {
    status: failures.length === 0 ? 'ready' : 'not-ready',
    failures,
  }
})

export const healthResponse = (): Response => new Response(
  JSON.stringify({ status: 'alive' }),
  {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  },
)

export const readinessResponse = (
  checks: ReadonlyArray<ReadinessCheck>,
): Effect.Effect<Response> => checkReadiness(checks).pipe(
  Effect.map((report) => new Response(JSON.stringify(report), {
    status: report.status === 'ready' ? 200 : 503,
    headers: { 'Content-Type': 'application/json' },
  })),
)
