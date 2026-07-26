import { afterEach, describe, expect, it } from 'bun:test'
import { existsSync, mkdirSync, readFileSync, rmSync } from 'node:fs'
import { resolve } from 'node:path'
import * as LanguageModel from '@effect/ai/LanguageModel'
import {
  ProjectId,
  ResearchAnswer,
  ResearchPlan,
  ResearchPlanId,
  ResearchRunId,
  SourceVersionId,
  WorkspaceId,
} from '@struct/domain'
import { Effect, Stream } from 'effect'
import deterministicFredProvider, { promptText } from './deterministic-fred-provider'

const artifactRoot = resolve(
  import.meta.dir,
  '../../../../.local/e2e/workspace-release-artifacts',
)
const cleanupPaths = new Set<string>()
const plannerPrompt = {
  planId: ResearchPlanId.make('f50e8400-e29b-41d4-a716-446655440001'),
  runId: ResearchRunId.make('f50e8400-e29b-41d4-a716-446655440002'),
  workspaceId: WorkspaceId.make('f50e8400-e29b-41d4-a716-446655440010'),
  projectId: ProjectId.make('f50e8400-e29b-41d4-a716-446655440011'),
  question: 'Where is renewal risk?',
  sourceVersionId: SourceVersionId.make('f50e8400-e29b-41d4-a716-446655440003'),
} as const
const synthesizerPrompt = {
  question: 'What should we do next?',
  sourceVersionId: plannerPrompt.sourceVersionId,
} as const

async function loadModel() {
  const { getModel } = await deterministicFredProvider.load()
  return Effect.runPromise(getModel('deterministic-e2e:test'))
}

afterEach(() => {
  delete process.env['DET_PROVIDER_LOG']
  for (const path of cleanupPaths) {
    rmSync(path, { force: true, recursive: true })
  }
  cleanupPaths.clear()
})

describe('deterministic Fred provider', () => {
  it('uses the requested model id and streams well-formed text parts', async () => {
    const model = await loadModel()

    expect(model.provider).toBe('deterministic-e2e:test')

    const parts = Array.from(await Effect.runPromise(
      Stream.runCollect(LanguageModel.streamText({
        prompt: 'What should we do next?',
      })).pipe(Effect.provide(model)),
    ))
    const textDelta = parts.find((part) => part.type === 'text-delta')
    const finish = parts.find((part) => part.type === 'finish')

    expect(parts.map((part) => part.type)).toEqual([
      'text-start',
      'text-delta',
      'text-end',
      'finish',
    ])
    expect(textDelta).toMatchObject({
      type: 'text-delta',
      id: expect.any(String),
    })
    expect(textDelta?.delta).toContain('Contact the account owner.')
    expect(finish).toMatchObject({
      type: 'finish',
      reason: 'stop',
      usage: { inputTokens: 0, outputTokens: 0, totalTokens: 0 },
    })
  })

  it('always returns a string summary for prompt logging', () => {
    expect(promptText(undefined)).toBe('undefined')
    expect(promptText(Symbol('deterministic'))).toBe('Symbol(deterministic)')
  })

  it('covers the planner and synthesizer json branches', async () => {
    const model = await loadModel()
    const planner = await Effect.runPromise(LanguageModel.generateObject({
      prompt: JSON.stringify(plannerPrompt),
      schema: ResearchPlan,
      objectName: 'struct_research-planner',
    }).pipe(Effect.provide(model)))
    const synthesizer = await Effect.runPromise(LanguageModel.generateObject({
      prompt: JSON.stringify(synthesizerPrompt),
      schema: ResearchAnswer,
      objectName: 'struct_research-run_synthesizer',
    }).pipe(Effect.provide(model)))

    expect(planner.value.id).toBe(plannerPrompt.planId)
    expect(planner.value.runId).toBe(plannerPrompt.runId)
    expect(planner.value.nodes).toHaveLength(3)
    expect(synthesizer.value).toMatchObject({
      answer: 'Contact the account owner.',
      citations: [{
        sourceVersionId: plannerPrompt.sourceVersionId,
        locator: 'lines:1-2',
      }],
      datasetCitations: [],
    })
  })

  it('rejects planner prompts that omit required ids', async () => {
    const model = await loadModel()

    await expect(Effect.runPromise(LanguageModel.generateObject({
      prompt: JSON.stringify({
        runId: plannerPrompt.runId,
        workspaceId: plannerPrompt.workspaceId,
        projectId: plannerPrompt.projectId,
        question: plannerPrompt.question,
      }),
      schema: ResearchPlan,
      objectName: 'struct_research-planner',
    }).pipe(Effect.provide(model)))).rejects.toThrow(
      'Missing planId in deterministic provider input',
    )
  })

  it('only writes debug logs inside the approved artifact root', async () => {
    const model = await loadModel()
    mkdirSync(artifactRoot, { recursive: true })

    const allowedLog = resolve(artifactRoot, 'deterministic-provider.log')
    cleanupPaths.add(allowedLog)
    process.env['DET_PROVIDER_LOG'] = allowedLog
    await Effect.runPromise(LanguageModel.generateObject({
      prompt: JSON.stringify(synthesizerPrompt),
      schema: ResearchAnswer,
      objectName: 'struct_research-run_synthesizer',
    }).pipe(Effect.provide(model)))

    expect(existsSync(allowedLog)).toBe(true)
    expect(readFileSync(allowedLog, 'utf8')).toContain('struct_research-run_synthesizer')

    const escapedLog = resolve(import.meta.dir, 'deterministic-provider.log')
    cleanupPaths.add(escapedLog)
    process.env['DET_PROVIDER_LOG'] = escapedLog

    await expect(Effect.runPromise(LanguageModel.generateText({
      prompt: 'Where is renewal risk?',
    }).pipe(Effect.provide(model)))).rejects.toThrow(
      'DET_PROVIDER_LOG must stay within .local/e2e/workspace-release-artifacts',
    )
    expect(existsSync(escapedLog)).toBe(false)
  })
})
