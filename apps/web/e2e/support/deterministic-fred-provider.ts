import { createHash } from 'node:crypto'
import { appendFileSync, mkdirSync } from 'node:fs'
import { dirname, isAbsolute, relative, resolve } from 'node:path'
import * as AiModel from '@effect/ai/Model'
import * as LanguageModel from '@effect/ai/LanguageModel'
import * as Stream from 'effect/Stream'
import { Effect, Layer } from 'effect'

function collectStrings(value: unknown, output: string[] = []): string[] {
  if (typeof value === 'string') {
    output.push(value)
    return output
  }
  if (Array.isArray(value)) {
    for (const item of value) collectStrings(item, output)
    return output
  }
  if (value && typeof value === 'object') {
    for (const item of Object.values(value)) collectStrings(item, output)
  }
  return output
}

const repositoryRoot = resolve(import.meta.dir, '../../../..')
const approvedProviderLogRoot = resolve(
  repositoryRoot,
  '.local/e2e/workspace-release-artifacts',
)

export function promptText(prompt: unknown): string {
  try {
    const json = JSON.stringify(prompt, (_key, value) =>
      typeof value === 'bigint' ? Number(value) : value)
    if (typeof json === 'string') return json
  } catch {
    // Fall back to string extraction below.
  }
  const collected = collectStrings(prompt).join('\n')
  return collected.length > 0 ? collected : String(prompt)
}

function resolveProviderLogPath(logPath: string): string {
  const resolved = resolve(repositoryRoot, logPath)
  const relativePath = relative(approvedProviderLogRoot, resolved)
  if (
    relativePath === ''
    || (!relativePath.startsWith('..') && !isAbsolute(relativePath))
  ) {
    return resolved
  }
  throw new Error(
    'DET_PROVIDER_LOG must stay within .local/e2e/workspace-release-artifacts',
  )
}

function appendDebugLog(objectName: string, text: string, response: unknown): void {
  const configuredPath = process.env['DET_PROVIDER_LOG']
  if (!configuredPath) return
  const logPath = resolveProviderLogPath(configuredPath)
  mkdirSync(dirname(logPath), { recursive: true })
  appendFileSync(logPath, `${objectName}\n${text}\n${JSON.stringify(response)}\n---\n`)
}

function deepFindValue(value: unknown, field: string): unknown {
  if (typeof value === 'string') {
    const trimmed = value.trim()
    if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
      try {
        return deepFindValue(JSON.parse(trimmed), field)
      } catch {
        return undefined
      }
    }
    return undefined
  }
  if (Array.isArray(value)) {
    for (const item of value) {
      const found = deepFindValue(item, field)
      if (found !== undefined) return found
    }
    return undefined
  }
  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>
    if (field in record) return record[field]
    for (const item of Object.values(record)) {
      const found = deepFindValue(item, field)
      if (found !== undefined) return found
    }
  }
  return undefined
}

function deepFind(value: unknown, field: string): string | undefined {
  const found = deepFindValue(value, field)
  return typeof found === 'string' ? found : undefined
}

function questionFrom(prompt: unknown): string {
  return deepFind(prompt, 'question') ?? 'What should we do next?'
}

function firstSourceVersionId(prompt: unknown): string {
  return deepFind(prompt, 'sourceVersionId')
    ?? 'f50e8400-e29b-41d4-a716-446655440003'
}

function firstLocator(prompt: unknown): string {
  return deepFind(prompt, 'locator') ?? 'lines:1-2'
}

function inputId(prompt: unknown, field: string): string {
  const value = deepFind(prompt, field)
  if (!value) throw new Error(`Missing ${field} in deterministic provider input`)
  return value
}

function datasetScopeFrom(prompt: unknown): {
  readonly kind: 'dataset'
  readonly datasetId: string
  readonly datasetSnapshotId: string
  readonly sourceVersionIds: ReadonlyArray<string>
} | undefined {
  const scopes = deepFindValue(prompt, 'sourceScopes')
  if (!Array.isArray(scopes)) return undefined
  const scope = scopes.find((candidate) =>
    candidate !== null
    && typeof candidate === 'object'
    && (candidate as Record<string, unknown>)['kind'] === 'dataset')
  if (scope === undefined) return undefined
  const record = scope as Record<string, unknown>
  const sourceVersionIds = record['sourceVersionIds']
  return typeof record['datasetId'] === 'string'
    && typeof record['datasetSnapshotId'] === 'string'
    && Array.isArray(sourceVersionIds)
    && sourceVersionIds.every((id) => typeof id === 'string')
    ? {
        kind: 'dataset',
        datasetId: record['datasetId'],
        datasetSnapshotId: record['datasetSnapshotId'],
        sourceVersionIds,
      }
    : undefined
}

function datasetCitationsFrom(prompt: unknown): ReadonlyArray<unknown> {
  const results = deepFindValue(prompt, 'datasetResults')
  return Array.isArray(results)
    ? results.flatMap((result) => {
        if (result === null || typeof result !== 'object') return []
        const citations = (result as Record<string, unknown>)['citations']
        return Array.isArray(citations) ? citations : []
      })
    : []
}

function datasetCountFrom(prompt: unknown): string {
  const results = deepFindValue(prompt, 'datasetResults')
  if (!Array.isArray(results)) return 'an exact number of'
  const first = results[0]
  if (first === null || typeof first !== 'object') return 'an exact number of'
  const result = (first as Record<string, unknown>)['result']
  if (result === null || typeof result !== 'object') return 'an exact number of'
  const rows = (result as Record<string, unknown>)['rows']
  const count = Array.isArray(rows) && Array.isArray(rows[0]) ? rows[0][0] : undefined
  return typeof count === 'string' ? count : 'an exact number of'
}

function deterministicUuid(seed: string, label: string): string {
  const hex = createHash('sha256').update(`${seed}:${label}`).digest('hex')
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-a${hex.slice(17, 20)}-${hex.slice(20, 32)}`
}

function answerFor(question: string): string {
  return question.toLowerCase().includes('what should we do next')
    ? 'Contact the account owner.'
    : 'Renewal risk is concentrated in Acme.'
}

function structuredResponse(options: LanguageModel.ProviderOptions): unknown {
  const text = promptText(options.prompt)
  const objectName = options.responseFormat.type === 'json'
    ? options.responseFormat.objectName
    : 'text'
  let response: unknown
  if (options.responseFormat.type !== 'json') {
    response = { text: answerFor(questionFrom(options.prompt)) }
  } else switch (objectName) {
    case 'struct_question-classifier': {
      const dataset = datasetScopeFrom(options.prompt)
      response = dataset === undefined ? {
        version: '1',
        kind: 'document',
        routes: ['document'],
        mode: 'quick',
        requiresExactComputation: false,
        confidence: 1,
      } : {
        version: '1',
        kind: 'dataset',
        routes: ['dataset'],
        mode: 'quick',
        requiresExactComputation: true,
        confidence: 1,
      }
      break
    }
    case 'struct_research-planner': {
      const runId = inputId(options.prompt, 'runId')
      const planId = inputId(options.prompt, 'planId')
      const workspaceId = inputId(options.prompt, 'workspaceId')
      const projectId = inputId(options.prompt, 'projectId')
      const dataset = datasetScopeFrom(options.prompt)
      const sourceVersionId = firstSourceVersionId(options.prompt)
      const question = questionFrom(options.prompt)
      const evidenceNodeId = deterministicUuid(runId, dataset === undefined ? 'retrieve' : 'dataset')
      const critiqueId = deterministicUuid(runId, 'critique')
      const synthesizeId = deterministicUuid(runId, 'synthesize')
      const evidenceId = deterministicUuid(runId, 'evidence')
      if (dataset !== undefined) {
        response = {
          version: '1',
          id: planId,
          runId,
          workspaceId,
          projectId,
          objective: question,
          sourceScopes: [dataset],
          nodes: [
            {
              id: evidenceNodeId,
              kind: 'dataset-query',
              goal: 'Count the selected dataset records exactly.',
              dependencies: [],
              inputRefs: [{
                kind: 'dataset-snapshot',
                datasetId: dataset.datasetId,
                datasetSnapshotId: dataset.datasetSnapshotId,
              }],
              evidenceRefs: [evidenceId],
              toolInput: {
                kind: 'dataset-query',
                operation: 'count',
                snapshot: {
                  alias: 'records',
                  datasetId: dataset.datasetId,
                  datasetSnapshotId: dataset.datasetSnapshotId,
                },
                columns: [],
                rowLimit: 1,
                limits: {
                  maxRows: 1,
                  maxOutputBytes: 100_000,
                  maxMemoryMb: 64,
                  timeoutMs: 1_000,
                },
              },
            },
            {
              id: critiqueId,
              kind: 'evidence-evaluation',
              goal: 'Evaluate whether the exact count answers the question.',
              dependencies: [evidenceNodeId],
              inputRefs: [{ kind: 'node-output', nodeId: evidenceNodeId }],
              evidenceRefs: [],
            },
            {
              id: synthesizeId,
              kind: 'answer-synthesis',
              goal: 'Answer the question from the exact dataset result.',
              dependencies: [critiqueId],
              inputRefs: [{ kind: 'node-output', nodeId: critiqueId }],
              evidenceRefs: [],
            },
          ],
          evidenceRequirements: [{
            id: evidenceId,
            kind: 'dataset',
            datasetId: dataset.datasetId,
            datasetSnapshotId: dataset.datasetSnapshotId,
            minimumCitations: 1,
          }],
          toolPolicy: {
            grants: [{
              toolId: 'dataset-query',
              capability: 'dataset:query',
              maximumCalls: 1,
            }],
          },
          budget: {
            maximumSteps: 3,
            maximumModelCalls: 2,
            maximumToolCalls: 1,
            maximumTokens: 4096,
            maximumElapsedMilliseconds: 15000,
            maximumEstimatedCostMicros: 1000,
            maximumFanOut: 1,
            maximumRevisions: 0,
          },
        }
        break
      }
      const retrievalGoal = question.toLowerCase().includes('what should we do next')
        ? 'Contact the account owner.'
        : question
      response = {
        version: '1',
        id: planId,
        runId,
        workspaceId,
        projectId,
        objective: question,
        sourceScopes: [{ kind: 'document', sourceVersionId }],
        nodes: [
          {
            id: evidenceNodeId,
            kind: 'document-retrieval',
            goal: retrievalGoal,
            dependencies: [],
            inputRefs: [{ kind: 'source-version', sourceVersionId }],
            evidenceRefs: [evidenceId],
          },
          {
            id: critiqueId,
            kind: 'evidence-evaluation',
            goal: 'Evaluate whether the retrieved evidence supports the question.',
            dependencies: [evidenceNodeId],
            inputRefs: [{ kind: 'node-output', nodeId: evidenceNodeId }],
            evidenceRefs: [],
          },
          {
            id: synthesizeId,
            kind: 'answer-synthesis',
            goal: 'Answer the question from the retrieved evidence.',
            dependencies: [critiqueId],
            inputRefs: [{ kind: 'node-output', nodeId: critiqueId }],
            evidenceRefs: [],
          },
        ],
        evidenceRequirements: [{
          id: evidenceId,
          kind: 'document',
          sourceVersionIds: [sourceVersionId],
          minimumCitations: 1,
        }],
        toolPolicy: {
          grants: [{
            toolId: 'hybrid-retrieval',
            capability: 'document:retrieve',
            maximumCalls: 1,
          }],
        },
        budget: {
          maximumSteps: 3,
          maximumModelCalls: 2,
          maximumToolCalls: 1,
          maximumTokens: 4096,
          maximumElapsedMilliseconds: 15000,
          maximumEstimatedCostMicros: 1000,
          maximumFanOut: 1,
          maximumRevisions: 0,
        },
      }
      break
    }
    case 'struct_research-run_critic':
      response = {
        sufficient: true,
        progressFingerprint: `ready:${questionFrom(options.prompt)}`,
      }
      break
    case 'struct_research-run_synthesizer': {
      const question = questionFrom(options.prompt)
      const datasetCitations = datasetCitationsFrom(options.prompt)
      response = {
        answer: datasetCitations.length > 0
          ? `The dataset contains ${datasetCountFrom(options.prompt)} records.`
          : answerFor(question),
        citations: datasetCitations.length > 0 ? [] : [{
          sourceVersionId: firstSourceVersionId(options.prompt),
          locator: firstLocator(options.prompt),
        }],
        datasetCitations,
      }
      break
    }
    default:
      response = { text: answerFor(questionFrom(options.prompt)) }
  }
  appendDebugLog(objectName, text, response)
  return response
}

function responseText(options: LanguageModel.ProviderOptions): string {
  const response = structuredResponse(options)
  return typeof response === 'string' ? response : JSON.stringify(response)
}

function createDeterministicModel(modelId: string) {
  return AiModel.make(modelId, Layer.effect(
    LanguageModel.LanguageModel,
    LanguageModel.make({
      generateText: (options) => Effect.succeed([
        { type: 'text', text: responseText(options) },
      ]),
      streamText: (options) => {
        const text = responseText(options)
        const id = deterministicUuid(modelId, text)
        return Stream.fromIterable([
          { type: 'text-start', id },
          { type: 'text-delta', id, delta: text },
          { type: 'text-end', id },
          {
            type: 'finish',
            reason: 'stop',
            usage: { inputTokens: 0, outputTokens: 0, totalTokens: 0 },
          },
        ])
      },
    }),
  ))
}

export default {
  id: 'deterministic-e2e',
  load: async () => ({
    layer: Layer.empty,
    getModel: (modelId: string) => Effect.succeed(createDeterministicModel(modelId)),
  }),
}
