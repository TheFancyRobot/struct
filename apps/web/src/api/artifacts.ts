import {
  ClaimId,
  ContentRevisionId,
  ExportBundleStatus,
  Finding,
  FindingId,
  Report,
} from '@struct/domain'
/* eslint-disable no-unused-vars -- Babel does not mark type-only imports as used. */
import type {
  CitationId,
  ProjectId,
  ReportId,
  ReportSectionId,
  ResearchRunId,
  SourceVersionId,
  WorkspaceId,
} from '@struct/domain'
/* eslint-enable no-unused-vars */
import { Effect, Schema } from 'effect'
import { apiPath, basePathFromPublicBaseUrl } from '../base-path'

const appBasePath = basePathFromPublicBaseUrl(import.meta.env.BASE_URL)

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
  let body: unknown
  try {
    body = await response.json()
  } catch {
    throw new Error('The notebook returned an invalid persistence response.')
  }
  if (!response.ok) {
    const tag = typeof body === 'object'
      && body !== null
      && 'error' in body
      && typeof body.error === 'string'
      ? body.error
      : ''
    const message = tag.includes('Stale')
      ? 'The report changed. Reload before editing again.'
      : tag === 'ReportNotPublishableError'
        || tag === 'ReportExportBlockedError'
        ? 'Publication is blocked by the claim states listed in the report.'
        : tag === 'IllegalReportStateError'
          ? 'This action is incompatible with the report’s current publication state.'
          : tag === 'ReportRepairError'
            ? 'That repair is no longer valid. Reload the report and choose again.'
            : response.status === 401
              ? 'Your workspace session is no longer authorized.'
              : response.status === 404
                ? 'The report or one of its sources is no longer available.'
                : 'The notebook could not be saved. Try again.'
    throw new Error(message)
  }
  return body
}

export async function fetchFindings(
  workspaceId: typeof WorkspaceId.Type,
  projectId: typeof ProjectId.Type,
): Promise<ReadonlyArray<Finding>> {
  const body = await artifactRequest(
    `${apiPath(`/projects/${projectId}/findings`, appBasePath)}?workspaceId=${workspaceId}`,
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
    apiPath(`/projects/${input.projectId}/findings`, appBasePath),
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
  const response = await artifactRequest(apiPath(`/projects/${projectId}/reports`, appBasePath), {
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

async function decodeReport(body: unknown, message: string): Promise<Report> {
  try {
    return await Effect.runPromise(Schema.decodeUnknown(Report)(body))
  } catch {
    throw new Error(message)
  }
}

export async function fetchReport(
  workspaceId: typeof WorkspaceId.Type,
  projectId: typeof ProjectId.Type,
  reportId: typeof ReportId.Type,
  revision?: number,
): Promise<Report> {
  const query = new URLSearchParams({ workspaceId })
  if (revision !== undefined) query.set('revision', String(revision))
  return decodeReport(
    await artifactRequest(
      `${apiPath(`/projects/${projectId}/reports/${reportId}`, appBasePath)}?${query}`,
    ),
    'The report returned an invalid revision.',
  )
}

export type ReportMutation =
  | {
    readonly kind: 'edit'
    readonly sectionId: typeof ReportSectionId.Type
    readonly content: string
    readonly actorId: string
  }
  | {
    readonly kind: 'regenerate'
    readonly sectionId: typeof ReportSectionId.Type
  }
  | {
    readonly kind: 'reorder'
    readonly orderedSectionIds: ReadonlyArray<typeof ReportSectionId.Type>
  }
  | {
    readonly kind: 'remove'
    readonly sectionId: typeof ReportSectionId.Type
  }
  | {
    readonly kind: 'remove-claim'
    readonly claimId: typeof ClaimId.Type
  }
  | {
    readonly kind: 'replace-claim'
    readonly claimId: typeof ClaimId.Type
    readonly replacementFindingId: typeof FindingId.Type
    readonly replacementClaimId: typeof ClaimId.Type
  }
  | { readonly kind: 'prepare-publication' | 'publish' }

export async function mutateReport(
  report: Report,
  mutation: ReportMutation,
): Promise<Report> {
  const now = Date.now()
  const key = `report-${mutation.kind}-${report.id}-${report.revision}-${crypto.randomUUID()}`
  const body = mutation.kind === 'edit'
    ? {
      kind: mutation.kind,
      workspaceId: report.workspaceId,
      input: {
        sectionId: mutation.sectionId,
        revisionId: crypto.randomUUID(),
        content: mutation.content,
        actorId: mutation.actorId,
        idempotencyKey: key,
        expectedReportRevision: report.revision,
        occurredAt: now,
      },
    }
    : mutation.kind === 'regenerate'
      ? {
        kind: mutation.kind,
        workspaceId: report.workspaceId,
        sectionId: mutation.sectionId,
        revisionId: crypto.randomUUID(),
        expectedReportRevision: report.revision,
        occurredAt: now,
      }
      : mutation.kind === 'remove-claim' || mutation.kind === 'replace-claim'
        ? {
          ...mutation,
          workspaceId: report.workspaceId,
          revisionId: crypto.randomUUID(),
          expectedReportRevision: report.revision,
          occurredAt: now,
        }
        : {
        ...mutation,
        workspaceId: report.workspaceId,
        expectedReportRevision: report.revision,
        occurredAt: now,
        }
  return decodeReport(
    await artifactRequest(
      apiPath(`/projects/${report.projectId}/reports/${report.id}`, appBasePath),
      {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Idempotency-Key': key,
        },
        body: JSON.stringify(body),
      },
    ),
    'The report returned an invalid saved revision.',
  )
}

export async function exportReport(report: Report): Promise<ExportBundleStatus> {
  const key = `export:${report.id}:${report.revision}:0.0.1`
  const body = await artifactRequest(
    apiPath(`/projects/${report.projectId}/reports/${report.id}/exports`, appBasePath),
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Idempotency-Key': key,
      },
      body: JSON.stringify({
        workspaceId: report.workspaceId,
        reportRevision: report.revision,
      }),
    },
  )
  try {
    return await Effect.runPromise(Schema.decodeUnknown(ExportBundleStatus)(body))
  } catch {
    throw new Error('The report export returned an invalid result.')
  }
}
