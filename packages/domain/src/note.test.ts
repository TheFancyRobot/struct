import { describe, expect, it } from 'bun:test'
import { Schema } from 'effect'
import { CreateNoteRequest, normalizeNoteText } from './note'

const ids = {
  thread: '550e8400-e29b-41d4-a716-446655440001',
  run: '550e8400-e29b-41d4-a716-446655440002',
  citation: '550e8400-e29b-41d4-a716-446655440003',
  version: '550e8400-e29b-41d4-a716-446655440004',
}

describe('Note', () => {
  it('normalizes bounded user text and rejects unsafe controls', () => {
    const input = Schema.decodeUnknownSync(CreateNoteRequest)({
      title: normalizeNoteText('  Re\u0301sume\u0301  '),
      body: normalizeNoteText('  Supported answer  '),
      origin: {
        threadId: ids.thread,
        runId: ids.run,
        citations: [{
          kind: 'document',
          id: ids.citation,
          sourceVersionId: ids.version,
          locator: 'line:1',
        }],
      },
    })

    expect(input.title).toBe('Résumé')
    expect(() => Schema.decodeUnknownSync(CreateNoteRequest)({
      ...input,
      body: 'unsafe\u0000text',
    })).toThrow()
  })
})
