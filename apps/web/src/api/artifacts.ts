import {
  ClaimId,
  ContentRevisionId,
  Finding,
  FindingId,
  Report,
} from '@struct/domain'
/* eslint-disable no-unused-vars -- Babel does not mark type-only imports as used. */
import type {
  CitationId,
  ProjectId,
  ResearchRunId,
  SourceVersionId,
  WorkspaceId,
} from '@struct/domain'
/* eslint-enable no-unused-vars */
import { Effect, Schema } from 'effect'

async function artifactRequest(
  input: RequestInfo | URL,
  init?: RequestInit,
): Promise<unknown> {
  let response: Response
  try {
    response = await fetch(input, {
      ...init,
      signal: AbortSignal.timeout(10_000),
    })
  } catch {
    throw new Error('The notebook could not connect to persistence.')
  }
  if (!response.ok) {
    throw new Error(
      response.status === 409
        ? 'The report changed. Reload before editing again.'
        : 'The notebook could not be saved. Try again.',
    )
  }
  try {
    return await response.json()
  } catch {
    throw new Error('The notebook returned an invalid persistence response.')
  }
}

export async function fetchFindings(
  workspaceId: typeof WorkspaceId.Type,
  projectId: typeof ProjectId.Type,
): Promise<ReadonlyArray<Finding>> {
  const body = await artifactRequest(
    `/api/projects/${projectId}/findings?workspaceId=${workspaceId}`,
  )
  try {
    return await Effect.runPromise(
      Schema.decodeUnknown(Schema.Array(Finding))(body),
    )
  } catch {
    throw new Error('The notebook returned an invalid findings response.')
  }
}

async function sha256(value: string): Promise<string> {
  const bytes = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(value),
  )
  return `sha256:${[...new Uint8Array(bytes)]
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('')}`
}

async function stableUuid(value: string): Promise<string> {
  const bytes = new Uint8Array(await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(value),
  )).slice(0, 16)
  bytes[6] = ((bytes[6] ?? 0) & 0x0f) | 0x50
  bytes[8] = ((bytes[8] ?? 0) & 0x3f) | 0x80
  const hex = [...bytes].map((byte) =>
    byte.toString(16).padStart(2, '0')).join('')
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}`
    + `-${hex.slice(16, 20)}-${hex.slice(20)}`
}

export async function saveCompletedResearchFinding(input: {
  readonly workspaceId: typeof WorkspaceId.Type
  readonly projectId: typeof ProjectId.Type
  readonly runId: typeof ResearchRunId.Type
  readonly answer: string
  readonly completedAt: number
  readonly citations: ReadonlyArray<{
    readonly id: typeof CitationId.Type
    readonly sourceVersionId: typeof SourceVersionId.Type
  }>
}): Promise<Finding> {
  const firstCitation = input.citations[0]
  if (firstCitation === undefined) {
    throw new Error('A completed result needs a citation before it can be saved.')
  }
  const key = `save-run-${input.runId}`
  const now = input.completedAt
  const findingId = FindingId.make(await stableUuid(`${key}:finding`))
  const finding = await Effect.runPromise(Schema.decodeUnknown(Finding)({
    id: findingId,
    workspaceId: input.workspaceId,
    projectId: input.projectId,
    runId: input.runId,
    sourceVersionIds: [
      ...new Set(input.citations.map((citation) => citation.sourceVersionId)),
    ],
    titleRevisions: [{
      id: ContentRevisionId.make(await stableUuid(`${key}:title-revision`)),
      revision: 0,
      content: input.answer.slice(0, 180),
      authorship: {
        kind: 'generated',
        runId: input.runId,
        model: 'completed-run',
        promptVersion: 'persisted-output-v1',
      },
      idempotencyKey: `${key}:title`,
      createdAt: now,
    }],
    currentRevision: 0,
    claims: [{
      id: ClaimId.make(await stableUuid(`${key}:claim`)),
      claimSignature: await sha256(input.answer),
      citation: {
        citationId: firstCitation.id,
        state: 'draft',
        revision: 0,
        supersededBy: null,
        lastIdempotencyKey: null,
        updatedAt: now,
      },
      origin: { kind: 'research-run', runId: input.runId },
      revisions: [{
        id: ContentRevisionId.make(await stableUuid(`${key}:claim-revision`)),
        revision: 0,
        content: input.answer,
        authorship: {
          kind: 'generated',
          runId: input.runId,
          model: 'completed-run',
          promptVersion: 'persisted-output-v1',
        },
        idempotencyKey: `${key}:claim`,
        createdAt: now,
      }],
      currentRevision: 0,
      support: {
        kind: 'unsupported',
        reason: 'Durable evidence validation is required before publication',
      },
      createdAt: now,
    }],
    supersededBy: null,
    createdAt: now,
    updatedAt: now,
  }))
  const response = await artifactRequest(
    `/api/projects/${input.projectId}/findings`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Idempotency-Key': key,
      },
      body: JSON.stringify(await Effect.runPromise(Schema.encode(Finding)(finding))),
    },
  )
  try {
    return await Effect.runPromise(Schema.decodeUnknown(Finding)(response))
  } catch {
    throw new Error('The notebook returned an invalid saved finding.')
  }
}

export async function createReportFromFindings(
  workspaceId: typeof WorkspaceId.Type,
  projectId: typeof ProjectId.Type,
  findings: ReadonlyArray<Finding>,
): Promise<Report> {
  const now = Date.now()
  const key = `web-compose-${crypto.randomUUID()}`
  const reportId = crypto.randomUUID()
  const body = {
    workspaceId,
    findingIds: findings.map((finding) => finding.id),
    composition: {
      id: reportId,
      workspaceId,
      projectId,
      runId: findings[0]?.runId,
      title: 'Research notebook report',
      titleRevisionId: crypto.randomUUID(),
      idempotencyKey: key,
      model: 'deterministic-composer',
      promptVersion: 'v1',
      sections: findings.map((finding, ordinal) => ({
        id: crypto.randomUUID(),
        revisionId: crypto.randomUUID(),
        heading: finding.titleRevisions[finding.currentRevision]?.content
          ?? `Finding ${ordinal + 1}`,
        findingIds: [finding.id],
      })),
      occurredAt: now,
    },
  }
  const response = await artifactRequest(`/api/projects/${projectId}/reports`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Idempotency-Key': key,
      },
      body: JSON.stringify(body),
    })
  try {
    return await Effect.runPromise(Schema.decodeUnknown(Report)(response))
  } catch {
    throw new Error('The notebook returned an invalid report response.')
  }
}
