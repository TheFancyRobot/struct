import { describe, expect, it } from 'bun:test'
import { Effect, Exit } from 'effect'
import { EventJournalId, JobQueueId, ProjectId, SourceId, WorkspaceId } from '@struct/domain'
import { registerTextSource, ValidationError } from './sources'
import type { RegisterTextSourceDeps } from './sources'

const workspaceId = WorkspaceId.make('750e8400-e29b-41d4-a716-446655440000')
const projectId = ProjectId.make('750e8400-e29b-41d4-a716-446655440001')
const sourceId = SourceId.make('750e8400-e29b-41d4-a716-446655440002')
const jobId = JobQueueId.make('750e8400-e29b-41d4-a716-446655440010')
const eventId = EventJournalId.make('750e8400-e29b-41d4-a716-446655440011')

interface RegisterTestDeps extends RegisterTextSourceDeps {
  readonly calls: { readonly jobPayloads: unknown[]; readonly events: unknown[] }
}

function deps(overrides: Partial<RegisterTextSourceDeps> = {}): RegisterTestDeps {
  const calls = { jobPayloads: [] as unknown[], events: [] as unknown[] }
  return {
    now: () => 1700000000000n,
    randomUuid: () => sourceId,
    randomJobQueueId: () => jobId,
    randomEventJournalId: () => eventId,
    projects: {
      findById: () => Effect.succeed({ id: projectId, workspaceId, name: 'Project', createdAt: 0n, updatedAt: 0n }),
    },
    registration: {
      create: ({ source, job, event }) => {
        calls.jobPayloads.push(job.payload)
        calls.events.push(event.payload)
        return Effect.succeed({ source, job, event })
      },
    },
    storage: {
      stageObject: () => Effect.succeed({ ref: 'staged://750e8400-e29b-41d4-a716-446655440100/notes.md', byteLength: 7 }),
    },
    maxBytes: 1024,
    calls,
    ...overrides,
  }
}

describe('registerTextSource', () => {
  it('creates a logical Source, stages bytes, enqueues job_queue, and records ingestion-requested without raw text', async () => {
    const testDeps = deps()

    const result = await Effect.runPromise(registerTextSource({
      workspaceId,
      projectId,
      name: 'notes.md',
      mediaType: 'text/markdown',
      bytes: new TextEncoder().encode('# Title'),
    }, testDeps))

    expect(result.source.id).toBe(sourceId)
    expect(result.job.status).toBe('pending')
    expect(result.job.entityType).toBe('ingestion')
    expect(result.event.eventType).toBe('ingestion-requested')
    expect(JSON.stringify(testDeps.calls.jobPayloads)).toContain('staged://')
    expect(JSON.stringify(testDeps.calls.jobPayloads)).not.toContain('# Title')
    expect(JSON.stringify(testDeps.calls.events)).not.toContain('# Title')
    expect(JSON.stringify(testDeps.calls.jobPayloads)).not.toContain('/Users/')
    expect(Object.keys(result.job.payload).sort()).toEqual([
      'byteLength',
      'mediaType',
      'name',
      'projectId',
      'sourceId',
      'stagedRef',
    ])
    expect(Object.keys(result.event.payload).sort()).toEqual([
      'byteLength',
      'jobId',
      'mediaType',
      'sourceId',
      'stagedRef',
    ])
  })

  it('preserves a mixed-case user-visible source name while carrying the canonical staged ref', async () => {
    const testDeps = deps({
      storage: {
        stageObject: () =>
          Effect.succeed({
            ref: 'staged://750e8400-e29b-41d4-a716-446655440100/notes.md',
            byteLength: 7,
          }),
      },
    })

    const result = await Effect.runPromise(registerTextSource({
      workspaceId,
      projectId,
      name: 'Notes.MD',
      mediaType: 'text/markdown',
      bytes: new TextEncoder().encode('# Title'),
    }, testDeps))

    expect(result.source.name).toBe('Notes.MD')
    expect(result.job.payload['name']).toBe('Notes.MD')
    expect(result.job.payload['stagedRef']).toBe(
      'staged://750e8400-e29b-41d4-a716-446655440100/notes.md',
    )
  })

  it('rejects workspace/project mismatches before staging or enqueueing', async () => {
    let staged = false
    const testDeps = deps({
      projects: {
        findById: () => Effect.succeed({ id: projectId, workspaceId: WorkspaceId.make('750e8400-e29b-41d4-a716-446655440099'), name: 'Other', createdAt: 0n, updatedAt: 0n }),
      },
      storage: {
        stageObject: () => {
          staged = true
          return Effect.succeed({ ref: 'staged://750e8400-e29b-41d4-a716-446655440100/notes.md', byteLength: 7 })
        },
      },
    })

    const result = await Effect.runPromiseExit(registerTextSource({ workspaceId, projectId, name: 'notes.md', mediaType: 'text/markdown', bytes: new TextEncoder().encode('# Title') }, testDeps))

    expect(Exit.isFailure(result)).toBe(true)
    expect(staged).toBe(false)
  })

  it('rejects unsupported and oversized uploads before enqueueing', async () => {
    const testDeps = deps({ maxBytes: 4 })

    const oversized = await Effect.runPromiseExit(registerTextSource({ workspaceId, projectId, name: 'notes.md', mediaType: 'text/markdown', bytes: new TextEncoder().encode('large') }, testDeps))
    const unsupported = await Effect.runPromiseExit(registerTextSource({ workspaceId, projectId, name: 'malware.exe', mediaType: 'application/octet-stream', bytes: new TextEncoder().encode('x') }, testDeps))

    expect(Exit.isFailure(oversized)).toBe(true)
    expect(Exit.isFailure(unsupported)).toBe(true)
    if (Exit.isFailure(unsupported)) {
      expect(unsupported.cause.toString()).toContain(ValidationError.name)
    }
    expect(testDeps.calls.jobPayloads).toHaveLength(0)
  })

  it('rejects path-like upload names before staging so job payloads cannot leak host paths', async () => {
    let staged = false
    const testDeps = deps({
      storage: {
        stageObject: () => {
          staged = true
          return Effect.succeed({ ref: 'staged://750e8400-e29b-41d4-a716-446655440100/secret.md', byteLength: 6 })
        },
      },
    })

    const result = await Effect.runPromiseExit(registerTextSource({ workspaceId, projectId, name: '/Users/dino/secret.md', mediaType: 'text/markdown', bytes: new TextEncoder().encode('secret') }, testDeps))

    expect(Exit.isFailure(result)).toBe(true)
    expect(staged).toBe(false)
    expect(JSON.stringify(testDeps.calls.jobPayloads)).not.toContain('/Users/')
  })
})
