import { describe, expect, it } from 'bun:test'
import {
  ResearchContractValidationError,
  ResearchPlan,
} from '@struct/domain'
import { Effect, Either, Schema } from 'effect'
import {
  ResearchPlanningInput,
  validateResearchPlan,
} from '../src/index.js'

const uuid = (suffix: string) => `820e8400-e29b-41d4-a716-${suffix}`
const ids = {
  workspace: uuid('446655440000'),
  project: uuid('446655440001'),
  run: uuid('446655440002'),
  plan: uuid('446655440003'),
  documentVersion: uuid('446655440004'),
  datasetVersion: uuid('446655440005'),
  dataset: uuid('446655440006'),
  snapshot: uuid('446655440007'),
  documentEvidence: uuid('446655440008'),
  datasetEvidence: uuid('446655440009'),
  documentNode: uuid('446655440010'),
  datasetNode: uuid('446655440011'),
  synthesisNode: uuid('446655440012'),
  extraNodeOne: uuid('446655440013'),
  extraNodeTwo: uuid('446655440014'),
  additionalDocumentVersion: uuid('446655440015'),
  additionalDatasetVersion: uuid('446655440016'),
}

const sourceScopes = [
  { kind: 'document', sourceVersionId: ids.documentVersion },
  {
    kind: 'dataset',
    datasetId: ids.dataset,
    datasetSnapshotId: ids.snapshot,
    sourceVersionIds: [ids.datasetVersion],
  },
] as const

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
      toolId: 'citation-validation',
      capability: 'citation:validate',
      maximumCalls: 1,
    },
  ],
} as const

const budgetCeiling = {
  maximumSteps: 8,
  maximumModelCalls: 3,
  maximumToolCalls: 3,
  maximumTokens: 40_000,
  maximumElapsedMilliseconds: 120_000,
  maximumEstimatedCostMicros: 800_000,
  maximumFanOut: 2,
  maximumRevisions: 1,
} as const

function planningInput() {
  return Schema.decodeUnknownSync(ResearchPlanningInput)({
    planId: ids.plan,
    runId: ids.run,
    workspaceId: ids.workspace,
    projectId: ids.project,
    question: 'Compare the policy with the exact dataset total.',
    classification: {
      version: '1',
      kind: 'mixed',
      mode: 'quick',
      requiresExactComputation: false,
      confidence: 0.95,
    },
    sourceScopes,
    toolPolicy,
    budgetCeiling,
  })
}

function mixedPlan() {
  return {
    version: '1',
    id: ids.plan,
    runId: ids.run,
    workspaceId: ids.workspace,
    projectId: ids.project,
    objective: planningInput().question,
    sourceScopes: [...sourceScopes],
    nodes: [
      {
        id: ids.documentNode,
        kind: 'document-retrieval',
        goal: 'Retrieve policy evidence.',
        dependencies: [],
        inputRefs: [{
          kind: 'source-version',
          sourceVersionId: ids.documentVersion,
        }],
        evidenceRefs: [ids.documentEvidence],
      },
      {
        id: ids.datasetNode,
        kind: 'dataset-query',
        goal: 'Compute the exact total.',
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
        id: ids.synthesisNode,
        kind: 'answer-synthesis',
        goal: 'Synthesize the supported comparison.',
        dependencies: [ids.datasetNode, ids.documentNode],
        inputRefs: [
          { kind: 'node-output', nodeId: ids.datasetNode },
          { kind: 'node-output', nodeId: ids.documentNode },
        ],
        evidenceRefs: [ids.datasetEvidence, ids.documentEvidence],
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
      grants: [toolPolicy.grants[1], toolPolicy.grants[0]],
    },
    budget: {
      ...budgetCeiling,
      maximumSteps: 3,
      maximumModelCalls: 1,
      maximumToolCalls: 2,
    },
  }
}

async function reason(
  proposal: unknown,
  input: ReturnType<typeof planningInput> = planningInput(),
): Promise<string | undefined> {
  const result = await Effect.runPromise(
    Effect.either(validateResearchPlan(input, proposal)),
  )
  return Either.isLeft(result) ? result.left.reason : undefined
}

describe('deterministic research-plan validation', () => {
  it('accepts and canonically normalizes document, dataset, and mixed plans', async () => {
    const mixed = mixedPlan()
    const document = {
      ...mixed,
      sourceScopes: [sourceScopes[0]],
      nodes: [mixed.nodes[0]],
      evidenceRequirements: [mixed.evidenceRequirements[0]],
      toolPolicy: { grants: [toolPolicy.grants[0]] },
      budget: {
        ...mixed.budget,
        maximumSteps: 1,
        maximumModelCalls: 0,
        maximumToolCalls: 1,
      },
    }
    const dataset = {
      ...mixed,
      sourceScopes: [sourceScopes[1]],
      nodes: [mixed.nodes[1]],
      evidenceRequirements: [mixed.evidenceRequirements[1]],
      toolPolicy: { grants: [toolPolicy.grants[1]] },
      budget: {
        ...mixed.budget,
        maximumSteps: 1,
        maximumModelCalls: 0,
        maximumToolCalls: 1,
      },
    }

    for (const proposal of [document, dataset, mixed]) {
      const normalized = await Effect.runPromise(
        validateResearchPlan(planningInput(), proposal),
      )
      expect(Schema.is(ResearchPlan)(normalized)).toBe(true)
    }

    const normalized = await Effect.runPromise(
      validateResearchPlan(planningInput(), mixed),
    )
    expect(normalized.toolPolicy.grants.map((grant) => grant.toolId)).toEqual([
      'dataset-query',
      'hybrid-retrieval',
    ])
    expect(normalized.nodes.map((node) => node.id)).toEqual(
      [...normalized.nodes.map((node) => node.id)].sort(),
    )
  })

  it('normalizes nested source-version sets independently of model order', async () => {
    const input = planningInput()
    const extraDocumentScope = {
      kind: 'document' as const,
      sourceVersionId: ids.additionalDocumentVersion,
    }
    const expandedDatasetScope = {
      ...sourceScopes[1],
      sourceVersionIds: [
        ids.datasetVersion,
        ids.additionalDatasetVersion,
      ],
    }
    const expandedInput = Schema.decodeUnknownSync(ResearchPlanningInput)({
      ...input,
      sourceScopes: [
        sourceScopes[0],
        extraDocumentScope,
        expandedDatasetScope,
      ],
    })
    const proposal = mixedPlan()
    const expandedProposal = {
      ...proposal,
      sourceScopes: [
        sourceScopes[0],
        extraDocumentScope,
        expandedDatasetScope,
      ],
      evidenceRequirements: proposal.evidenceRequirements.map(
        (requirement) => requirement.kind === 'document'
          ? {
              ...requirement,
              sourceVersionIds: [
                ids.documentVersion,
                ids.additionalDocumentVersion,
              ],
            }
          : requirement,
      ),
    }
    const reversedProposal = {
      ...expandedProposal,
      sourceScopes: [...expandedProposal.sourceScopes]
        .reverse()
        .map((scope) => scope.kind === 'dataset'
          ? { ...scope, sourceVersionIds: [...scope.sourceVersionIds].reverse() }
          : scope),
      evidenceRequirements: [...expandedProposal.evidenceRequirements]
        .reverse()
        .map((requirement) => requirement.kind === 'document'
          ? {
              ...requirement,
              sourceVersionIds: [
                ...(requirement.sourceVersionIds ?? []),
              ].reverse(),
            }
          : requirement),
    }

    const [first, second] = await Effect.runPromise(
      Effect.all([
        validateResearchPlan(expandedInput, expandedProposal),
        validateResearchPlan(expandedInput, reversedProposal),
      ]),
    )
    expect(first).toEqual(second)
  })

  it('allows a dataset scope to narrow its authorized source-version set', async () => {
    const input = Schema.decodeUnknownSync(ResearchPlanningInput)({
      ...planningInput(),
      sourceScopes: [
        sourceScopes[0],
        {
          ...sourceScopes[1],
          sourceVersionIds: [
            ids.datasetVersion,
            ids.additionalDatasetVersion,
          ],
        },
      ],
    })
    const normalized = await Effect.runPromise(
      validateResearchPlan(input, mixedPlan()),
    )
    const datasetScope = normalized.sourceScopes.find(
      (scope) => scope.kind === 'dataset',
    )
    expect(datasetScope?.sourceVersionIds.map(String)).toEqual([
      ids.datasetVersion,
    ])

    const widened = {
      ...mixedPlan(),
      sourceScopes: [
        sourceScopes[0],
        {
          ...sourceScopes[1],
          sourceVersionIds: [ids.additionalDatasetVersion],
        },
      ],
    }
    expect(await reason(widened)).toBe('missing-reference')
  })

  it('enforces exact-computation classification before returning a plan', async () => {
    const exactInput = Schema.decodeUnknownSync(ResearchPlanningInput)({
      ...planningInput(),
      classification: {
        version: '1',
        kind: 'mixed',
        mode: 'quick',
        requiresExactComputation: true,
        confidence: 0.99,
      },
    })
    expect(await reason(mixedPlan(), exactInput)).toBeUndefined()

    const plan = mixedPlan()
    const documentOnly = {
      ...plan,
      sourceScopes: [sourceScopes[0]],
      nodes: [plan.nodes[0]],
      evidenceRequirements: [plan.evidenceRequirements[0]],
      toolPolicy: { grants: [toolPolicy.grants[0]] },
      budget: {
        ...plan.budget,
        maximumSteps: 1,
        maximumModelCalls: 0,
        maximumToolCalls: 1,
      },
    }
    expect(await reason(documentOnly, exactInput)).toBe('missing-reference')

    const withoutDatasetQuery = {
      ...documentOnly,
      sourceScopes: [...sourceScopes],
    }
    expect(await reason(withoutDatasetQuery, exactInput)).toBe(
      'unsupported-tool',
    )

    const disconnectedDatasetQuery = {
      ...plan,
      nodes: plan.nodes.map((node) =>
        node.id === ids.synthesisNode
          ? {
              ...node,
              dependencies: [ids.documentNode],
              inputRefs: [{
                kind: 'node-output',
                nodeId: ids.documentNode,
              }],
            }
          : node),
    }
    expect(await reason(disconnectedDatasetQuery, exactInput)).toBe(
      'unsupported-tool',
    )
  })

  it('rejects unknown or incompatible tools and capabilities', async () => {
    const plan = mixedPlan()
    expect(await reason({
      ...plan,
      toolPolicy: {
        grants: [{ ...plan.toolPolicy.grants[0], toolId: 'shell' }],
      },
    })).toBe('unsupported-tool')
    expect(await reason({
      ...plan,
      toolPolicy: {
        grants: [{
          ...plan.toolPolicy.grants[0],
          capability: 'filesystem:read',
        }],
      },
    })).toBe('unsupported-capability')
    expect(await reason({
      ...plan,
      toolPolicy: {
        grants: [{
          toolId: 'dataset-query',
          capability: 'document:retrieve',
          maximumCalls: 1,
        }],
      },
    })).toBe('unsupported-capability')
  })

  it('rejects missing dependencies, cycles, and excess fan-out', async () => {
    const plan = mixedPlan()
    expect(await reason({
      ...plan,
      nodes: plan.nodes.map((node, index) => index === 2
        ? { ...node, dependencies: [uuid('446655449999')] }
        : node),
    })).toBe('missing-dependency')
    expect(await reason({
      ...plan,
      nodes: plan.nodes.map((node, index) => index === 0
        ? {
            ...node,
            dependencies: [ids.synthesisNode],
            inputRefs: [
              ...node.inputRefs,
              { kind: 'node-output', nodeId: ids.synthesisNode },
            ],
          }
        : node),
    })).toBe('cyclic-dependency')
    expect(await reason({
      ...plan,
      nodes: [
        plan.nodes[0],
        ...[
          [ids.datasetNode, ids.datasetEvidence],
          [ids.extraNodeOne, ids.documentEvidence],
          [ids.extraNodeTwo, ids.documentEvidence],
        ].map(([nodeId, evidenceId]) => ({
          id: nodeId,
          kind: 'answer-synthesis',
          goal: 'Use the retrieved evidence.',
          dependencies: [ids.documentNode],
          inputRefs: [{ kind: 'node-output', nodeId: ids.documentNode }],
          evidenceRefs: [evidenceId],
        })),
      ],
      budget: {
        ...plan.budget,
        maximumSteps: 4,
        maximumModelCalls: 3,
      },
    })).toBe('fan-out-exceeded')
  })

  it('rejects widened source scope and references outside declared scope', async () => {
    const plan = mixedPlan()
    expect(await reason({
      ...plan,
      sourceScopes: [
        ...plan.sourceScopes,
        { kind: 'document', sourceVersionId: uuid('446655449998') },
      ],
    })).toBe('missing-reference')
    expect(await reason({
      ...plan,
      sourceScopes: [sourceScopes[0]],
    })).toBe('missing-reference')
  })

  it('requires compatible authorized direct inputs for each tool node', async () => {
    const plan = mixedPlan()
    const replaceInputs = (
      nodeId: string,
      inputRefs: ReadonlyArray<Record<string, string>>,
    ) => ({
      ...plan,
      nodes: plan.nodes.map((node) =>
        node.id === nodeId ? { ...node, inputRefs } : node),
    })

    expect(await reason(replaceInputs(ids.documentNode, [])))
      .toBe('missing-reference')
    expect(await reason(replaceInputs(ids.documentNode, [{
      kind: 'dataset-snapshot',
      datasetId: ids.dataset,
      datasetSnapshotId: ids.snapshot,
    }])))
      .toBe('missing-reference')
    expect(await reason(replaceInputs(ids.datasetNode, [])))
      .toBe('missing-reference')
    expect(await reason(replaceInputs(ids.datasetNode, [{
      kind: 'source-version',
      sourceVersionId: ids.datasetVersion,
    }])))
      .toBe('missing-reference')
    expect(await reason(replaceInputs(ids.synthesisNode, [{
      kind: 'source-version',
      sourceVersionId: uuid('446655449996'),
    }])))
      .toBe('missing-reference')
  })

  it('rejects identity, question, grant, and plan budget expansion', async () => {
    const plan = mixedPlan()
    expect(await reason({ ...plan, id: uuid('446655449997') }))
      .toBe('invalid-identity')
    expect(await reason({ ...plan, objective: 'A different question' }))
      .toBe('malformed')
    expect(await reason({
      ...plan,
      toolPolicy: {
        grants: [{
          ...toolPolicy.grants[0],
          maximumCalls: 2,
        }],
      },
    })).toBe('invalid-budget')
    const lowerStepCeiling = Schema.decodeUnknownSync(ResearchPlanningInput)({
      ...planningInput(),
      budgetCeiling: {
        ...budgetCeiling,
        maximumSteps: 2,
      },
    })
    expect(await reason(plan, lowerStepCeiling)).toBe('invalid-budget')
    expect(await reason({
      ...plan,
      budget: {
        ...plan.budget,
        maximumTokens: budgetCeiling.maximumTokens + 1,
      },
    })).toBe('invalid-budget')
  })

  it('returns only the STEP-05-01 typed failure and never executable raw state', async () => {
    const result = await Effect.runPromise(
      Effect.either(validateResearchPlan(planningInput(), {
        output: mixedPlan(),
        diagnostics: 'untrusted provider envelope',
      })),
    )
    expect(Either.isLeft(result)).toBe(true)
    if (Either.isLeft(result)) {
      expect(result.left).toBeInstanceOf(ResearchContractValidationError)
      expect(result.left.reason).toBe('malformed')
      expect(JSON.stringify(result.left)).not.toContain('diagnostics')
    }
  })
})
