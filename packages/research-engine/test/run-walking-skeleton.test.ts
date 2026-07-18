import { describe, expect, it } from 'vitest'
import { Cause, Effect, Exit, Option } from 'effect'
import {
  ResearchAnswer,
  SourceVersionId,
  type TextEvidence,
} from '@struct/domain'
import {
  requireEvidence,
  validateAnswerCitations,
} from '../src/run-walking-skeleton'

const sourceVersionId = SourceVersionId.make('b50e8400-e29b-41d4-a716-446655440002')
const evidence: typeof TextEvidence.Type = {
  sourceVersionId,
  locator: 'lines:2-3',
  excerpt: 'The launch date is July 18.',
  rank: 1,
}

describe('walking-skeleton research gates', () => {
  it('accepts only citations that exactly match retrieved immutable evidence', async () => {
    const answer: typeof ResearchAnswer.Type = {
      answer: 'The launch date is July 18.',
      citations: [{ sourceVersionId, locator: 'lines:2-3' }],
    }

    await expect(
      Effect.runPromise(validateAnswerCitations(answer, [evidence])),
    ).resolves.toEqual(answer)
  })

  it('fails closed for missing evidence and invented locators', async () => {
    const noEvidence = await Effect.runPromiseExit(requireEvidence('when?', []))
    const invalidCitation = await Effect.runPromiseExit(
      validateAnswerCitations(
        {
          answer: 'The launch date is July 18.',
          citations: [{ sourceVersionId, locator: 'lines:99-100' }],
        },
        [evidence],
      ),
    )

    expect(Exit.isFailure(noEvidence)).toBe(true)
    expect(Exit.isFailure(invalidCitation)).toBe(true)
  })

  it('returns EvidenceInsufficientError when an uncited answer has no evidence', async () => {
    const result = await Effect.runPromiseExit(
      validateAnswerCitations(
        { answer: 'Unsupported answer', citations: [] },
        [],
        'What is supported?',
      ),
    )

    expect(Exit.isFailure(result)).toBe(true)
    if (Exit.isFailure(result)) {
      expect(result.cause.toString()).toContain('EvidenceInsufficientError')
      const failure = Option.getOrUndefined(Cause.failureOption(result.cause))
      expect(failure).toMatchObject({
        _tag: 'EvidenceInsufficientError',
        question: 'What is supported?',
      })
    }
  })
})
