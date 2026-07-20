/* eslint-disable no-unused-vars -- Babel's parser does not mark type-only imports as used. */
import {
  CrossSourceEvidence,
  CrossSourceEvidenceValidationError,
  CrossSourceReconciliationId,
  CrossSourceReconciliationPolicy,
  CrossSourceReconciliationResult,
  Sha256Digest,
  type CrossSourceConflict,
  type CrossSourceEvidence as typeCrossSourceEvidence,
  type CrossSourceMismatch,
  type CrossSourceReconciliationPolicy as typeCrossSourceReconciliationPolicy,
  type CrossSourceReconciliationResult as typeCrossSourceReconciliationResult,
  type CrossSourceSemantics,
} from '@struct/domain'
/* eslint-enable no-unused-vars */
import { Effect, Schema } from 'effect'
import { orderCanonicalIdentities } from './aggregation-schema.js'
import { computeCrossSourceEvidenceId } from './normalize-evidence.js'

type MismatchDimension = CrossSourceMismatch['dimension']

function invalid(
  reason: 'malformed' | 'invalid-identity' | 'invalid-lineage',
  path: string,
  message: string,
) {
  return new CrossSourceEvidenceValidationError({ reason, path, message })
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

function digestFields(fields: ReadonlyArray<string>): string {
  const canonical = fields.map((field) => `${field.length}:${field}`).join('')
  return `sha256:${new Bun.CryptoHasher('sha256').update(canonical).digest('hex')}`
}

function filterValue(value: null | boolean | string): string {
  if (value === null) return 'null'
  if (typeof value === 'boolean') return `boolean:${String(value)}`
  return `string:${value}`
}

function dimensionValue(
  semantics: CrossSourceSemantics,
  dimension: MismatchDimension,
): string {
  switch (dimension) {
    case 'unit':
      return semantics.unit === null
        ? 'not-established'
        : `established:${semantics.unit}`
    case 'time-window':
      return semantics.timeWindow === null
        ? 'not-established'
        : `established:${
          [
            semantics.timeWindow.startInclusive,
            semantics.timeWindow.endExclusive,
            semantics.timeWindow.timezone,
          ].join(' / ')
        }`
    case 'version':
      return semantics.version === null
        ? 'not-established'
        : `established:${semantics.version}`
    case 'filters':
      return semantics.filters.length === 0
        ? 'none'
        : `filters:${
          semantics.filters.map((filter) =>
            `${filter.field}:${filter.operator}:${filterValue(filter.value)}`
          ).join(' & ')
        }`
    case 'cohort':
      return semantics.cohort === null
        ? 'not-established'
        : `established:${semantics.cohort}`
    case 'denominator':
      return semantics.denominator === null
        ? 'not-established'
        : `established:${semantics.denominator}`
    case 'join-keys':
      return semantics.joinKeys.length === 0
        ? 'none'
        : `keys:${semantics.joinKeys.join(' & ')}`
  }
}

const dimensions: ReadonlyArray<MismatchDimension> = [
  'unit',
  'time-window',
  'version',
  'filters',
  'cohort',
  'denominator',
  'join-keys',
]

function findMismatches(
  evidence: ReadonlyArray<typeCrossSourceEvidence>,
): ReadonlyArray<CrossSourceMismatch> {
  return dimensions.flatMap((dimension) => {
    const values = Array.from(new Set(
      evidence.map((item) => dimensionValue(item.semantics, dimension)),
    )).sort(compareUtf8)
    return values.length < 2 ? [] : [{ dimension, values }]
  })
}

function findConflict(
  claimSignature: typeof Sha256Digest.Type,
  evidence: ReadonlyArray<typeCrossSourceEvidence>,
): CrossSourceConflict | undefined {
  const supportingEvidence = orderCanonicalIdentities(
    evidence.filter((item) => item.stance === 'supports')
      .map((item) => item.id),
  )
  const conflictingEvidence = orderCanonicalIdentities(
    evidence.filter((item) => item.stance === 'conflicts')
      .map((item) => item.id),
  )
  return supportingEvidence.length === 0 || conflictingEvidence.length === 0
    ? undefined
    : { claimSignature, supportingEvidence, conflictingEvidence }
}

export function computeCrossSourceReconciliationId(
  result: Omit<typeCrossSourceReconciliationResult, 'id' | 'limitations'>,
): typeof CrossSourceReconciliationId.Type {
  return CrossSourceReconciliationId.make(digestFields([
    result.claimSignature,
    result.status,
    ...result.evidence.map((item) => item.id),
    ...result.mismatches.flatMap((mismatch) => [
      mismatch.dimension,
      ...mismatch.values,
    ]),
    ...result.conflicts.flatMap((conflict) => [
      ...conflict.supportingEvidence,
      ...conflict.conflictingEvidence,
    ]),
  ]))
}

export const reconcileCrossSourceEvidence = Effect.fn(
  'CrossSourceEvidence.reconcile',
)(function* (
  claimSignature: typeof Sha256Digest.Type,
  rawEvidence: ReadonlyArray<typeCrossSourceEvidence>,
  rawPolicy: typeCrossSourceReconciliationPolicy,
) {
  const policy = yield* Schema.decodeUnknown(
    Schema.typeSchema(CrossSourceReconciliationPolicy),
  )(
    rawPolicy,
  ).pipe(Effect.mapError(() =>
    invalid(
      'malformed',
      'policy',
      'Cross-source reconciliation policy is invalid',
    )))
  const evidence = yield* Schema.decodeUnknown(
    Schema.Array(Schema.typeSchema(CrossSourceEvidence)).pipe(
      Schema.maxItems(512),
    ),
  )(rawEvidence).pipe(Effect.mapError(() =>
    invalid(
      'malformed',
      'evidence',
      'Cross-source reconciliation evidence is invalid',
    )))
  const byId = new Map(evidence.map((item) => [item.id, item]))
  if (byId.size !== evidence.length) {
    return yield* invalid(
      'invalid-identity',
      'evidence',
      'Cross-source reconciliation evidence identities must be unique',
    )
  }
  for (const [index, item] of evidence.entries()) {
    if (item.claimSignature !== claimSignature) {
      return yield* invalid(
        'invalid-lineage',
        `evidence.${index}.claimSignature`,
        'Cross-source evidence belongs to a different semantic claim',
      )
    }
    if (item.id !== computeCrossSourceEvidenceId(item)) {
      return yield* invalid(
        'invalid-identity',
        `evidence.${index}.id`,
        'Cross-source evidence identity does not match its canonical payload',
      )
    }
  }
  const canonicalEvidence = orderCanonicalIdentities([...byId.keys()])
    .map((id) => byId.get(id)!)
  const availableKinds = new Set(
    canonicalEvidence.map((item) => item.payload.kind),
  )
  const missingKinds = policy.requiredEvidenceKinds
    .filter((kind) => !availableKinds.has(kind))
    .sort(compareUtf8)
  const authorizedJoinKeys = new Set(policy.authorizedJoinKeys)
  const unsupportedJoinKeys = Array.from(new Set(
    canonicalEvidence.flatMap((item) =>
      item.semantics.joinKeys.filter((key) => !authorizedJoinKeys.has(key))),
  )).sort(compareUtf8)
  const mismatches = findMismatches(canonicalEvidence)
  const conflict = findConflict(claimSignature, canonicalEvidence)
  const status = unsupportedJoinKeys.length > 0
    ? 'rejected' as const
    : conflict !== undefined
      ? 'contradictory' as const
      : missingKinds.length > 0
        ? 'insufficient' as const
        : mismatches.length > 0
          ? 'disclosed-mismatch' as const
          : 'aligned' as const
  const limitations = Array.from(new Set([
    ...canonicalEvidence.flatMap((item) => item.limitations),
    ...missingKinds.map((kind) => `Missing required ${kind} evidence.`),
    ...unsupportedJoinKeys.map((key) => `Unsupported join key: ${key}.`),
    ...mismatches.map((mismatch) =>
      `Evidence does not align on ${mismatch.dimension}.`),
    ...(conflict === undefined
      ? []
      : ['Evidence both supports and conflicts with the claim.']),
  ])).sort(compareUtf8)
  const withoutId = {
    claimSignature,
    status,
    evidence: canonicalEvidence,
    mismatches,
    conflicts: conflict === undefined ? [] : [conflict],
  }
  return yield* Schema.decodeUnknown(
    Schema.typeSchema(CrossSourceReconciliationResult),
  )({
    ...withoutId,
    id: computeCrossSourceReconciliationId(withoutId),
    limitations,
  }).pipe(Effect.mapError(() =>
    invalid(
      'malformed',
      'result',
      'Cross-source reconciliation result is invalid',
    )))
})
