import {
  Finding,
  FindingId,
  ProjectId,
  Report,
  ReportId,
  ReportSectionId,
  WorkspaceId,
} from '@struct/domain'
import {
  AddReportSectionInput,
  ComposeReportInput,
  EditReportSectionInput,
  addReportSection,
  composeReport,
  editReportSection,
  removeReportSection,
  reorderReportSections,
} from '@struct/research-engine'
import { Cause, Effect, Option, Schema } from 'effect'

const NonBlank = Schema.String.pipe(
  Schema.minLength(1),
  Schema.maxLength(2_048),
  Schema.filter((value) => value.trim().length > 0 || 'must not be blank'),
)
const CreateReportBody = Schema.Struct({
  workspaceId: WorkspaceId,
  findingIds: Schema.Array(FindingId).pipe(Schema.minItems(1)),
  composition: ComposeReportInput,
})
const ReportMutationBody = Schema.Union(
  Schema.Struct({
    kind: Schema.Literal('add'),
    workspaceId: WorkspaceId,
    findingId: FindingId,
    input: AddReportSectionInput,
  }),
  Schema.Struct({
    kind: Schema.Literal('reorder'),
    workspaceId: WorkspaceId,
    orderedSectionIds: Schema.Array(ReportSectionId).pipe(Schema.minItems(1)),
    expectedReportRevision: Schema.Number.pipe(
      Schema.int(),
      Schema.nonNegative(),
    ),
    occurredAt: Schema.BigIntFromNumber,
  }),
  Schema.Struct({
    kind: Schema.Literal('remove'),
    workspaceId: WorkspaceId,
    sectionId: ReportSectionId,
    expectedReportRevision: Schema.Number.pipe(
      Schema.int(),
      Schema.nonNegative(),
    ),
    occurredAt: Schema.BigIntFromNumber,
  }),
  Schema.Struct({
    kind: Schema.Literal('edit'),
    workspaceId: WorkspaceId,
    input: EditReportSectionInput,
  }),
)

export interface DurableArtifactRouteDeps {
  readonly authorize: (
    credential: string,
    workspaceId: typeof WorkspaceId.Type,
    projectId: typeof ProjectId.Type,
  ) => Effect.Effect<void, unknown>
  readonly saveFinding: (
    finding: Finding,
    idempotencyKey: string,
  ) => Effect.Effect<Finding, unknown>
  readonly listFindings: (
    workspaceId: typeof WorkspaceId.Type,
    projectId: typeof ProjectId.Type,
  ) => Effect.Effect<ReadonlyArray<Finding>, unknown>
  readonly findFinding: (
    workspaceId: typeof WorkspaceId.Type,
    projectId: typeof ProjectId.Type,
    findingId: typeof FindingId.Type,
  ) => Effect.Effect<Finding, unknown>
  readonly saveReport: (
    report: Report,
    expectedPreviousRevision: number | null,
    idempotencyKey: string,
  ) => Effect.Effect<Report, unknown>
  readonly findReport: (
    workspaceId: typeof WorkspaceId.Type,
    projectId: typeof ProjectId.Type,
    reportId: typeof ReportId.Type,
  ) => Effect.Effect<Report, unknown>
  readonly findReportRevisionByKey: (
    workspaceId: typeof WorkspaceId.Type,
    projectId: typeof ProjectId.Type,
    reportId: typeof ReportId.Type,
    idempotencyKey: string,
  ) => Effect.Effect<Option.Option<Report>, unknown>
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
    : Effect.fail({ _tag: 'ArtifactAuthenticationError' as const })
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
  return tag === 'ArtifactAuthenticationError' || tag.includes('Authentication')
    ? json({ error: tag }, 401)
    : tag.includes('Authorization')
      ? json({ error: 'ArtifactNotFound' }, 404)
      : tag === 'ParseError'
        ? json({ error: 'InvalidArtifactRequest' }, 400)
        : tag === 'DurableArtifactScopeError'
          ? json({ error: 'ArtifactNotFound' }, 404)
          : tag === 'DurableArtifactConflictError'
            || tag === 'DurableArtifactStaleWriteError'
            || tag === 'StaleReportRevisionError'
            || tag === 'ReportCompositionError'
            ? json({ error: tag }, 409)
            : json({ error: 'ArtifactServiceUnavailable' }, 503)
}

function idempotencyKey(request: Request) {
  return Schema.decodeUnknown(NonBlank)(
    request.headers.get('idempotency-key'),
  )
}

function requestJson(request: Request) {
  return Effect.tryPromise({
    try: () => request.json(),
    catch: () => ({ _tag: 'ParseError' as const }),
  })
}

export const durableArtifactRoute = Effect.fn('DurableArtifactRoute')(
  function* (request: Request, deps: DurableArtifactRouteDeps) {
    const url = new URL(request.url)
    const findingsPath = /^\/api\/projects\/([^/]+)\/findings$/
      .exec(url.pathname)
    const reportsPath = /^\/api\/projects\/([^/]+)\/reports$/
      .exec(url.pathname)
    const reportPath = /^\/api\/projects\/([^/]+)\/reports\/([^/]+)$/
      .exec(url.pathname)
    if (
      findingsPath === null
      && reportsPath === null
      && reportPath === null
    ) return undefined

    const program = Effect.gen(function* () {
      const rawProjectId = findingsPath?.[1]
        ?? reportsPath?.[1]
        ?? reportPath?.[1]
      const projectId = yield* Schema.decodeUnknown(ProjectId)(rawProjectId)
      const token = yield* credential(request)

      if (findingsPath !== null && request.method === 'GET') {
        const workspaceId = yield* Schema.decodeUnknown(WorkspaceId)(
          url.searchParams.get('workspaceId'),
        )
        yield* deps.authorize(token, workspaceId, projectId)
        const findings = yield* deps.listFindings(workspaceId, projectId)
        return yield* Schema.encode(Schema.Array(Finding))(findings)
      }
      if (findingsPath !== null && request.method === 'POST') {
        const key = yield* idempotencyKey(request)
        const finding = yield* requestJson(request).pipe(
          Effect.flatMap(Schema.decodeUnknown(Finding)),
        )
        if (finding.projectId !== projectId) {
          return yield* Effect.fail({ _tag: 'ParseError' as const })
        }
        yield* deps.authorize(token, finding.workspaceId, projectId)
        return yield* Schema.encode(Finding)(
          yield* deps.saveFinding(finding, key),
        )
      }
      if (reportsPath !== null && request.method === 'POST') {
        const key = yield* idempotencyKey(request)
        const body = yield* requestJson(request).pipe(
          Effect.flatMap(Schema.decodeUnknown(CreateReportBody)),
        )
        if (
          body.composition.projectId !== projectId
          || body.composition.workspaceId !== body.workspaceId
          || body.composition.idempotencyKey !== key
        ) return yield* Effect.fail({ _tag: 'ParseError' as const })
        yield* deps.authorize(token, body.workspaceId, projectId)
        const findings = yield* Effect.forEach(body.findingIds, (findingId) =>
          deps.findFinding(body.workspaceId, projectId, findingId))
        const report = yield* composeReport(body.composition, findings)
        return yield* Schema.encode(Report)(
          yield* deps.saveReport(report, null, key),
        )
      }
      if (reportPath !== null && request.method === 'GET') {
        const workspaceId = yield* Schema.decodeUnknown(WorkspaceId)(
          url.searchParams.get('workspaceId'),
        )
        const reportId = yield* Schema.decodeUnknown(ReportId)(reportPath[2])
        yield* deps.authorize(token, workspaceId, projectId)
        return yield* Schema.encode(Report)(
          yield* deps.findReport(workspaceId, projectId, reportId),
        )
      }
      if (reportPath !== null && request.method === 'PATCH') {
        const key = yield* idempotencyKey(request)
        const body = yield* requestJson(request).pipe(
          Effect.flatMap(Schema.decodeUnknown(ReportMutationBody)),
        )
        const reportId = yield* Schema.decodeUnknown(ReportId)(reportPath[2])
        if (
          (body.kind === 'add' || body.kind === 'edit')
          && body.input.idempotencyKey !== key
        ) return yield* Effect.fail({ _tag: 'ParseError' as const })
        yield* deps.authorize(token, body.workspaceId, projectId)
        const replay = yield* deps.findReportRevisionByKey(
          body.workspaceId,
          projectId,
          reportId,
          key,
        )
        if (Option.isSome(replay)) {
          return yield* Schema.encode(Report)(replay.value)
        }
        const current = yield* deps.findReport(
          body.workspaceId,
          projectId,
          reportId,
        )
        const next = body.kind === 'add'
          ? yield* addReportSection(
            current,
            yield* deps.findFinding(
              body.workspaceId,
              projectId,
              body.findingId,
            ),
            body.input,
          )
          : body.kind === 'reorder'
            ? yield* reorderReportSections(
              current,
              body.orderedSectionIds,
              body.expectedReportRevision,
              body.occurredAt,
            )
            : body.kind === 'edit'
              ? yield* editReportSection(current, body.input)
              : yield* removeReportSection(
                current,
                body.sectionId,
                yield* Effect.forEach(
                  current.findingIds.filter((findingId) =>
                    !current.sections
                      .find((section) => section.id === body.sectionId)
                      ?.findingIds.includes(findingId)),
                  (findingId) => deps.findFinding(
                    body.workspaceId,
                    projectId,
                    findingId,
                  ),
                ),
                body.expectedReportRevision,
                body.occurredAt,
              )
        return yield* Schema.encode(Report)(
          yield* deps.saveReport(current.revision === next.revision
            ? current
            : next, current.revision, key),
        )
      }
      return yield* Effect.fail({ _tag: 'ParseError' as const })
    })
    return yield* Effect.matchCause(program, {
      onFailure: errorResponse,
      onSuccess: (body) => json(body),
    })
  },
)
