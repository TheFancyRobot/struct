import { Effect, Schema } from 'effect'
import { CitationId } from './branded-ids.js'

const NonBlank = Schema.String.pipe(
  Schema.minLength(1),
  Schema.maxLength(2_048),
  Schema.filter((value) => value.trim().length > 0 || 'must not be blank'),
)
const Revision = Schema.Number.pipe(Schema.int(), Schema.nonNegative())

/**
 * Claim-level citation lifecycle. The walking-skeleton CitationStatus remains
 * the validation result for a raw research-run citation; this state is the
 * durable publication lifecycle of an evidence binding.
 */
export const CitationState = Schema.Literal(
  'draft',
  'valid',
  'stale',
  'broken',
  'unauthorized',
  'incompatible',
  'superseded',
  'publishable',
)
export type CitationState = Schema.Schema.Type<typeof CitationState>

export const CitationLifecycle = Schema.Struct({
  citationId: CitationId,
  state: CitationState,
  revision: Revision,
  supersededBy: Schema.NullOr(CitationId),
  lastIdempotencyKey: Schema.NullOr(NonBlank),
  updatedAt: Schema.BigIntFromNumber,
}).pipe(
  Schema.filter((citation) => [
    citation.supersededBy === citation.citationId
      ? 'a citation cannot supersede itself'
      : undefined,
    citation.state === 'superseded' && citation.supersededBy === null
      ? 'a superseded citation requires a replacement'
      : undefined,
    citation.state !== 'superseded' && citation.supersededBy !== null
      ? 'only a superseded citation may identify a replacement'
      : undefined,
  ]),
)
export type CitationLifecycle = Schema.Schema.Type<typeof CitationLifecycle>

export const CitationTransition = Schema.Struct({
  expectedRevision: Revision,
  idempotencyKey: NonBlank,
  to: CitationState,
  replacementCitationId: Schema.NullOr(CitationId),
  occurredAt: Schema.BigIntFromNumber,
})
export type CitationTransition = Schema.Schema.Type<typeof CitationTransition>

export class StaleCitationRevisionError
  extends Schema.TaggedError<StaleCitationRevisionError>()(
    'StaleCitationRevisionError',
    {
      citationId: CitationId,
      expectedRevision: Revision,
      actualRevision: Revision,
      message: Schema.String,
    },
  ) {}

export class IllegalCitationTransitionError
  extends Schema.TaggedError<IllegalCitationTransitionError>()(
    'IllegalCitationTransitionError',
    {
      citationId: CitationId,
      from: CitationState,
      to: CitationState,
      message: Schema.String,
    },
  ) {}

export class CitationSupersessionCycleError
  extends Schema.TaggedError<CitationSupersessionCycleError>()(
    'CitationSupersessionCycleError',
    {
      citationId: CitationId,
      message: Schema.String,
    },
  ) {}

export class CitationSupersessionTargetError
  extends Schema.TaggedError<CitationSupersessionTargetError>()(
    'CitationSupersessionTargetError',
    {
      citationId: CitationId,
      replacementCitationId: CitationId,
      message: Schema.String,
    },
  ) {}

export class CitationIdempotencyConflictError
  extends Schema.TaggedError<CitationIdempotencyConflictError>()(
    'CitationIdempotencyConflictError',
    {
      citationId: CitationId,
      idempotencyKey: NonBlank,
      message: Schema.String,
    },
  ) {}

const LEGAL_TRANSITIONS: Readonly<Record<CitationState, ReadonlySet<CitationState>>> = {
  draft: new Set(['valid', 'broken', 'unauthorized', 'incompatible']),
  valid: new Set(['stale', 'broken', 'unauthorized', 'incompatible', 'publishable', 'superseded']),
  stale: new Set(['valid', 'broken', 'unauthorized', 'incompatible', 'superseded']),
  broken: new Set(['valid', 'superseded']),
  unauthorized: new Set(['valid', 'superseded']),
  incompatible: new Set(['valid', 'superseded']),
  publishable: new Set(['stale', 'broken', 'unauthorized', 'incompatible', 'superseded']),
  superseded: new Set(),
}

export const transitionCitationState = Effect.fn('CitationState.transition')(
  function* (
    current: CitationLifecycle,
    transition: CitationTransition,
  ) {
    if (
      current.lastIdempotencyKey === transition.idempotencyKey
      && current.state === transition.to
      && current.supersededBy === transition.replacementCitationId
      && current.updatedAt === transition.occurredAt
      && transition.expectedRevision === current.revision - 1
    ) {
      return current
    }
    if (current.lastIdempotencyKey === transition.idempotencyKey) {
      return yield* new CitationIdempotencyConflictError({
        citationId: current.citationId,
        idempotencyKey: transition.idempotencyKey,
        message: 'Idempotency key was already used for a different transition',
      })
    }
    if (current.revision !== transition.expectedRevision) {
      return yield* new StaleCitationRevisionError({
        citationId: current.citationId,
        expectedRevision: transition.expectedRevision,
        actualRevision: current.revision,
        message: 'Citation revision changed before the transition was applied',
      })
    }
    if (!LEGAL_TRANSITIONS[current.state].has(transition.to)) {
      return yield* new IllegalCitationTransitionError({
        citationId: current.citationId,
        from: current.state,
        to: transition.to,
        message: 'Citation lifecycle transition is not legal',
      })
    }
    if (
      (transition.to === 'superseded')
      !== (transition.replacementCitationId !== null)
    ) {
      return yield* new IllegalCitationTransitionError({
        citationId: current.citationId,
        from: current.state,
        to: transition.to,
        message: 'Only supersession transitions accept a replacement citation',
      })
    }
    if (transition.replacementCitationId === current.citationId) {
      return yield* new CitationSupersessionCycleError({
        citationId: current.citationId,
        message: 'A citation cannot supersede itself',
      })
    }
    return CitationLifecycle.make({
      ...current,
      state: transition.to,
      revision: current.revision + 1,
      supersededBy: transition.replacementCitationId,
      lastIdempotencyKey: transition.idempotencyKey,
      updatedAt: transition.occurredAt,
    })
  },
)

export const validateCitationSupersession = Effect.fn(
  'CitationState.validateSupersession',
)(function* (citations: ReadonlyArray<CitationLifecycle>) {
  const byId = new Map(citations.map((citation) => [citation.citationId, citation]))
  for (const citation of citations) {
    const visited = new Set<CitationId>()
    let cursor: CitationLifecycle | undefined = citation
    while (cursor?.supersededBy !== null && cursor !== undefined) {
      if (visited.has(cursor.citationId)) {
        return yield* new CitationSupersessionCycleError({
          citationId: cursor.citationId,
          message: 'Citation supersession graph contains a cycle',
        })
      }
      visited.add(cursor.citationId)
      const replacement = byId.get(cursor.supersededBy)
      if (replacement === undefined) {
        return yield* new CitationSupersessionTargetError({
          citationId: cursor.citationId,
          replacementCitationId: cursor.supersededBy,
          message: 'Citation supersession target does not exist',
        })
      }
      cursor = replacement
    }
  }
  return citations
})
