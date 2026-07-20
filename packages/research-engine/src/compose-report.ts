import {
  ActorId,
  ContentRevision,
  ContentRevisionId,
  FindingId,
  ProjectId,
  Report,
  ReportId,
  ReportSection,
  ReportSectionId,
  ResearchRunId,
  StaleReportRevisionError,
  WorkspaceId,
  regenerateReportSection,
} from '@struct/domain'
/* eslint-disable no-unused-vars -- Babel does not mark type-only imports as used. */
import type { Claim, Finding } from '@struct/domain'
/* eslint-enable no-unused-vars */
import { Effect, Schema } from 'effect'

const NonBlank = Schema.String.pipe(
  Schema.minLength(1),
  Schema.maxLength(65_536),
  Schema.filter((value) => value.trim().length > 0 || 'must not be blank'),
)
const Revision = Schema.Number.pipe(Schema.int(), Schema.nonNegative())

export class ReportCompositionError
  extends Schema.TaggedError<ReportCompositionError>()(
    'ReportCompositionError',
    {
      reportId: ReportId,
      reason: Schema.Literal(
        'empty-selection',
        'scope-mismatch',
        'finding-not-found',
        'duplicate-claim',
        'claim-allocation',
        'section-not-found',
        'last-section',
        'invalid-order',
      ),
      message: Schema.String,
    },
  ) {}

export const ReportSectionSelection = Schema.Struct({
  id: ReportSectionId,
  revisionId: ContentRevisionId,
  heading: NonBlank,
  findingIds: Schema.Array(FindingId).pipe(Schema.minItems(1)),
})
export type ReportSectionSelection =
  Schema.Schema.Type<typeof ReportSectionSelection>

export const ComposeReportInput = Schema.Struct({
  id: ReportId,
  workspaceId: WorkspaceId,
  projectId: ProjectId,
  runId: ResearchRunId,
  title: NonBlank,
  titleRevisionId: ContentRevisionId,
  idempotencyKey: NonBlank,
  model: NonBlank,
  promptVersion: NonBlank,
  sections: Schema.Array(ReportSectionSelection).pipe(Schema.minItems(1)),
  occurredAt: Schema.BigIntFromNumber,
})
export type ComposeReportInput = Schema.Schema.Type<typeof ComposeReportInput>

export const AddReportSectionInput = Schema.Struct({
  sectionId: ReportSectionId,
  revisionId: ContentRevisionId,
  heading: NonBlank,
  idempotencyKey: NonBlank,
  model: NonBlank,
  promptVersion: NonBlank,
  expectedReportRevision: Revision,
  occurredAt: Schema.BigIntFromNumber,
})
export type AddReportSectionInput =
  Schema.Schema.Type<typeof AddReportSectionInput>

export const EditReportSectionInput = Schema.Struct({
  sectionId: ReportSectionId,
  revisionId: ContentRevisionId,
  content: NonBlank,
  actorId: ActorId,
  idempotencyKey: NonBlank,
  expectedReportRevision: Revision,
  occurredAt: Schema.BigIntFromNumber,
})
export type EditReportSectionInput =
  Schema.Schema.Type<typeof EditReportSectionInput>

function latestContent(claim: Claim): string {
  return claim.revisions[claim.currentRevision]?.content ?? ''
}

function renderFindingContent(findings: ReadonlyArray<Finding>): string {
  return findings
    .flatMap((finding) => finding.claims.map(latestContent))
    .join('\n\n')
}

function generatedRevision(
  id: typeof ContentRevisionId.Type,
  content: string,
  idempotencyKey: string,
  runId: typeof ResearchRunId.Type,
  model: string,
  promptVersion: string,
  occurredAt: bigint,
): typeof ContentRevision.Type {
  return ContentRevision.make({
    id,
    revision: 0,
    content,
    authorship: {
      kind: 'generated',
      runId,
      model,
      promptVersion,
    },
    idempotencyKey,
    createdAt: occurredAt,
  })
}

export const composeReport = Effect.fn('ReportComposition.compose')(
  function* (
    input: ComposeReportInput,
    findings: ReadonlyArray<Finding>,
  ) {
    if (findings.length === 0) {
      return yield* new ReportCompositionError({
        reportId: input.id,
        reason: 'empty-selection',
        message: 'At least one durable finding is required',
      })
    }
    if (findings.some((finding) =>
      finding.workspaceId !== input.workspaceId
      || finding.projectId !== input.projectId
    )) {
      return yield* new ReportCompositionError({
        reportId: input.id,
        reason: 'scope-mismatch',
        message: 'Every selected finding must belong to the report scope',
      })
    }
    const findingById = new Map(findings.map((finding) => [finding.id, finding]))
    const selectedIds = input.sections.flatMap((section) => section.findingIds)
    if (
      selectedIds.length !== findings.length
      || new Set(selectedIds).size !== selectedIds.length
      || findings.some((finding) => !selectedIds.includes(finding.id))
    ) {
      return yield* new ReportCompositionError({
        reportId: input.id,
        reason: 'claim-allocation',
        message: 'Every selected finding must belong to exactly one section',
      })
    }
    const claims = findings.flatMap((finding) => finding.claims)
    if (new Set(claims.map((claim) => claim.id)).size !== claims.length) {
      return yield* new ReportCompositionError({
        reportId: input.id,
        reason: 'duplicate-claim',
        message: 'Selected findings contain the same durable claim',
      })
    }
    const sections = yield* Effect.forEach(
      input.sections,
      (selection, ordinal) => {
        const selected = selection.findingIds.map((findingId) =>
          findingById.get(findingId))
        if (selected.some((finding) => finding === undefined)) {
          return Effect.fail(new ReportCompositionError({
            reportId: input.id,
            reason: 'finding-not-found',
            message: 'A selected finding was not loaded',
          }))
        }
        const bounded = selected.filter(
          (finding): finding is Finding => finding !== undefined,
        )
        return Effect.succeed(ReportSection.make({
          id: selection.id,
          ordinal,
          heading: selection.heading,
          revisions: [generatedRevision(
            selection.revisionId,
            renderFindingContent(bounded),
            `${input.idempotencyKey}:section:${ordinal}`,
            input.runId,
            input.model,
            input.promptVersion,
            input.occurredAt,
          )],
          currentRevision: 0,
          findingIds: selection.findingIds,
          claimIds: bounded.flatMap((finding) =>
            finding.claims.map((claim) => claim.id)),
          lastRegenerationKey: null,
        }))
      },
    )
    const sourceVersionIds = [
      ...new Set(findings.flatMap((finding) => finding.sourceVersionIds)),
    ]
    return yield* Schema.decodeUnknown(Schema.typeSchema(Report))({
      id: input.id,
      workspaceId: input.workspaceId,
      projectId: input.projectId,
      runId: input.runId,
      sourceVersionIds,
      findingIds: findings.map((finding) => finding.id),
      titleRevisions: [generatedRevision(
        input.titleRevisionId,
        input.title,
        `${input.idempotencyKey}:title`,
        input.runId,
        input.model,
        input.promptVersion,
        input.occurredAt,
      )],
      currentTitleRevision: 0,
      claims,
      sections,
      revision: 0,
      publicationState: 'draft',
      supersededBy: null,
      lastPublicationKey: null,
      createdAt: input.occurredAt,
      updatedAt: input.occurredAt,
    })
  },
)

export const addReportSection = Effect.fn('ReportComposition.addSection')(
  function* (
    report: Report,
    finding: Finding,
    input: AddReportSectionInput,
  ) {
    if (report.revision !== input.expectedReportRevision) {
      return yield* new StaleReportRevisionError({
        reportId: report.id,
        expectedRevision: input.expectedReportRevision,
        actualRevision: report.revision,
        message: 'Report revision changed before adding the section',
      })
    }
    if (
      finding.workspaceId !== report.workspaceId
      || finding.projectId !== report.projectId
    ) {
      return yield* new ReportCompositionError({
        reportId: report.id,
        reason: 'scope-mismatch',
        message: 'The finding does not belong to the report scope',
      })
    }
    const existingClaims = new Set(report.claims.map((claim) => claim.id))
    if (finding.claims.some((claim) => existingClaims.has(claim.id))) {
      return yield* new ReportCompositionError({
        reportId: report.id,
        reason: 'duplicate-claim',
        message: 'The finding is already represented by this report',
      })
    }
    const section = ReportSection.make({
      id: input.sectionId,
      ordinal: report.sections.length,
      heading: input.heading,
      revisions: [generatedRevision(
        input.revisionId,
        renderFindingContent([finding]),
        input.idempotencyKey,
        report.runId,
        input.model,
        input.promptVersion,
        input.occurredAt,
      )],
      currentRevision: 0,
      findingIds: [finding.id],
      claimIds: finding.claims.map((claim) => claim.id),
      lastRegenerationKey: null,
    })
    return Report.make({
      ...report,
      sourceVersionIds: [
        ...new Set([...report.sourceVersionIds, ...finding.sourceVersionIds]),
      ],
      findingIds: [...report.findingIds, finding.id],
      claims: [...report.claims, ...finding.claims],
      sections: [...report.sections, section],
      revision: report.revision + 1,
      publicationState: 'draft',
      lastPublicationKey: null,
      updatedAt: input.occurredAt,
    })
  },
)

export const reorderReportSections = Effect.fn(
  'ReportComposition.reorderSections',
)(function* (
  report: Report,
  orderedIds: ReadonlyArray<typeof ReportSectionId.Type>,
  expectedRevision: number,
  occurredAt: bigint,
) {
  if (report.revision !== expectedRevision) {
    return yield* new StaleReportRevisionError({
      reportId: report.id,
      expectedRevision,
      actualRevision: report.revision,
      message: 'Report revision changed before reordering sections',
    })
  }
  const byId = new Map(report.sections.map((section) => [section.id, section]))
  if (
    orderedIds.length !== report.sections.length
    || new Set(orderedIds).size !== orderedIds.length
    || orderedIds.some((id) => !byId.has(id))
  ) {
    return yield* new ReportCompositionError({
      reportId: report.id,
      reason: 'invalid-order',
      message: 'The section order must name every section exactly once',
    })
  }
  const sections = yield* Effect.forEach(orderedIds, (id, ordinal) => {
    const section = byId.get(id)
    if (section === undefined) {
      return Effect.fail(new ReportCompositionError({
        reportId: report.id,
        reason: 'invalid-order',
        message: 'The section order includes an unknown section',
      }))
    }
    return Effect.succeed(ReportSection.make({ ...section, ordinal }))
  })
  return Report.make({
    ...report,
    sections,
    revision: report.revision + 1,
    publicationState: 'draft',
    lastPublicationKey: null,
    updatedAt: occurredAt,
  })
})

export const removeReportSection = Effect.fn('ReportComposition.removeSection')(
  function* (
    report: Report,
    sectionId: typeof ReportSectionId.Type,
    remainingFindings: ReadonlyArray<Finding>,
    expectedRevision: number,
    occurredAt: bigint,
  ) {
    if (report.revision !== expectedRevision) {
      return yield* new StaleReportRevisionError({
        reportId: report.id,
        expectedRevision,
        actualRevision: report.revision,
        message: 'Report revision changed before removing the section',
      })
    }
    const removed = report.sections.find((section) => section.id === sectionId)
    if (removed === undefined) {
      return yield* new ReportCompositionError({
        reportId: report.id,
        reason: 'section-not-found',
        message: 'The report section does not exist',
      })
    }
    if (report.sections.length === 1) {
      return yield* new ReportCompositionError({
        reportId: report.id,
        reason: 'last-section',
        message: 'A report must retain at least one section',
      })
    }
    const removedClaims = new Set(removed.claimIds)
    const removedFindings = new Set(removed.findingIds)
    const retainedSections = report.sections.filter(
      (section) => section.id !== sectionId,
    )
    const retainedFindingIds = report.findingIds.filter(
      (findingId) => !removedFindings.has(findingId),
    )
    const suppliedFindingIds = new Set(
      remainingFindings.map((finding) => finding.id),
    )
    if (
      retainedSections.flatMap((section) => section.findingIds).length
      !== retainedFindingIds.length
      || remainingFindings.length !== retainedFindingIds.length
      || suppliedFindingIds.size !== retainedFindingIds.length
      || retainedFindingIds.some((findingId) =>
        !suppliedFindingIds.has(findingId))
      || remainingFindings.some((finding) =>
        finding.workspaceId !== report.workspaceId
        || finding.projectId !== report.projectId)
    ) {
      return yield* new ReportCompositionError({
        reportId: report.id,
        reason: 'claim-allocation',
        message: 'The report section-to-finding allocation is malformed',
      })
    }
    return Report.make({
      ...report,
      findingIds: retainedFindingIds,
      sourceVersionIds: [
        ...new Set(remainingFindings.flatMap(
          (finding) => finding.sourceVersionIds,
        )),
      ],
      claims: report.claims.filter((claim) => !removedClaims.has(claim.id)),
      sections: retainedSections
        .map((section, ordinal) => ReportSection.make({ ...section, ordinal })),
      revision: report.revision + 1,
      publicationState: 'draft',
      lastPublicationKey: null,
      updatedAt: occurredAt,
    })
  },
)

export const editReportSection = Effect.fn('ReportComposition.editSection')(
  function* (report: Report, input: EditReportSectionInput) {
    return yield* regenerateReportSection(report, {
      sectionId: input.sectionId,
      revisionId: input.revisionId,
      expectedReportRevision: input.expectedReportRevision,
      idempotencyKey: input.idempotencyKey,
      content: input.content,
      authorship: { kind: 'user', actorId: input.actorId },
      occurredAt: input.occurredAt,
    })
  },
)
