import { describe, expect, it } from 'bun:test'
import { Cause, Effect, Exit } from 'effect'
import { classifyTextSource, UnsupportedSourceTypeError } from './file-classifier'

describe('classifyTextSource', () => {
  it('accepts only plain text and markdown files for the walking slice', async () => {
    await expect(Effect.runPromise(classifyTextSource({ name: 'notes.txt', mediaType: 'text/plain', byteLength: 10 }))).resolves.toEqual({ extension: '.txt', mediaType: 'text/plain', kind: 'document' })
    await expect(Effect.runPromise(classifyTextSource({ name: 'README.md', mediaType: 'text/markdown', byteLength: 10 }))).resolves.toEqual({ extension: '.md', mediaType: 'text/markdown', kind: 'document' })
  })

  it('rejects unsupported extensions and media types with sanitized typed errors', async () => {
    const result = await Effect.runPromiseExit(classifyTextSource({ name: 'malware.exe', mediaType: 'application/octet-stream', byteLength: 10 }))

    expect(Exit.isFailure(result)).toBe(true)
    if (Exit.isFailure(result)) {
      const failure = Cause.failureOption(result.cause)
      expect(failure._tag).toBe('Some')
      if (failure._tag === 'Some') {
        expect(String(failure.value._tag)).toBe(UnsupportedSourceTypeError.name)
        expect(failure.value.message).not.toContain('/Users/')
        expect(failure.value.message).not.toContain('DATABASE_URL')
      }
    }
  })

  it('rejects byte lengths above the configured cap before enqueueing work', async () => {
    const result = await Effect.runPromiseExit(classifyTextSource({ name: 'large.txt', mediaType: 'text/plain', byteLength: 11, maxBytes: 10 }))

    expect(Exit.isFailure(result)).toBe(true)
    if (Exit.isFailure(result)) {
      const failure = Cause.failureOption(result.cause)
      expect(failure._tag).toBe('Some')
      if (failure._tag === 'Some') {
        expect(failure.value._tag).toBe('SourceTooLargeError')
      }
    }
  })
})
