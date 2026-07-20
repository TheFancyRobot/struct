import { describe, expect, it } from 'bun:test'
import {
  ResearchPlan,
} from '@struct/domain'
import { Effect, Either, Schema } from 'effect'
import {
  decomposeQuestionRoutes,
  ResearchPlanningInput,
  routeResearchPlan,
  validateResearchPlan,
} from '../src/index.js'

const uuid = (suffix: string) => `870e8400-e29b-41d4-a716-${suffix}`
const ids = {
  workspace: uuid('446655440000'),
  project: uuid('446655440001'),
  run: uuid('446655440002'),
  plan: uuid('446655440003'),
  document: uuid('446655440004'),
  datasetVersion: uuid('446655440005'),
  dataset: uuid('446655440006'),
  snapshot: uuid('446655440007'),
  recursiveOne: uuid('446655440008'),
  recursiveTwo: uuid('446655440009'),
  documentEvidence: uuid('446655440010'),
  datasetEvidence: uuid('446655440011'),
  recursiveEvidence: uuid('446655440012'),
  documentNode: uuid('446655440013'),
  datasetNode: uuid('446655440014'),
  recursiveNode: uuid('446655440015'),
  synthesisNode: uuid('446655440016'),
}

const sourceScopes = [
  { kind: 'document', sourceVersionId: ids.document },
  {
    kind: 'dataset',
    datasetId: ids.dataset,
    datasetSnapshotId: ids.snapshot,
    sourceVersionIds: [ids.datasetVersion],
  },
  {
    kind: 'recursive',
    sourceVersionIds: [ids.recursiveOne, ids.recursiveTwo],
  },
] satisfies ReadonlyArray<Record<string, unknown>>

const toolPolicy = {
  grants: [
    {
      toolId: 'hybrid-retrieval',
      capability: 'document:retrieve',
      maximumCalls: 1,
    },
    {
      toolId: 'dataset-query',
      capability: 'dataset:query',
      maximumCalls: 1,
    },
    {
      toolId: 'recursive-analysis',
      capability: 'recursive:analyze',
      maximumCalls: 1,
    },
  ],
}

function input(
  kind: 'document' | 'dataset' | 'recursive' | 'mixed' = 'mixed',
) {
  return Schema.decodeUnknownSync(ResearchPlanningInput)({
    planId: ids.plan,
    runId: ids.run,
    workspaceId: ids.workspace,
    projectId: ids.project,
    question: 'Reconcile the policy, exact total, and corpus-wide themes.',
    classification: {
      version: '1',
      kind,
      routes: kind === 'mixed'
        ? ['document', 'dataset', 'recursive']
        : [kind],
      mode: 'deep',
      requiresExactComputation: kind === 'dataset' || kind === 'mixed',
      confidence: 0.95,
    },
    sourceScopes,
    toolPolicy,
    budgetCeiling: {
      maximumSteps: 8,
      maximumModelCalls: 2,
      maximumToolCalls: 3,
      maximumTokens: 200_000,
      maximumElapsedMilliseconds: 120_000,
      maximumEstimatedCostMicros: 2_000_000,
      maximumFanOut: 3,
      maximumRevisions: 1,
    },
  })
}

function plan() {
  return {
    version: '1',
    id: ids.plan,
    runId: ids.run,
    workspaceId: ids.workspace,
    projectId: ids.project,
    objective: input().question,
    sourceScopes,
    nodes: [
      {
        id: ids.documentNode,
        kind: 'document-retrieval',
        goal: 'Retrieve policy evidence.',
        dependencies: [],
        inputRefs: [{ kind: 'source-version', sourceVersionId: ids.document }],
        evidenceRefs: [ids.documentEvidence],
      },
      {
        id: ids.datasetNode,
        kind: 'dataset-query',
        goal: 'Compute an exact total.',
        dependencies: [],
        inputRefs: [{
          kind: 'dataset-snapshot',
          datasetId: ids.dataset,
          datasetSnapshotId: ids.snapshot,
        }],
        evidenceRefs: [ids.datasetEvidence],
        toolInput: {
          kind: 'dataset-query',
          operation: 'count',
          snapshot: {
            alias: 'records',
            datasetId: ids.dataset,
            datasetSnapshotId: ids.snapshot,
          },
          columns: [],
          rowLimit: 1,
          limits: {
            maxRows: 1,
            maxOutputBytes: 1_000,
            maxMemoryMb: 64,
            timeoutMs: 1_000,
          },
        },
      },
      {
        id: ids.recursiveNode,
        kind: 'recursive-analysis',
        goal: 'Analyze corpus-wide themes.',
        dependencies: [],
        inputRefs: [{
          kind: 'recursive-source-set',
          sourceVersionIds: [ids.recursiveOne, ids.recursiveTwo],
        }],
        evidenceRefs: [ids.recursiveEvidence],
        toolInput: { kind: 'recursive-analysis' },
      },
      {
        id: ids.synthesisNode,
        kind: 'answer-synthesis',
        goal: 'Reconcile all evidence branches.',
        dependencies: [
          ids.documentNode,
          ids.datasetNode,
          ids.recursiveNode,
        ],
        inputRefs: [
          { kind: 'node-output', nodeId: ids.documentNode },
          { kind: 'node-output', nodeId: ids.datasetNode },
          { kind: 'node-output', nodeId: ids.recursiveNode },
        ],
        evidenceRefs: [
          ids.documentEvidence,
          ids.datasetEvidence,
          ids.recursiveEvidence,
        ],
      },
    ],
    evidenceRequirements: [
      {
        id: ids.documentEvidence,
        kind: 'document',
        sourceVersionIds: [ids.document],
        minimumCitations: 1,
      },
      {
        id: ids.datasetEvidence,
        kind: 'dataset',
        datasetId: ids.dataset,
        datasetSnapshotId: ids.snapshot,
        minimumCitations: 1,
      },
      {
        id: ids.recursiveEvidence,
        kind: 'recursive',
        sourceVersionIds: [ids.recursiveOne, ids.recursiveTwo],
        minimumCitations: 2,
      },
    ],
    toolPolicy,
    budget: {
      ...input().budgetCeiling,
      maximumSteps: 4,
      maximumModelCalls: 1,
    },
  }
}

async function reason(effect: Effect.Effect<unknown, { readonly reason: string }>) {
  const result = await Effect.runPromise(Effect.either(effect))
  return Either.isLeft(result) ? result.left.reason : undefined
}

describe('hybrid question decomposition and source routing', () => {
  it('builds deterministic document, dataset, recursive, and synthesis routes', async () => {
    const decoded = await Effect.runPromise(validateResearchPlan(input(), plan()))
    expect(Schema.is(ResearchPlan)(decoded)).toBe(true)
    const branches = await Effect.runPromise(
      decomposeQuestionRoutes(input().classification, decoded.sourceScopes),
    )
    expect(branches).toEqual(['dataset', 'document', 'recursive'])
    const routes = await Effect.runPromise(routeResearchPlan(decoded, branches))
    expect(routes.map((route) => route.branch).sort()).toEqual([
      'dataset',
      'document',
      'recursive',
      'synthesis',
    ])
  })

  it('routes only explicitly selected mixed branches', async () => {
    const proposal = plan()
    const selected = {
      ...proposal,
      nodes: proposal.nodes
        .filter((node) => node.kind !== 'recursive-analysis')
        .map((node) => node.kind === 'answer-synthesis'
          ? {
              ...node,
              dependencies: node.dependencies.filter(
                (dependency) => dependency !== ids.recursiveNode,
              ),
              inputRefs: node.inputRefs.filter(
                (ref) =>
                  ref.kind !== 'node-output'
                  || !('nodeId' in ref)
                  || ref.nodeId !== ids.recursiveNode,
              ),
              evidenceRefs: node.evidenceRefs.filter(
                (id) => id !== ids.recursiveEvidence,
              ),
            }
          : node),
      evidenceRequirements: proposal.evidenceRequirements.filter(
        (requirement) => requirement.kind !== 'recursive',
      ),
      toolPolicy: {
        grants: proposal.toolPolicy.grants.filter(
          (grant) => grant.toolId !== 'recursive-analysis',
        ),
      },
      budget: {
        ...proposal.budget,
        maximumToolCalls: 2,
      },
    }
    const selectedInput = Schema.decodeUnknownSync(ResearchPlanningInput)({
      ...input(),
      classification: {
        ...input().classification,
        routes: ['document', 'dataset'],
      },
    })
    const decoded = await Effect.runPromise(
      validateResearchPlan(selectedInput, selected),
    )
    expect(decoded.nodes.some(
      (node) => node.kind === 'recursive-analysis',
    )).toBe(false)

    expect(await reason(validateResearchPlan(selectedInput, plan())))
      .toBe('unsupported-tool')
  })

  it('rejects missing and ambiguous classified source routes', async () => {
    expect(await reason(decomposeQuestionRoutes(
      { ...input('recursive').classification },
      [input().sourceScopes[0]!],
    ))).toBe('missing-reference')
    expect(await reason(decomposeQuestionRoutes(
      { ...input('mixed').classification },
      [input().sourceScopes[0]!],
    ))).toBe('missing-reference')
  })

  it('rejects an incompatible recursive route and premature synthesis', async () => {
    const missingRecursive = {
      ...plan(),
      nodes: plan().nodes.filter((node) => node.kind !== 'recursive-analysis'),
    }
    expect(await reason(validateResearchPlan(input(), missingRecursive)))
      .toBe('missing-dependency')

    const premature = {
      ...plan(),
      nodes: plan().nodes.map((node) =>
        node.kind === 'answer-synthesis'
          ? {
              ...node,
              dependencies: [ids.documentNode, ids.datasetNode],
              inputRefs: node.inputRefs.filter(
                (ref) =>
                  ref.kind !== 'node-output'
                  || !('nodeId' in ref)
                  || ref.nodeId !== ids.recursiveNode,
              ),
            }
          : node),
    }
    expect(await reason(validateResearchPlan(input(), premature)))
      .toBe('missing-dependency')
  })

  it('rejects duplicate synthesis evidence that masks a missing requirement', async () => {
    const duplicateEvidence = {
      ...plan(),
      nodes: plan().nodes.map((node) =>
        node.kind === 'answer-synthesis'
          ? {
              ...node,
              evidenceRefs: [
                ids.documentEvidence,
                ids.datasetEvidence,
                ids.datasetEvidence,
              ],
            }
          : node),
    }

    expect(await reason(validateResearchPlan(input(), duplicateEvidence)))
      .toBe('missing-reference')
  })

  it('round-trips stable recursive source identities and rejects widening', async () => {
    const decoded = await Effect.runPromise(validateResearchPlan(input(), plan()))
    const encoded = Schema.encodeSync(ResearchPlan)(decoded)
    expect(await reason(validateResearchPlan(input(), encoded))).toBeUndefined()

    const widened = {
      ...plan(),
      sourceScopes: plan().sourceScopes.map((scope) =>
        scope.kind === 'recursive'
          ? {
              ...scope,
              sourceVersionIds: [
                ...(scope.sourceVersionIds ?? []),
                uuid('446655449999'),
              ],
            }
          : scope),
    }
    expect(await reason(validateResearchPlan(input(), widened)))
      .toBe('missing-reference')
  })
})
