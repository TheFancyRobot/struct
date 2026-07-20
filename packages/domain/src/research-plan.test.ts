import { describe, expect, it } from 'bun:test'
import { Effect, Either, Schema } from 'effect'
import {
  decodeQuestionClassification,
  decodeResearchPlan,
  ResearchPlan,
} from './index.js'

const id = (suffix: string) =>
  `710e8400-e29b-41d4-a716-${suffix}`

const ids = {
  workspace: id('446655440000'),
  project: id('446655440001'),
  run: id('446655440002'),
  plan: id('446655440003'),
  documentVersion: id('446655440004'),
  dataset: id('446655440005'),
  snapshot: id('446655440006'),
  datasetVersion: id('446655440007'),
  documentEvidence: id('446655440008'),
  datasetEvidence: id('446655440009'),
  root: id('446655440010'),
  document: id('446655440011'),
  datasetNode: id('446655440012'),
  evaluate: id('446655440013'),
}

function budget() {
  return {
    maximumSteps: 4,
    maximumModelCalls: 1,
    maximumToolCalls: 3,
    maximumTokens: 20_000,
    maximumElapsedMilliseconds: 60_000,
    maximumEstimatedCostMicros: 500_000,
    maximumFanOut: 2,
    maximumRevisions: 1,
  }
}

function validMixedPlan() {
  return {
    version: '1',
    id: ids.plan,
    runId: ids.run,
    workspaceId: ids.workspace,
    projectId: ids.project,
    objective: 'Compare the documented policy with exact dataset totals.',
    sourceScopes: [
      { kind: 'document', sourceVersionId: ids.documentVersion },
      {
        kind: 'dataset',
        datasetId: ids.dataset,
        datasetSnapshotId: ids.snapshot,
        sourceVersionIds: [ids.datasetVersion],
      },
    ],
    evidenceRequirements: [
      {
        id: ids.documentEvidence,
        kind: 'document',
        sourceVersionIds: [ids.documentVersion],
        minimumCitations: 1,
      },
      {
        id: ids.datasetEvidence,
        kind: 'dataset',
        datasetId: ids.dataset,
        datasetSnapshotId: ids.snapshot,
        minimumCitations: 1,
      },
    ],
    toolPolicy: {
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
          toolId: 'citation-validation',
          capability: 'citation:validate',
          maximumCalls: 1,
        },
      ],
    },
    nodes: [
      {
        id: ids.root,
        kind: 'document-retrieval',
        goal: 'Retrieve immutable document evidence.',
        dependencies: [],
        inputRefs: [
          { kind: 'source-version', sourceVersionId: ids.documentVersion },
        ],
        evidenceRefs: [ids.documentEvidence],
      },
      {
        id: ids.document,
        kind: 'citation-validation',
        goal: 'Validate document citations.',
        dependencies: [ids.root],
        inputRefs: [{ kind: 'node-output', nodeId: ids.root }],
        evidenceRefs: [ids.documentEvidence],
      },
      {
        id: ids.datasetNode,
        kind: 'dataset-query',
        goal: 'Compute the exact dataset total.',
        dependencies: [ids.root],
        inputRefs: [{
          kind: 'dataset-snapshot',
          datasetId: ids.dataset,
          datasetSnapshotId: ids.snapshot,
        }],
        evidenceRefs: [ids.datasetEvidence],
      },
      {
        id: ids.evaluate,
        kind: 'evidence-evaluation',
        goal: 'Evaluate document and dataset evidence.',
        dependencies: [ids.document, ids.datasetNode],
        inputRefs: [
          { kind: 'node-output', nodeId: ids.document },
          { kind: 'node-output', nodeId: ids.datasetNode },
        ],
        evidenceRefs: [ids.documentEvidence, ids.datasetEvidence],
      },
    ],
    budget: budget(),
  }
}

async function failureReason(
  effect: Effect.Effect<unknown, { readonly reason: string }>,
): Promise<string | undefined> {
  const result = await Effect.runPromise(Effect.either(effect))
  return Either.isLeft(result) ? result.left.reason : undefined
}

describe('research plan contracts', () => {
  it('decodes and round-trips document, dataset, and mixed source scopes', async () => {
    const mixed = validMixedPlan()
    const document = {
      ...mixed,
      sourceScopes: [mixed.sourceScopes[0]],
      evidenceRequirements: [mixed.evidenceRequirements[0]],
      toolPolicy: { grants: [mixed.toolPolicy.grants[0]] },
      nodes: [mixed.nodes[0]],
      budget: {
        ...budget(),
        maximumSteps: 1,
        maximumToolCalls: 1,
        maximumFanOut: 1,
      },
    }
    const dataset = {
      ...mixed,
      sourceScopes: [mixed.sourceScopes[1]],
      evidenceRequirements: [mixed.evidenceRequirements[1]],
      toolPolicy: { grants: [mixed.toolPolicy.grants[1]] },
      nodes: [{
        ...mixed.nodes[2],
        dependencies: [],
      }],
      budget: {
        ...budget(),
        maximumSteps: 1,
        maximumToolCalls: 1,
        maximumFanOut: 1,
      },
    }

    for (const input of [document, dataset, mixed]) {
      const decoded = await Effect.runPromise(decodeResearchPlan(input))
      const encoded = Schema.encodeSync(ResearchPlan)(decoded)
      await Effect.runPromise(decodeResearchPlan(encoded))
    }
    expect((await Effect.runPromise(
      decodeResearchPlan(mixed),
    )).sourceScopes.map((scope) => scope.kind)).toEqual([
      'document',
      'dataset',
    ])
  })

  it('decodes bounded classification and rejects non-finite confidence', async () => {
    const input = {
      version: '1',
      kind: 'mixed',
      routes: ['document', 'dataset'],
      mode: 'deep',
      requiresExactComputation: true,
      confidence: 0.9,
    }
    expect((await Effect.runPromise(
      decodeQuestionClassification(input),
    )).kind).toBe('mixed')
    expect(await failureReason(decodeQuestionClassification({
      ...input,
      confidence: Number.POSITIVE_INFINITY,
    }))).toBe('malformed')
    expect(await failureReason(decodeQuestionClassification({
      ...input,
      routes: ['document'],
    }))).toBe('malformed')
    expect(await failureReason(decodeQuestionClassification({
      ...input,
      routes: ['document', 'document'],
    }))).toBe('malformed')
    expect(await failureReason(decodeQuestionClassification({
      ...input,
      kind: 'document',
      routes: ['document'],
      requiresExactComputation: true,
    }))).toBe('malformed')
  })

  it('rejects invalid identity, tool, capability, and budget shapes', async () => {
    const plan = validMixedPlan()
    expect(await failureReason(decodeResearchPlan({
      ...plan,
      id: 'not-a-uuid',
    }))).toBe('invalid-identity')
    expect(await failureReason(decodeResearchPlan({
      ...plan,
      sourceScopes: [{
        ...plan.sourceScopes[1],
        sourceVersionIds: ['not-a-uuid'],
      }],
    }))).toBe('invalid-identity')
    expect(await failureReason(decodeResearchPlan({
      ...plan,
      nodes: [{
        ...plan.nodes[0],
        dependencies: ['not-a-uuid'],
      }],
    }))).toBe('invalid-identity')
    expect(await failureReason(decodeResearchPlan({
      ...plan,
      nodes: [{
        ...plan.nodes[0],
        evidenceRefs: ['not-a-uuid'],
      }],
    }))).toBe('invalid-identity')
    expect(await failureReason(decodeResearchPlan({
      ...plan,
      toolPolicy: {
        grants: [{ ...plan.toolPolicy.grants[0], toolId: 'shell' }],
      },
    }))).toBe('unsupported-tool')
    expect(await failureReason(decodeResearchPlan({
      ...plan,
      toolPolicy: {
        grants: [{
          ...plan.toolPolicy.grants[0],
          capability: 'filesystem:read',
        }],
      },
    }))).toBe('unsupported-capability')
    expect(await failureReason(decodeResearchPlan({
      ...plan,
      budget: { ...budget(), maximumSteps: Number.POSITIVE_INFINITY },
    }))).toBe('invalid-budget')
  })

  it('rejects missing dependencies, cycles, excess fan-out, and step budgets', async () => {
    const plan = validMixedPlan()
    expect(await failureReason(decodeResearchPlan({
      ...plan,
      nodes: plan.nodes.map((node, index) => index === 1
        ? { ...node, dependencies: [id('446655449999')] }
        : node),
    }))).toBe('missing-dependency')
    expect(await failureReason(decodeResearchPlan({
      ...plan,
      nodes: plan.nodes.map((node, index) => index === 0
        ? { ...node, dependencies: [ids.evaluate] }
        : node),
    }))).toBe('cyclic-dependency')
    expect(await failureReason(decodeResearchPlan({
      ...plan,
      nodes: plan.nodes.map((node, index) => index === 3
        ? {
            ...node,
            dependencies: [ids.root, ids.document, ids.datasetNode],
          }
        : node),
    }))).toBe('fan-out-exceeded')
    expect(await failureReason(decodeResearchPlan({
      ...plan,
      budget: { ...budget(), maximumSteps: 3 },
    }))).toBe('invalid-budget')
  })

  it('rejects duplicate identities and missing input or evidence references', async () => {
    const plan = validMixedPlan()
    expect(await failureReason(decodeResearchPlan({
      ...plan,
      nodes: plan.nodes.map((node, index) => index === 1
        ? { ...node, id: ids.root }
        : node),
    }))).toBe('invalid-identity')
    expect(await failureReason(decodeResearchPlan({
      ...plan,
      nodes: plan.nodes.map((node, index) => index === 0
        ? {
            ...node,
            inputRefs: [{
              kind: 'node-output',
              nodeId: id('446655449998'),
            }],
          }
        : node),
    }))).toBe('missing-reference')
    expect(await failureReason(decodeResearchPlan({
      ...plan,
      nodes: plan.nodes.map((node, index) => index === 1
        ? { ...node, dependencies: [] }
        : node),
    }))).toBe('missing-dependency')
    expect(await failureReason(decodeResearchPlan({
      ...plan,
      nodes: plan.nodes.map((node, index) => index === 0
        ? { ...node, evidenceRefs: [id('446655449997')] }
        : node),
    }))).toBe('missing-reference')
  })
})
