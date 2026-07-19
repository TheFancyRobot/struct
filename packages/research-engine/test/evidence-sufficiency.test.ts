import { describe, expect, it } from 'bun:test'
import {
  DocumentChunkId,
  DocumentId,
  SourceVersionId,
} from '@struct/domain'
import type { DocumentResearchContext } from '@struct/retrieval'
import { Effect, Exit } from 'effect'
import {
  requireSufficientEvidence,
  type EvidenceAssessment,
  validateDocumentAnswerCitations,
} from '../src/evidence-sufficiency'

const sourceVersionId = SourceVersionId.make(
  'a60e8400-e29b-41d4-a716-446655440000',
)
const otherSourceVersionId = SourceVersionId.make(
  'a60e8400-e29b-41d4-a716-446655440001',
)
const citation = {
  sourceVersionId,
  locator: 'document:paragraph:1,chars:0-12,bytes:0-12',
}
const context: DocumentResearchContext = {
  evidence: [{
    chunkId: DocumentChunkId.make('a60e8400-e29b-41d4-a716-446655440002'),
    documentId: DocumentId.make('a60e8400-e29b-41d4-a716-446655440003'),
    sourceVersionId,
    chunkingVersion: 'fragments-v1',
    ordinal: 0,
    locator: {
      page: null,
      section: null,
      paragraph: 1,
      charStart: 0,
      charEnd: 12,
      byteStart: 0,
      byteEnd: 12,
    },
    citationLocator: citation.locator,
    excerpt: 'Launch is 18.',
    trust: 'untrusted-evidence' as const,
    keywordRank: 1,
    vectorRank: 1,
    keywordScore: 0.9,
    vectorScore: 0.9,
    fusionScore: 0.03,
  }],
}

function assessment(
  patch: Partial<EvidenceAssessment> = {},
): EvidenceAssessment {
  return {
    status: 'sufficient',
    summary: 'The date is directly supported.',
    citedEvidence: [citation],
    limitations: [],
    contradictions: [],
    ...patch,
  }
}

describe('evidence sufficiency gate', () => {
  it('accepts sufficient evidence with exact retrieved citations', async () => {
    await expect(
      Effect.runPromise(
        requireSufficientEvidence('When is launch?', context, assessment()),
      ),
    ).resolves.toMatchObject({ status: 'sufficient' })
  })

  it('rejects insufficient evidence before synthesis', async () => {
    const exit = await Effect.runPromiseExit(
      requireSufficientEvidence(
        'When is launch?',
        context,
        assessment({ status: 'insufficient', citedEvidence: [] }),
      ),
    )

    expect(Exit.isFailure(exit)).toBe(true)
    expect(exit.toString()).toContain('EvidenceInsufficientError')
  })

  it('surfaces contradictions instead of synthesizing through them', async () => {
    const exit = await Effect.runPromiseExit(
      requireSufficientEvidence(
        'When is launch?',
        {
          evidence: [
            ...context.evidence,
            {
              ...context.evidence[0]!,
              chunkId: DocumentChunkId.make(
                'a60e8400-e29b-41d4-a716-446655440004',
              ),
              sourceVersionId: otherSourceVersionId,
              citationLocator: 'document:paragraph:2,chars:13-26,bytes:13-26',
              excerpt: 'Launch is 19.',
            },
          ],
        },
        assessment({
          status: 'contradictory',
          contradictions: [{
            summary: 'Two dates are reported.',
            citations: [
              citation,
              {
                sourceVersionId: otherSourceVersionId,
                locator: 'document:paragraph:2,chars:13-26,bytes:13-26',
              },
            ],
          }],
        }),
      ),
    )

    expect(Exit.isFailure(exit)).toBe(true)
    expect(exit.toString()).toContain('EvidenceContradictionError')
  })

  it('rejects a contradiction label that does not surface its conflicts', async () => {
    const exit = await Effect.runPromiseExit(
      requireSufficientEvidence(
        'When is launch?',
        context,
        assessment({
          status: 'contradictory',
          citedEvidence: [],
          contradictions: [],
        }),
      ),
    )

    expect(Exit.isFailure(exit)).toBe(true)
    expect(exit.toString()).toContain('ResearchWorkflowError')
  })

  it('rejects assessment citations outside the retrieved immutable scope', async () => {
    const exit = await Effect.runPromiseExit(
      requireSufficientEvidence(
        'When is launch?',
        context,
        assessment({
          citedEvidence: [{
            sourceVersionId,
            locator: 'document:paragraph:99,chars:0-1,bytes:0-1',
          }],
        }),
      ),
    )

    expect(Exit.isFailure(exit)).toBe(true)
    expect(exit.toString()).toContain('ResearchWorkflowError')
  })

  it('rejects invented final-answer citations', async () => {
    const exit = await Effect.runPromiseExit(
      validateDocumentAnswerCitations({
        answer: 'Launch is 18.',
        citations: [{
          sourceVersionId,
          locator: 'document:paragraph:9,chars:0-1,bytes:0-1',
        }],
      }, context, assessment()),
    )

    expect(Exit.isFailure(exit)).toBe(true)
    expect(exit.toString()).toContain('ResearchCitationValidationError')
  })

  it('rejects retrieved evidence that the sufficiency assessment did not approve', async () => {
    const unapprovedCitation = {
      sourceVersionId,
      locator: 'document:paragraph:2,chars:13-26,bytes:13-26',
    }
    const exit = await Effect.runPromiseExit(
      validateDocumentAnswerCitations(
        {
          answer: 'Launch is 19.',
          citations: [unapprovedCitation],
        },
        {
          evidence: [
            ...context.evidence,
            {
              ...context.evidence[0]!,
              chunkId: DocumentChunkId.make(
                'a60e8400-e29b-41d4-a716-446655440005',
              ),
              ordinal: 1,
              citationLocator: unapprovedCitation.locator,
              excerpt: 'Launch is 19.',
            },
          ],
        },
        assessment({ citedEvidence: [citation] }),
      ),
    )

    expect(Exit.isFailure(exit)).toBe(true)
    expect(exit.toString()).toContain('ResearchCitationValidationError')
  })
})
