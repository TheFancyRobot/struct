import { describe, expect, it } from 'bun:test'
import {
  ProjectId,
  ResearchPlanId,
  ResearchPlanNodeId,
  ResearchRunId,
  SourceVersionId,
  WorkspaceId,
  type ResearchPlan,
} from '@struct/domain'
import { Deferred, Effect, Fiber, Ref } from 'effect'
import { runHybridBranches } from '../src/run-hybrid-branches.js'

const nodeId = (suffix: string) =>
  ResearchPlanNodeId.make(`970e8400-e29b-41d4-a716-44665544${suffix}`)
const first = nodeId('0001')
const second = nodeId('0002')
const synthesis = nodeId('0003')

const plan: ResearchPlan = {
  version: '1',
  id: ResearchPlanId.make('970e8400-e29b-41d4-a716-446655440004'),
  runId: ResearchRunId.make('970e8400-e29b-41d4-a716-446655440005'),
  workspaceId: WorkspaceId.make('970e8400-e29b-41d4-a716-446655440006'),
  projectId: ProjectId.make('970e8400-e29b-41d4-a716-446655440007'),
  objective: 'Coordinate independent branches.',
  sourceScopes: [{
    kind: 'document',
    sourceVersionId: SourceVersionId.make(
      '970e8400-e29b-41d4-a716-446655440008',
    ),
  }],
  nodes: [
    {
      id: synthesis,
      kind: 'answer-synthesis',
      goal: 'Synthesize.',
      dependencies: [first, second],
      inputRefs: [
        { kind: 'node-output', nodeId: first },
        { kind: 'node-output', nodeId: second },
      ],
      evidenceRefs: [],
    },
    {
      id: second,
      kind: 'evidence-evaluation',
      goal: 'Second.',
      dependencies: [],
      inputRefs: [],
      evidenceRefs: [],
    },
    {
      id: first,
      kind: 'document-retrieval',
      goal: 'First.',
      dependencies: [],
      inputRefs: [],
      evidenceRefs: [],
    },
  ],
  evidenceRequirements: [],
  toolPolicy: { grants: [] },
  budget: {
    maximumSteps: 3,
    maximumModelCalls: 2,
    maximumToolCalls: 1,
    maximumTokens: 1,
    maximumElapsedMilliseconds: 1_000,
    maximumEstimatedCostMicros: 10,
    maximumFanOut: 2,
    maximumRevisions: 0,
  },
}

describe('hybrid branch scheduler', () => {
  it('overlaps ready work up to the bound and waits for dependencies', async () => {
    await Effect.runPromise(Effect.gen(function* () {
      const release = yield* Deferred.make<void>()
      const bothReady = yield* Deferred.make<void>()
      const active = yield* Ref.make(0)
      const maximum = yield* Ref.make(0)
      const order = yield* Ref.make<ReadonlyArray<string>>([])

      const completed = yield* runHybridBranches(
        plan,
        { completedNodeIds: [] },
        (node) => Effect.gen(function* () {
          const count = yield* Ref.updateAndGet(active, (value) => value + 1)
          yield* Ref.update(maximum, (value) => Math.max(value, count))
          yield* Ref.update(order, (value) => [...value, `start:${node.id}`])
          if (node.id === first || node.id === second) {
            if (count === 2) yield* Deferred.succeed(bothReady, undefined)
            yield* Deferred.await(bothReady)
            yield* Deferred.await(release)
          }
          yield* Ref.update(active, (value) => value - 1)
          yield* Ref.update(order, (value) => [...value, `end:${node.id}`])
        }),
      ).pipe(
        Effect.fork,
        Effect.tap(() => Deferred.await(bothReady)),
        Effect.tap(() => Deferred.succeed(release, undefined)),
        Effect.flatMap(Fiber.join),
      )

      expect(completed).toEqual([first, second, synthesis].sort())
      expect(yield* Ref.get(maximum)).toBe(2)
      const events = yield* Ref.get(order)
      expect(events.slice(0, 2).every((item) => item.startsWith('start:'))).toBe(
        true,
      )
      expect(events.indexOf(`start:${synthesis}`)).toBeGreaterThan(
        events.indexOf(`end:${first}`),
      )
      expect(events.indexOf(`start:${synthesis}`)).toBeGreaterThan(
        events.indexOf(`end:${second}`),
      )
    }))
  })

  it('does not execute already committed nodes on restart', async () => {
    const executed: string[] = []
    const completed = await Effect.runPromise(runHybridBranches(
      plan,
      { completedNodeIds: [first] },
      (node) => Effect.sync(() => {
        executed.push(node.id)
      }),
    ))
    expect(executed).toEqual([second, synthesis])
    expect(completed).toEqual([first, second, synthesis].sort())
  })

  it('rejects checkpointed nodes outside the plan', async () => {
    const unknown = nodeId('9999')
    const outcome = await Effect.runPromise(runHybridBranches(
      plan,
      { completedNodeIds: [unknown] },
      () => Effect.void,
    ).pipe(Effect.either))

    expect(outcome._tag).toBe('Left')
    if (outcome._tag === 'Left') {
      expect(outcome.left._tag).toBe('HybridBranchSchedulingFailure')
    }
  })

  it('interrupts unfinished siblings when a ready branch fails', async () => {
    await Effect.runPromise(Effect.gen(function* () {
      const bothStarted = yield* Deferred.make<void>()
      const started = yield* Ref.make(0)
      const interrupted = yield* Ref.make(false)
      const failure = new Error('branch failed')
      const outcome = yield* runHybridBranches(
        plan,
        { completedNodeIds: [] },
        (node) => Effect.gen(function* () {
          const count = yield* Ref.updateAndGet(started, (value) => value + 1)
          if (count === 2) yield* Deferred.succeed(bothStarted, undefined)
          yield* Deferred.await(bothStarted)
          if (node.id === first) return yield* Effect.fail(failure)
          return yield* Effect.never.pipe(
            Effect.onInterrupt(() => Ref.set(interrupted, true)),
          )
        }),
      ).pipe(Effect.either)

      expect(outcome._tag).toBe('Left')
      if (outcome._tag === 'Left') {
        expect((outcome.left as Error).message).toBe(failure.message)
      }
      expect(yield* Ref.get(interrupted)).toBe(true)
    }))
  })
})
