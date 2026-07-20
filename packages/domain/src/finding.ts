import { Effect, Schema } from 'effect'
import {
  ActorId,
  ClaimId,
  ContentRevisionId,
  FindingId,
  ProjectId,
  ResearchRunId,
  SourceVersionId,
  WorkspaceId,
} from './branded-ids.js'
import {
  CrossSourceEvidence,
} from './cross-source-evidence.js'
import { CitationLifecycle } from './citation-state.js'
import { Sha256Digest } from './directory-manifest.js'
import { ResearchFinding } from './research-finding.js'

const NonBlank = Schema.String.pipe(
  Schema.minLength(1),
  Schema.maxLength(65_536),
  Schema.filter((value) => value.trim().length > 0 || 'must not be blank'),
)
const Revision = Schema.Number.pipe(Schema.int(), Schema.nonNegative())

export const RevisionAuthorship = Schema.Union(
  Schema.Struct({
    kind: Schema.Literal('generated'),
    runId: ResearchRunId,
    model: NonBlank,
    promptVersion: NonBlank,
  }),
  Schema.Struct({
    kind: Schema.Literal('user'),
    actorId: ActorId,
  }),
)
export type RevisionAuthorship = Schema.Schema.Type<typeof RevisionAuthorship>

export const ContentRevision = Schema.Struct({
  id: ContentRevisionId,
  revision: Revision,
  content: NonBlank,
  authorship: RevisionAuthorship,
  idempotencyKey: NonBlank,
  createdAt: Schema.BigIntFromNumber,
})
export type ContentRevision = Schema.Schema.Type<typeof ContentRevision>

export const ClaimEvidenceMode = Schema.Literal(
  'document',
  'dataset',
  'recursive',
  'hybrid',
)
export type ClaimEvidenceMode = Schema.Schema.Type<typeof ClaimEvidenceMode>

function evidenceKinds(
  evidence: ReadonlyArray<Schema.Schema.Type<typeof CrossSourceEvidence>>,
): ReadonlySet<string> {
  return new Set(evidence.map((item) => item.payload.kind))
}

export const SupportedClaim = Schema.Struct({
  kind: Schema.Literal('supported'),
  mode: ClaimEvidenceMode,
  evidence: Schema.Array(CrossSourceEvidence).pipe(
    Schema.minItems(1),
    Schema.maxItems(512),
  ),
}).pipe(
  Schema.filter((support) => {
    const kinds = evidenceKinds(support.evidence)
    return [
      new Set(support.evidence.map((item) => item.id)).size
        === support.evidence.length
        ? undefined
        : 'claim evidence identities must be unique',
      support.mode === 'hybrid' && (!kinds.has('document') || !kinds.has('dataset'))
        ? 'hybrid claims require document and dataset evidence'
        : undefined,
      support.mode !== 'hybrid'
        && (kinds.size !== 1 || !kinds.has(support.mode))
        ? `${support.mode} claims may only contain ${support.mode} evidence`
        : undefined,
    ]
  }),
)
export type SupportedClaim = Schema.Schema.Type<typeof SupportedClaim>

export const ClaimSupport = Schema.Union(
  SupportedClaim,
  Schema.Struct({
    kind: Schema.Literal('unsupported'),
    reason: NonBlank,
  }),
)
export type ClaimSupport = Schema.Schema.Type<typeof ClaimSupport>

export const ClaimOrigin = Schema.Union(
  Schema.Struct({
    kind: Schema.Literal('research-finding'),
    finding: ResearchFinding,
  }),
  Schema.Struct({
    kind: Schema.Literal('research-run'),
    runId: ResearchRunId,
  }),
  Schema.Struct({
    kind: Schema.Literal('user'),
    actorId: ActorId,
  }),
)
export type ClaimOrigin = Schema.Schema.Type<typeof ClaimOrigin>

/**
 * Evidence is immutable on the claim. Editing appends text revisions and never
 * copies or rewrites the evidence snapshot.
 */
export const Claim = Schema.Struct({
  id: ClaimId,
  claimSignature: Sha256Digest,
  citation: CitationLifecycle,
  origin: ClaimOrigin,
  revisions: Schema.Array(ContentRevision).pipe(Schema.minItems(1)),
  currentRevision: Revision,
  support: ClaimSupport,
  createdAt: Schema.BigIntFromNumber,
}).pipe(
  Schema.filter((claim) => {
    const revisions = claim.revisions.map((revision) => revision.revision)
    return [
      new Set(claim.revisions.map((revision) => revision.id)).size
        === claim.revisions.length
        ? undefined
        : 'claim revision identities must be unique',
      revisions.every((revision, index) => revision === index)
        ? undefined
        : 'claim revisions must be contiguous and zero-based',
      claim.currentRevision === revisions.length - 1
        ? undefined
        : 'claim currentRevision must identify the latest revision',
      claim.support.kind === 'unsupported'
        && claim.citation.state === 'publishable'
        ? 'unsupported claims cannot be publishable'
        : undefined,
      claim.support.kind === 'supported'
        && claim.support.evidence.some((evidence) => evidence.stance !== 'supports')
        ? 'claim support cannot contain conflicting evidence'
        : undefined,
      claim.support.kind === 'supported'
        && claim.support.evidence.some(
          (evidence) => evidence.claimSignature !== claim.claimSignature,
        )
        ? 'all claim evidence must share the canonical claim signature'
        : undefined,
    ]
  }),
)
export type Claim = Schema.Schema.Type<typeof Claim>

export function claimSourceVersionIds(claim: Claim): ReadonlySet<SourceVersionId> {
  if (claim.support.kind === 'unsupported') return new Set()
  return new Set(claim.support.evidence.flatMap((evidence) => {
    const payload = evidence.payload
    if (payload.kind === 'document') return [payload.sourceVersionId]
    if (payload.kind === 'recursive') return [payload.reference.sourceVersionId]
    return []
  }))
}

export const Finding = Schema.Struct({
  id: FindingId,
  workspaceId: WorkspaceId,
  projectId: ProjectId,
  runId: ResearchRunId,
  sourceVersionIds: Schema.Array(SourceVersionId).pipe(Schema.minItems(1)),
  titleRevisions: Schema.Array(ContentRevision).pipe(Schema.minItems(1)),
  currentRevision: Revision,
  claims: Schema.Array(Claim).pipe(Schema.minItems(1)),
  supersededBy: Schema.NullOr(FindingId),
  createdAt: Schema.BigIntFromNumber,
  updatedAt: Schema.BigIntFromNumber,
}).pipe(
  Schema.filter((finding) => {
    const revisionIds = [
      ...finding.titleRevisions.map((revision) => revision.id),
      ...finding.claims.flatMap((claim) =>
        claim.revisions.map((revision) => revision.id)),
    ]
    return [
      new Set(finding.sourceVersionIds).size === finding.sourceVersionIds.length
      ? undefined
      : 'finding source-version identities must be unique',
    new Set(finding.claims.map((claim) => claim.id)).size === finding.claims.length
      ? undefined
      : 'finding claim identities must be unique',
    finding.titleRevisions.every((revision, index) => revision.revision === index)
      ? undefined
      : 'finding title revisions must be contiguous and zero-based',
    finding.currentRevision === finding.titleRevisions.length - 1
      ? undefined
      : 'finding currentRevision must identify the latest title revision',
    new Set(revisionIds).size === revisionIds.length
      ? undefined
      : 'finding content-revision identities must be unique',
    finding.supersededBy === finding.id
      ? 'a finding cannot supersede itself'
      : undefined,
    finding.claims.every((claim) =>
      [...claimSourceVersionIds(claim)].every(
        (sourceVersionId) => finding.sourceVersionIds.includes(sourceVersionId),
      ))
      ? undefined
      : 'finding claim evidence must remain inside the declared source-version scope',
    ]
  }),
)
export type Finding = Schema.Schema.Type<typeof Finding>

export class FindingSupersessionError
  extends Schema.TaggedError<FindingSupersessionError>()(
    'FindingSupersessionError',
    {
      findingId: FindingId,
      reason: Schema.Literal('cycle', 'dangling-target'),
      message: Schema.String,
    },
  ) {}

export const validateFindingSupersession = Effect.fn(
  'Finding.validateSupersession',
)(function* (findings: ReadonlyArray<Finding>) {
  const byId = new Map(findings.map((finding) => [finding.id, finding]))
  for (const finding of findings) {
    const visited = new Set<FindingId>()
    let cursor: Finding | undefined = finding
    while (cursor !== undefined && cursor.supersededBy !== null) {
      if (visited.has(cursor.id)) {
        return yield* new FindingSupersessionError({
          findingId: cursor.id,
          reason: 'cycle',
          message: 'Finding supersession graph contains a cycle',
        })
      }
      visited.add(cursor.id)
      const replacement = byId.get(cursor.supersededBy)
      if (replacement === undefined) {
        return yield* new FindingSupersessionError({
          findingId: cursor.id,
          reason: 'dangling-target',
          message: 'Finding supersession target does not exist',
        })
      }
      cursor = replacement
    }
  }
  return findings
})
