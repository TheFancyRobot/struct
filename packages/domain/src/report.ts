import { Effect, Schema } from 'effect'
import {
  ClaimId,
  ContentRevisionId,
  FindingId,
  ProjectId,
  ReportId,
  ReportSectionId,
  ResearchRunId,
  SourceVersionId,
  WorkspaceId,
} from './branded-ids.js'
import {
  Claim,
  ContentRevision,
  RevisionAuthorship,
  claimSourceVersionIds,
} from './finding.js'

const NonBlank = Schema.String.pipe(
  Schema.minLength(1),
  Schema.maxLength(65_536),
  Schema.filter((value) => value.trim().length > 0 || 'must not be blank'),
)
const Revision = Schema.Number.pipe(Schema.int(), Schema.nonNegative())

export const ReportPublicationState = Schema.Literal(
  'draft',
  'publishable',
  'published',
  'superseded',
)
export type ReportPublicationState =
  Schema.Schema.Type<typeof ReportPublicationState>

export const ReportSection = Schema.Struct({
  id: ReportSectionId,
  ordinal: Schema.Number.pipe(Schema.int(), Schema.nonNegative()),
  heading: NonBlank,
  revisions: Schema.Array(ContentRevision).pipe(Schema.minItems(1)),
  currentRevision: Revision,
  claimIds: Schema.Array(ClaimId),
  lastRegenerationKey: Schema.NullOr(NonBlank),
}).pipe(
  Schema.filter((section) => [
    section.revisions.every((revision, index) => revision.revision === index)
      ? undefined
      : 'section revisions must be contiguous and zero-based',
    section.currentRevision === section.revisions.length - 1
      ? undefined
      : 'section currentRevision must identify the latest revision',
    new Set(section.revisions.map((revision) => revision.id)).size
      === section.revisions.length
      ? undefined
      : 'section content-revision identities must be unique',
    new Set(section.claimIds).size === section.claimIds.length
      ? undefined
      : 'section claim links must be unique',
  ]),
)
export type ReportSection = Schema.Schema.Type<typeof ReportSection>

export const Report = Schema.Struct({
  id: ReportId,
  workspaceId: WorkspaceId,
  projectId: ProjectId,
  runId: ResearchRunId,
  sourceVersionIds: Schema.Array(SourceVersionId).pipe(Schema.minItems(1)),
  findingIds: Schema.Array(FindingId),
  titleRevisions: Schema.Array(ContentRevision).pipe(Schema.minItems(1)),
  currentTitleRevision: Revision,
  claims: Schema.Array(Claim).pipe(Schema.minItems(1)),
  sections: Schema.Array(ReportSection).pipe(Schema.minItems(1)),
  revision: Revision,
  publicationState: ReportPublicationState,
  supersededBy: Schema.NullOr(ReportId),
  lastPublicationKey: Schema.NullOr(NonBlank),
  createdAt: Schema.BigIntFromNumber,
  updatedAt: Schema.BigIntFromNumber,
}).pipe(
  Schema.filter((report) => {
    const claimIds = new Set(report.claims.map((claim) => claim.id))
    const linkedClaims = report.sections.flatMap((section) => section.claimIds)
    const revisionIds = [
      ...report.titleRevisions.map((revision) => revision.id),
      ...report.claims.flatMap((claim) =>
        claim.revisions.map((revision) => revision.id)),
      ...report.sections.flatMap((section) =>
        section.revisions.map((revision) => revision.id)),
    ]
    return [
      new Set(report.sourceVersionIds).size === report.sourceVersionIds.length
        ? undefined
        : 'report source-version identities must be unique',
      new Set(report.findingIds).size === report.findingIds.length
        ? undefined
        : 'report finding links must be unique',
      claimIds.size === report.claims.length
        ? undefined
        : 'report claim identities must be unique',
      new Set(report.sections.map((section) => section.id)).size
        === report.sections.length
        ? undefined
        : 'report section identities must be unique',
      report.sections.every((section, index) => section.ordinal === index)
        ? undefined
        : 'report sections require contiguous zero-based ordinals',
      linkedClaims.every((claimId) => claimIds.has(claimId))
        ? undefined
        : 'report sections cannot link dangling claims',
      new Set(linkedClaims).size === linkedClaims.length
        ? undefined
        : 'a report claim must belong to exactly one section',
      linkedClaims.length === report.claims.length
        ? undefined
        : 'every report claim must belong to exactly one section',
      report.claims.every((claim) =>
        [...claimSourceVersionIds(claim)].every(
          (sourceVersionId) => report.sourceVersionIds.includes(sourceVersionId),
        ))
        ? undefined
        : 'report claim evidence must remain inside the declared source-version scope',
      report.titleRevisions.every((item, index) => item.revision === index)
        ? undefined
        : 'report title revisions must be contiguous and zero-based',
      report.currentTitleRevision === report.titleRevisions.length - 1
        ? undefined
        : 'report currentTitleRevision must identify the latest title revision',
      new Set(revisionIds).size === revisionIds.length
        ? undefined
        : 'report content-revision identities must be unique',
      (report.publicationState === 'publishable'
        || report.publicationState === 'published')
        && report.claims.some((claim) =>
          claim.support.kind === 'unsupported'
          || claim.citation.state !== 'publishable')
        ? 'publishable and published reports require publishable supported claims'
        : undefined,
      report.publicationState === 'superseded' && report.supersededBy === null
        ? 'a superseded report requires a replacement'
        : undefined,
      report.publicationState !== 'superseded' && report.supersededBy !== null
        ? 'only a superseded report may identify a replacement'
        : undefined,
      report.supersededBy === report.id
        ? 'a report cannot supersede itself'
        : undefined,
    ]
  }),
)
export type Report = Schema.Schema.Type<typeof Report>

export class ReportSupersessionError
  extends Schema.TaggedError<ReportSupersessionError>()(
    'ReportSupersessionError',
    {
      reportId: ReportId,
      reason: Schema.Literal('cycle', 'dangling-target'),
      message: Schema.String,
    },
  ) {}

export const validateReportSupersession = Effect.fn(
  'Report.validateSupersession',
)(function* (reports: ReadonlyArray<Report>) {
  const byId = new Map(reports.map((report) => [report.id, report]))
  for (const report of reports) {
    const visited = new Set<ReportId>()
    let cursor: Report | undefined = report
    while (cursor !== undefined && cursor.supersededBy !== null) {
      if (visited.has(cursor.id)) {
        return yield* new ReportSupersessionError({
          reportId: cursor.id,
          reason: 'cycle',
          message: 'Report supersession graph contains a cycle',
        })
      }
      visited.add(cursor.id)
      const replacement = byId.get(cursor.supersededBy)
      if (replacement === undefined) {
        return yield* new ReportSupersessionError({
          reportId: cursor.id,
          reason: 'dangling-target',
          message: 'Report supersession target does not exist',
        })
      }
      cursor = replacement
    }
  }
  return reports
})

export const SectionRegeneration = Schema.Struct({
  sectionId: ReportSectionId,
  revisionId: ContentRevisionId,
  expectedReportRevision: Revision,
  idempotencyKey: NonBlank,
  content: NonBlank,
  authorship: RevisionAuthorship,
  occurredAt: Schema.BigIntFromNumber,
})
export type SectionRegeneration =
  Schema.Schema.Type<typeof SectionRegeneration>

export class StaleReportRevisionError
  extends Schema.TaggedError<StaleReportRevisionError>()(
    'StaleReportRevisionError',
    {
      reportId: ReportId,
      expectedRevision: Revision,
      actualRevision: Revision,
      message: Schema.String,
    },
  ) {}

export class ReportSectionNotFoundError
  extends Schema.TaggedError<ReportSectionNotFoundError>()(
    'ReportSectionNotFoundError',
    {
      reportId: ReportId,
      sectionId: ReportSectionId,
      message: Schema.String,
    },
  ) {}

export class ReportNotPublishableError
  extends Schema.TaggedError<ReportNotPublishableError>()(
    'ReportNotPublishableError',
    {
      reportId: ReportId,
      blockingClaimIds: Schema.Array(ClaimId),
      message: Schema.String,
    },
  ) {}

export class IllegalReportStateError
  extends Schema.TaggedError<IllegalReportStateError>()(
    'IllegalReportStateError',
    {
      reportId: ReportId,
      state: ReportPublicationState,
      operation: Schema.Literal('prepare-publication', 'publish', 'regenerate'),
      message: Schema.String,
    },
  ) {}

export class ReportIdempotencyConflictError
  extends Schema.TaggedError<ReportIdempotencyConflictError>()(
    'ReportIdempotencyConflictError',
    {
      reportId: ReportId,
      idempotencyKey: NonBlank,
      message: Schema.String,
    },
  ) {}

export function blockingClaimIds(report: Report): ReadonlyArray<ClaimId> {
  return report.claims
    .filter((claim) =>
      claim.support.kind === 'unsupported'
      || claim.citation.state !== 'publishable')
    .map((claim) => claim.id)
}

function sameAuthorship(
  left: Schema.Schema.Type<typeof RevisionAuthorship>,
  right: Schema.Schema.Type<typeof RevisionAuthorship>,
): boolean {
  if (left.kind !== right.kind) return false
  if (left.kind === 'user' && right.kind === 'user') {
    return left.actorId === right.actorId
  }
  if (left.kind === 'generated' && right.kind === 'generated') {
    return left.runId === right.runId
      && left.model === right.model
      && left.promptVersion === right.promptVersion
  }
  return false
}

export const regenerateReportSection = Effect.fn('Report.regenerateSection')(
  function* (
    report: Report,
    request: SectionRegeneration,
  ) {
    const section = report.sections.find((item) => item.id === request.sectionId)
    if (section?.lastRegenerationKey === request.idempotencyKey) {
      const latest = section.revisions[section.currentRevision]
      if (
        latest?.id === request.revisionId
        && latest.content === request.content
        && sameAuthorship(latest.authorship, request.authorship)
        && latest.createdAt === request.occurredAt
      ) {
        return report
      }
      return yield* new ReportIdempotencyConflictError({
        reportId: report.id,
        idempotencyKey: request.idempotencyKey,
        message: 'Idempotency key was already used for a different regeneration',
      })
    }
    if (report.publicationState === 'superseded') {
      return yield* new IllegalReportStateError({
        reportId: report.id,
        state: report.publicationState,
        operation: 'regenerate',
        message: 'A superseded report cannot be regenerated',
      })
    }
    if (report.revision !== request.expectedReportRevision) {
      return yield* new StaleReportRevisionError({
        reportId: report.id,
        expectedRevision: request.expectedReportRevision,
        actualRevision: report.revision,
        message: 'Report revision changed before section regeneration',
      })
    }
    if (section === undefined) {
      return yield* new ReportSectionNotFoundError({
        reportId: report.id,
        sectionId: request.sectionId,
        message: 'Report section does not exist',
      })
    }
    const revision: Schema.Schema.Type<typeof ContentRevision> = ContentRevision.make({
      id: request.revisionId,
      revision: section.currentRevision + 1,
      content: request.content,
      authorship: request.authorship,
      idempotencyKey: request.idempotencyKey,
      createdAt: request.occurredAt,
    })
    return Report.make({
      ...report,
      sections: report.sections.map((item) =>
        item.id === section.id
          ? ReportSection.make({
            ...item,
            revisions: [...item.revisions, revision],
            currentRevision: revision.revision,
            lastRegenerationKey: request.idempotencyKey,
          })
          : item),
      revision: report.revision + 1,
      publicationState: 'draft',
      lastPublicationKey: null,
      updatedAt: request.occurredAt,
    })
  },
)

export const publishReport = Effect.fn('Report.publish')(
  function* (
    report: Report,
    expectedRevision: number,
    idempotencyKey: string,
    occurredAt: bigint,
  ) {
    if (
      report.lastPublicationKey === idempotencyKey
      && report.publicationState === 'published'
    ) {
      if (report.updatedAt === occurredAt) return report
      return yield* new ReportIdempotencyConflictError({
        reportId: report.id,
        idempotencyKey,
        message: 'Publication idempotency key has a different timestamp',
      })
    }
    if (report.lastPublicationKey === idempotencyKey) {
      return yield* new ReportIdempotencyConflictError({
        reportId: report.id,
        idempotencyKey,
        message: 'Idempotency key belongs to a different publication operation',
      })
    }
    if (report.revision !== expectedRevision) {
      return yield* new StaleReportRevisionError({
        reportId: report.id,
        expectedRevision,
        actualRevision: report.revision,
        message: 'Report revision changed before publication',
      })
    }
    if (report.publicationState !== 'publishable') {
      return yield* new IllegalReportStateError({
        reportId: report.id,
        state: report.publicationState,
        operation: 'publish',
        message: 'Only a publishable report can be published',
      })
    }
    const blocking = blockingClaimIds(report)
    if (blocking.length > 0) {
      return yield* new ReportNotPublishableError({
        reportId: report.id,
        blockingClaimIds: blocking,
        message: 'Every report claim must have publishable immutable evidence',
      })
    }
    return Report.make({
      ...report,
      revision: report.revision + 1,
      publicationState: 'published',
      lastPublicationKey: idempotencyKey,
      updatedAt: occurredAt,
    })
  },
)

export const prepareReportPublication = Effect.fn('Report.preparePublication')(
  function* (
    report: Report,
    expectedRevision: number,
    idempotencyKey: string,
    occurredAt: bigint,
  ) {
    if (
      report.lastPublicationKey === idempotencyKey
      && report.publicationState === 'publishable'
    ) {
      if (report.updatedAt === occurredAt) return report
      return yield* new ReportIdempotencyConflictError({
        reportId: report.id,
        idempotencyKey,
        message: 'Publishability idempotency key has a different timestamp',
      })
    }
    if (report.lastPublicationKey === idempotencyKey) {
      return yield* new ReportIdempotencyConflictError({
        reportId: report.id,
        idempotencyKey,
        message: 'Idempotency key belongs to a different publication operation',
      })
    }
    if (report.revision !== expectedRevision) {
      return yield* new StaleReportRevisionError({
        reportId: report.id,
        expectedRevision,
        actualRevision: report.revision,
        message: 'Report revision changed before publishability evaluation',
      })
    }
    if (report.publicationState !== 'draft') {
      return yield* new IllegalReportStateError({
        reportId: report.id,
        state: report.publicationState,
        operation: 'prepare-publication',
        message: 'Only a draft report can be evaluated for publication',
      })
    }
    const blocking = blockingClaimIds(report)
    if (blocking.length > 0) {
      return yield* new ReportNotPublishableError({
        reportId: report.id,
        blockingClaimIds: blocking,
        message: 'Every report claim must have publishable immutable evidence',
      })
    }
    return Report.make({
      ...report,
      revision: report.revision + 1,
      publicationState: 'publishable',
      lastPublicationKey: idempotencyKey,
      updatedAt: occurredAt,
    })
  },
)
