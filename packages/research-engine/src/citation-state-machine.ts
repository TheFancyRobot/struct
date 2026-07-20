import {
  CitationPublicationGate,
} from '@struct/domain'
/* eslint-disable no-unused-vars -- Babel does not mark type-only imports as used. */
import type {
  ClaimId,
  ProvenanceGraph,
  ReportId,
} from '@struct/domain'
/* eslint-enable no-unused-vars */
import { Effect, Schema } from 'effect'

export class CitationPublicationBlocked
  extends Schema.TaggedError<CitationPublicationBlocked>()(
    'CitationPublicationBlocked',
    {
      gate: CitationPublicationGate,
      message: Schema.String,
    },
  ) {}

export const citationPublicationGate = Effect.fn(
  'CitationStateMachine.publicationGate',
)(function* (
  reportId: typeof ReportId.Type,
  reportRevision: number,
  requiredClaimIds: ReadonlyArray<typeof ClaimId.Type>,
  graph: ProvenanceGraph,
) {
  const graphClaimIds = graph.edges
    .filter((edge) => edge.kind === 'report-claim')
    .map((edge) => edge.claimId)
  const supplied = new Set(requiredClaimIds)
  const canonical = new Set(graphClaimIds)
  const invalidClaimSet = supplied.size !== requiredClaimIds.length
    || canonical.size !== graphClaimIds.length
    || supplied.size !== canonical.size
    || requiredClaimIds.some((claimId) => !canonical.has(claimId))
  const blockingClaimIds = invalidClaimSet
    ? [...new Set([...graphClaimIds, ...requiredClaimIds])]
    : requiredClaimIds.filter((claimId) =>
    {
      if (
        graph.reportId !== reportId
        || graph.reportRevision !== reportRevision
      ) return true
      const requiredEdges = graph.edges.filter((edge) =>
        edge.claimId === claimId)
      const reportClaims = requiredEdges.filter((edge) =>
        edge.kind === 'report-claim')
      const origins = requiredEdges.filter((edge) =>
        edge.kind === 'claim-recursive-finding'
        || edge.kind === 'claim-run-output'
        || edge.kind === 'claim-user-origin')
      const reportClaim = reportClaims[0]
      const evidence = requiredEdges.filter((edge) =>
        edge.kind === 'evidence-document'
        || edge.kind === 'evidence-dataset'
        || edge.kind === 'evidence-recursive')
      if (
        reportClaims.length !== 1
        || origins.length !== 1
        || reportClaim === undefined
        || reportClaim.evidenceMode === null
        || evidence.length !== reportClaim.expectedEvidenceCount
      ) return true
      return requiredEdges.some((edge) => {
        const facts = graph.validations.filter((fact) =>
          fact.claimId === claimId && fact.edgeId === edge.id)
        return facts.length !== 1 || facts[0]?.status !== 'valid'
      })
    })
  return yield* Effect.succeed(CitationPublicationGate.make({
    reportId,
    reportRevision,
    allowed: blockingClaimIds.length === 0,
    blockingClaimIds,
  }))
})

export const requireValidCitationsForPublication = Effect.fn(
  'CitationStateMachine.requireValidForPublication',
)(function* (
  reportId: typeof ReportId.Type,
  reportRevision: number,
  requiredClaimIds: ReadonlyArray<typeof ClaimId.Type>,
  graph: ProvenanceGraph,
) {
  const gate = yield* citationPublicationGate(
    reportId,
    reportRevision,
    requiredClaimIds,
    graph,
  )
  if (!gate.allowed) {
    return yield* new CitationPublicationBlocked({
      gate,
      message: 'Required citations are not valid',
    })
  }
  return gate
})
