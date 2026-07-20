/* eslint-disable no-unused-vars -- Babel's parser does not mark type-only imports as used. */
import {
  CrossSourceEvidence,
  CrossSourceEvidenceId,
  CrossSourceSemantics,
  DatasetCitationId,
  type CrossSourceEvidence as typeCrossSourceEvidence,
  type CrossSourceSemantics as typeCrossSourceSemantics,
} from '@struct/domain'
/* eslint-enable no-unused-vars */
import { Effect, Schema } from 'effect'

const NonBlank = Schema.String.pipe(
  Schema.minLength(1),
  Schema.maxLength(4_096),
  Schema.filter((value) => value.trim().length > 0 || 'must not be blank'),
)

export const HybridSynthesisClaimDraft = Schema.Struct({
  text: NonBlank,
  evidenceIds: Schema.Array(CrossSourceEvidenceId).pipe(
    Schema.minItems(1),
    Schema.maxItems(64),
  ),
  datasetCitationIds: Schema.Array(DatasetCitationId).pipe(
    Schema.maxItems(80),
  ),
  semantics: CrossSourceSemantics,
})
export type HybridSynthesisClaimDraft =
  Schema.Schema.Type<typeof HybridSynthesisClaimDraft>

export class HybridSynthesisValidationError
  extends Schema.TaggedError<HybridSynthesisValidationError>()(
    'HybridSynthesisValidationError',
    {
      reason: Schema.Literal(
        'malformed',
        'unapproved-reconciliation',
        'stale-identity',
        'citation-drift',
        'invented-quantity',
        'semantic-mismatch',
        'untrusted-instruction',
        'output-too-large',
      ),
      path: Schema.String,
      message: Schema.String,
    },
  ) {}

export function hybridSynthesisFailure(
  reason: typeof HybridSynthesisValidationError.Type['reason'],
  path: string,
  message: string,
): HybridSynthesisValidationError {
  return new HybridSynthesisValidationError({ reason, path, message })
}

function compareUtf8(left: string, right: string): number {
  const encoder = new TextEncoder()
  const leftBytes = encoder.encode(left)
  const rightBytes = encoder.encode(right)
  const length = Math.min(leftBytes.length, rightBytes.length)
  for (let index = 0; index < length; index += 1) {
    const difference = leftBytes[index]! - rightBytes[index]!
    if (difference !== 0) return difference
  }
  return leftBytes.length - rightBytes.length
}

function canonicalJson(value: unknown): string {
  if (value === null) return 'null'
  if (
    typeof value === 'boolean'
    || typeof value === 'number'
    || typeof value === 'string'
  ) {
    return JSON.stringify(value)
  }
  if (Array.isArray(value)) {
    return `[${value.map(canonicalJson).join(',')}]`
  }
  if (typeof value === 'object') {
    return `{${Object.keys(value).sort(compareUtf8).map((key) =>
      `${JSON.stringify(key)}:${canonicalJson(Reflect.get(value, key))}`
    ).join(',')}}`
  }
  return JSON.stringify(String(value))
}

/**
 * Matches numeric spellings rather than coercing to Number. This is
 * intentional: `42`, `42.0`, and a 30-digit integer are different facts.
 */
export function exactNumericStrings(value: string): ReadonlyArray<string> {
  return value.match(
    /(?<![\p{L}\p{N}_])[-+]?(?:\d+\.\d+|\d+)(?:[eE][-+]?\d+)?%?(?![\p{L}\p{N}_])/gu,
  ) ?? []
}

function evidenceText(evidence: typeCrossSourceEvidence): string {
  const payload = evidence.payload
  const content = payload.kind === 'dataset'
    ? payload.evidence.rows.flatMap((row) =>
      row.flatMap((value) => typeof value === 'string' ? [value] : [])
    ).join('\n')
    : payload.excerpt
  return `${content}\n${canonicalJson(evidence.semantics)}`
}

const UNTRUSTED_IMPERATIVE =
  /^(?:ignore\b.{0,40}\binstructions?\b|(?:grant|give)\b.{0,24}\b(?:admin|administrator|root)\b|(?:remove|omit|drop|hide)\b.{0,24}\bcitations?\b|(?:raise|set|change)\b.{0,24}\bbudget\b.{0,24}\bunlimited\b)/iu

function containsCopiedUntrustedInstruction(
  claim: string,
  evidence: ReadonlyArray<typeCrossSourceEvidence>,
): boolean {
  const untrustedText = evidence.map(evidenceText).join('\n').toLocaleLowerCase(
    'en-US',
  )
  return claim.split(/[;\n]+/u).map((segment) => segment.trim())
    .filter((segment) => segment.length > 0)
    .some((segment) =>
      UNTRUSTED_IMPERATIVE.test(segment)
      && untrustedText.includes(segment.toLocaleLowerCase('en-US'))
    )
}

function canonicalIds<T extends string>(
  values: ReadonlyArray<T>,
): ReadonlyArray<T> {
  return [...new Set(values)].sort(compareUtf8)
}

export const validateHybridSynthesisClaim = Effect.fn(
  'HybridSynthesis.validateQuantitativeClaim',
)(function* (
  rawClaim: HybridSynthesisClaimDraft,
  evidenceById: ReadonlyMap<string, typeCrossSourceEvidence>,
  path: string,
) {
  const claim = yield* Schema.decodeUnknown(
    Schema.typeSchema(HybridSynthesisClaimDraft),
  )(rawClaim).pipe(Effect.mapError(() =>
    hybridSynthesisFailure(
      'malformed',
      path,
      'Hybrid synthesis claim does not match its typed contract',
    )))
  if (new Set(claim.evidenceIds).size !== claim.evidenceIds.length) {
    return yield* hybridSynthesisFailure(
      'citation-drift',
      `${path}.evidenceIds`,
      'Hybrid synthesis claim evidence identities must be unique',
    )
  }
  if (
    new Set(claim.datasetCitationIds).size
      !== claim.datasetCitationIds.length
  ) {
    return yield* hybridSynthesisFailure(
      'citation-drift',
      `${path}.datasetCitationIds`,
      'Hybrid synthesis dataset citation identities must be unique',
    )
  }
  const cited = claim.evidenceIds.map((id) => evidenceById.get(id))
  if (cited.some((item) => item === undefined)) {
    return yield* hybridSynthesisFailure(
      'citation-drift',
      `${path}.evidenceIds`,
      'Hybrid synthesis claim referenced evidence outside the reconciliation',
    )
  }
  const approvedEvidence = cited.filter(
    (item): item is typeCrossSourceEvidence => item !== undefined,
  )
  const expectedDatasetCitationIds = canonicalIds(
    approvedEvidence.flatMap((item) =>
      item.payload.kind === 'dataset'
        ? [item.payload.evidence.citation.id]
        : []),
  )
  if (
    canonicalIds(claim.datasetCitationIds).join('\u0000')
      !== expectedDatasetCitationIds.join('\u0000')
  ) {
    return yield* hybridSynthesisFailure(
      'citation-drift',
      `${path}.datasetCitationIds`,
      'Dataset citations must exactly match the cited dataset evidence',
    )
  }
  const claimSemantics = canonicalJson(claim.semantics)
  if (
    approvedEvidence.some((item) =>
      canonicalJson(item.semantics) !== claimSemantics)
  ) {
    return yield* hybridSynthesisFailure(
      'semantic-mismatch',
      `${path}.semantics`,
      'A claim cannot conceal unit, denominator, window, filter, cohort, version, or join-key differences',
    )
  }
  const approvedNumbers = new Set(
    approvedEvidence.flatMap((item) =>
      exactNumericStrings(evidenceText(item))),
  )
  if (containsCopiedUntrustedInstruction(claim.text, approvedEvidence)) {
    return yield* hybridSynthesisFailure(
      'untrusted-instruction',
      `${path}.text`,
      'Hybrid synthesis claim contains an instruction from untrusted evidence',
    )
  }
  const invented = exactNumericStrings(claim.text)
    .find((value) => !approvedNumbers.has(value))
  if (invented !== undefined) {
    return yield* hybridSynthesisFailure(
      'invented-quantity',
      `${path}.text`,
      `Hybrid synthesis claim contains an unapproved numeric string: ${invented}`,
    )
  }
  return {
    ...claim,
    evidenceIds: canonicalIds(claim.evidenceIds),
    datasetCitationIds: expectedDatasetCitationIds,
  }
})

export function semanticsEqual(
  left: typeCrossSourceSemantics,
  right: typeCrossSourceSemantics,
): boolean {
  return canonicalJson(left) === canonicalJson(right)
}

export function decodeCrossSourceEvidence(
  value: unknown,
): Effect.Effect<
  typeof CrossSourceEvidence.Type,
  HybridSynthesisValidationError
> {
  return Schema.decodeUnknown(Schema.typeSchema(CrossSourceEvidence))(value)
    .pipe(Effect.mapError(() =>
      hybridSynthesisFailure(
        'malformed',
        'evidence',
        'Hybrid synthesis evidence is invalid',
      )))
}
