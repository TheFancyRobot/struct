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

function deepFind(value: unknown, field: string): string | undefined {
  if (typeof value === 'string') {
    const trimmed = value.trim()
    if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
      try {
        return deepFind(JSON.parse(trimmed), field)
      } catch {
        return undefined
      }
    }
    return undefined
  }
  if (Array.isArray(value)) {
    for (const item of value) {
      const found = deepFind(item, field)
      if (found) return found
    }
    return undefined
  }
  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>
    const direct = record[field]
    if (typeof direct === 'string') return direct
    for (const item of Object.values(record)) {
      const found = deepFind(item, field)
      if (found) return found
    }
  }
  return undefined
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
    case 'struct_question-classifier':
      response = {
        version: '1',
        kind: 'document',
        routes: ['document'],
        mode: 'quick',
        requiresExactComputation: false,
        confidence: 1,
      }
      break
    case 'struct_research-planner': {
      const runId = inputId(options.prompt, 'runId')
      const planId = inputId(options.prompt, 'planId')
      const workspaceId = inputId(options.prompt, 'workspaceId')
      const projectId = inputId(options.prompt, 'projectId')
      const sourceVersionId = firstSourceVersionId(options.prompt)
      const question = questionFrom(options.prompt)
      const retrieveId = deterministicUuid(runId, 'retrieve')
      const critiqueId = deterministicUuid(runId, 'critique')
      const synthesizeId = deterministicUuid(runId, 'synthesize')
      const evidenceId = deterministicUuid(runId, 'evidence')
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
            id: retrieveId,
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
            dependencies: [retrieveId],
            inputRefs: [{ kind: 'node-output', nodeId: retrieveId }],
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
      response = {
        answer: answerFor(question),
        citations: [{
          sourceVersionId: firstSourceVersionId(options.prompt),
          locator: firstLocator(options.prompt),
        }],
        datasetCitations: [],
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
