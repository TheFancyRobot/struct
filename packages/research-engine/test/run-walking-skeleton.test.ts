import { describe, expect, it } from 'vitest'
import { Effect, Exit } from 'effect'
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
})
