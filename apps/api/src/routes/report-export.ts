import {
  ExportBundleDigest,
  ExportBundleStatus,
  ProjectId,
  ProvenanceGraph,
  Report,
  ReportId,
  ReportExportBlockedError,
  WorkspaceId,
} from '@struct/domain'
import {
  REPORT_EXPORT_MEDIA_TYPE,
} from '@struct/source-storage'
import type {
  StoredBytes,
} from '@struct/source-storage'
import { Cause, Effect, Option, Schema } from 'effect'

const Revision = Schema.Number.pipe(Schema.int(), Schema.nonNegative())
const StartExportBody = Schema.Struct({
  workspaceId: WorkspaceId,
  reportRevision: Revision,
})
const NonBlank = Schema.String.pipe(
  Schema.minLength(1),
  Schema.maxLength(2_048),
  Schema.filter((value) => value.trim().length > 0 || 'must not be blank'),
)

export interface ReportExportRouteDeps {
  readonly producerVersion: string
  readonly authorize: (
    credential: string,
    workspaceId: typeof WorkspaceId.Type,
    projectId: typeof ProjectId.Type,
  ) => Effect.Effect<void, unknown>
  readonly findReportRevision: (
    workspaceId: typeof WorkspaceId.Type,
    projectId: typeof ProjectId.Type,
    reportId: typeof ReportId.Type,
    reportRevision: number,
  ) => Effect.Effect<Report, unknown>
  readonly findProvenance: (
    workspaceId: typeof WorkspaceId.Type,
    projectId: typeof ProjectId.Type,
    reportId: typeof ReportId.Type,
    reportRevision: number,
  ) => Effect.Effect<ProvenanceGraph, unknown>
  readonly authorizeSources: (
    report: Report,
  ) => Effect.Effect<void, unknown>
  readonly prepare: (
    report: Report,
    provenance: ProvenanceGraph,
  ) => Effect.Effect<{
    readonly bytes: Uint8Array
    readonly digest: typeof ExportBundleDigest.Type
  }, unknown>
  readonly publish: (
    report: Report,
    provenance: ProvenanceGraph,
  ) => Effect.Effect<ExportBundleStatus, unknown>
  readonly read: (
    digest: typeof ExportBundleDigest.Type,
  ) => Effect.Effect<StoredBytes, unknown>
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

function credential(request: Request) {
  const authorization = request.headers.get('authorization')
  return authorization?.startsWith('Bearer ')
    && authorization.length > 'Bearer '.length
    ? Effect.succeed(authorization.slice('Bearer '.length))
    : Effect.fail({ _tag: 'ReportExportAuthenticationError' as const })
}

function failureTag(cause: Cause.Cause<unknown>): string {
  const failure = Option.getOrUndefined(Cause.failureOption(cause))
  return typeof failure === 'object'
    && failure !== null
    && '_tag' in failure
    ? String(failure._tag)
    : ''
}

function errorResponse(cause: Cause.Cause<unknown>): Response {
  const tag = failureTag(cause)
  return tag === 'ReportExportAuthenticationError'
    || tag.includes('Authentication')
    ? json({ error: 'ReportExportAuthenticationError' }, 401)
    : tag.includes('Authorization')
      || tag.includes('Scope')
      ? json({ error: 'ReportExportNotFound' }, 404)
      : tag === 'ParseError'
        || tag === 'ReportExportRequestError'
        ? json({ error: 'InvalidReportExportRequest' }, 400)
        : tag === 'ExportBundleLimitError'
          ? json({ error: tag }, 413)
        : tag === 'ReportExportBlockedError'
          ? json({ error: tag }, 409)
          : tag === 'StoragePathError'
            || tag === 'StorageReadError'
            ? json({ error: 'ReportExportNotFound' }, 404)
            : json({ error: 'ReportExportUnavailable' }, 503)
}

function requestJson(request: Request) {
  return Effect.tryPromise({
    try: () => request.json(),
    catch: () => ({ _tag: 'ReportExportRequestError' as const }),
  })
}

function idempotencyKey(request: Request) {
  return Schema.decodeUnknown(NonBlank)(
    request.headers.get('idempotency-key'),
  )
}

function loadInputs(
  deps: ReportExportRouteDeps,
  workspaceId: typeof WorkspaceId.Type,
  projectId: typeof ProjectId.Type,
  reportId: typeof ReportId.Type,
  reportRevision: number,
) {
  return Effect.gen(function* () {
    const report = yield* deps.findReportRevision(
      workspaceId,
      projectId,
      reportId,
      reportRevision,
    )
    const provenance = yield* deps.findProvenance(
      workspaceId,
      projectId,
      reportId,
      reportRevision,
    )
    yield* deps.authorizeSources(report).pipe(
      Effect.mapError(() => new ReportExportBlockedError({
        reportId,
        reason: 'source-not-authorized',
        blockingClaimIds: report.claims.map((claim) => claim.id),
        message: 'A report source is no longer authorized for export',
      })),
    )
    return { report, provenance }
  })
}

export const reportExportRoute = Effect.fn('ReportExportRoute')(
  function* (request: Request, deps: ReportExportRouteDeps) {
    const url = new URL(request.url)
    const startPath =
      /^\/api\/projects\/([^/]+)\/reports\/([^/]+)\/exports$/
        .exec(url.pathname)
    const exportPath =
      /^\/api\/projects\/([^/]+)\/reports\/([^/]+)\/exports\/([^/]+)$/
        .exec(url.pathname)
    if (startPath === null && exportPath === null) return undefined

    const program = Effect.gen(function* () {
      const projectId = yield* Schema.decodeUnknown(ProjectId)(
        startPath?.[1] ?? exportPath?.[1],
      )
      const reportId = yield* Schema.decodeUnknown(ReportId)(
        startPath?.[2] ?? exportPath?.[2],
      )
      const token = yield* credential(request)

      if (startPath !== null && request.method === 'POST') {
        const body = yield* requestJson(request).pipe(
          Effect.flatMap(Schema.decodeUnknown(StartExportBody)),
        )
        const key = yield* idempotencyKey(request)
        if (
          key !==
            `export:${reportId}:${body.reportRevision}:${deps.producerVersion}`
        ) {
          return yield* Effect.fail({
            _tag: 'ReportExportRequestError' as const,
          })
        }
        yield* deps.authorize(token, body.workspaceId, projectId)
        const { report, provenance } = yield* loadInputs(
          deps,
          body.workspaceId,
          projectId,
          reportId,
          body.reportRevision,
        )
        return {
          kind: 'json' as const,
          body: yield* deps.publish(report, provenance),
          status: 201,
        }
      }
      if (exportPath !== null && request.method === 'GET') {
        const workspaceId = yield* Schema.decodeUnknown(WorkspaceId)(
          url.searchParams.get('workspaceId'),
        )
        const reportRevisionText = url.searchParams.get('reportRevision')
        const reportRevision = yield* Schema.decodeUnknown(Revision)(
          reportRevisionText !== null &&
            /^(?:0|[1-9]\d*)$/.test(reportRevisionText)
            ? Number(reportRevisionText)
            : Number.NaN,
        )
        const digest = yield* Schema.decodeUnknown(ExportBundleDigest)(
          exportPath[3] ?? '',
        )
        yield* deps.authorize(token, workspaceId, projectId)
        const { report, provenance } = yield* loadInputs(
          deps,
          workspaceId,
          projectId,
          reportId,
          reportRevision,
        )
        const expected = yield* deps.prepare(report, provenance)
        if (expected.digest !== digest) {
          return yield* Effect.fail({ _tag: 'ReportExportScopeError' as const })
        }
        const stored = yield* deps.read(digest)
        if (url.searchParams.get('download') === '1') {
          return {
            kind: 'download' as const,
            bytes: stored.bytes,
            reportId,
          }
        }
        return {
          kind: 'json' as const,
          body: {
            status: 'completed',
            workspaceId,
            projectId,
            reportId,
            reportRevision,
            digest,
            artifactRef:
              `artifact://sha256/${digest.slice('sha256:'.length)}`,
            byteLength: stored.byteLength,
            mediaType: REPORT_EXPORT_MEDIA_TYPE,
          },
          status: 200,
        }
      }
      return yield* Effect.fail({ _tag: 'ReportExportRequestError' as const })
    })
    return yield* Effect.matchCause(program, {
      onFailure: errorResponse,
      onSuccess: (result) => result.kind === 'download'
        ? new Response(Buffer.from(result.bytes), {
            status: 200,
            headers: {
              'Content-Type': REPORT_EXPORT_MEDIA_TYPE,
              'Content-Disposition':
                `attachment; filename="report-${result.reportId}.struct-export.json"`,
              'X-Content-Type-Options': 'nosniff',
            },
          })
        : json(result.body, result.status),
    })
  },
)
