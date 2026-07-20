/* eslint-disable no-unused-vars -- Babel's parser does not mark type-only imports as used. */
import {
  CrossSourceEvidence,
  CrossSourceMismatch,
  CrossSourceReconciliationId,
  CrossSourceReconciliationResult,
  Sha256Digest,
  type CrossSourceReconciliationResult as typeCrossSourceReconciliationResult,
} from '@struct/domain'
import {
  BoundedQueryResultSummary,
  ResultSummaryLimits,
  summarizeQueryResult,
} from '@struct/data-engine'
/* eslint-enable no-unused-vars */
import { Effect, Schema } from 'effect'
import { computeCrossSourceEvidenceId } from './normalize-evidence.js'
import { computeCrossSourceReconciliationId } from './reconcile-findings.js'
import {
  HybridSynthesisClaimDraft,
  hybridSynthesisFailure,
  validateHybridSynthesisClaim,
} from './quantitative-guardrails.js'

const NonBlank = Schema.String.pipe(
  Schema.minLength(1),
  Schema.filter((value) => value.trim().length > 0 || 'must not be blank'),
)

export const HybridSynthesisLimits = Schema.Struct({
  resultSummary: ResultSummaryLimits,
  maximumClaims: Schema.Number.pipe(Schema.int(), Schema.between(1, 64)),
  maximumOutputBytes: Schema.Number.pipe(
    Schema.int(),
    Schema.between(1, 262_144),
  ),
})
export type HybridSynthesisLimits =
  Schema.Schema.Type<typeof HybridSynthesisLimits>

export const HybridSynthesisPrompt = Schema.Struct({
  reconciliationId: CrossSourceReconciliationId,
  claimSignature: Sha256Digest,
  status: Schema.Literal('aligned', 'disclosed-mismatch'),
  evidence: Schema.Array(CrossSourceEvidence).pipe(
    Schema.minItems(1),
    Schema.maxItems(512),
  ),
  querySummaries: Schema.Array(BoundedQueryResultSummary).pipe(
    Schema.maxItems(80),
  ),
  mismatches: Schema.Array(CrossSourceMismatch).pipe(Schema.maxItems(16)),
  limitations: Schema.Array(NonBlank).pipe(Schema.maxItems(128)),
})
export type HybridSynthesisPrompt =
  Schema.Schema.Type<typeof HybridSynthesisPrompt>

export const HybridSynthesisDraft = Schema.Struct({
  reconciliationId: CrossSourceReconciliationId,
  claimSignature: Sha256Digest,
  claims: Schema.Array(HybridSynthesisClaimDraft).pipe(
    Schema.minItems(1),
    Schema.maxItems(64),
  ),
})
export type HybridSynthesisDraft =
  Schema.Schema.Type<typeof HybridSynthesisDraft>

export const ValidatedHybridSynthesis = Schema.Struct({
  reconciliationId: CrossSourceReconciliationId,
  claimSignature: Sha256Digest,
  reconciliationStatus: Schema.Literal('aligned', 'disclosed-mismatch'),
  answer: NonBlank,
  claims: Schema.Array(HybridSynthesisClaimDraft).pipe(
    Schema.minItems(1),
    Schema.maxItems(64),
  ),
  evidence: Schema.Array(CrossSourceEvidence).pipe(
    Schema.minItems(1),
    Schema.maxItems(512),
  ),
  querySummaries: Schema.Array(BoundedQueryResultSummary).pipe(
    Schema.maxItems(80),
  ),
  mismatches: Schema.Array(CrossSourceMismatch).pipe(Schema.maxItems(16)),
  limitations: Schema.Array(NonBlank).pipe(Schema.maxItems(128)),
})
export type ValidatedHybridSynthesis =
  Schema.Schema.Type<typeof ValidatedHybridSynthesis>

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
  if (typeof value === 'bigint') return JSON.stringify(`${value}n`)
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

function validateReconciliationIdentity(
  reconciliation: typeCrossSourceReconciliationResult,
) {
  if (
    reconciliation.id !== computeCrossSourceReconciliationId(reconciliation)
  ) {
    return Effect.fail(hybridSynthesisFailure(
      'stale-identity',
      'reconciliation.id',
      'Reconciliation identity does not match its canonical evidence',
    ))
  }
  return Effect.void
}

export const prepareHybridSynthesis = Effect.fn(
  'HybridSynthesis.prepare',
)(function* (
  rawReconciliation: typeCrossSourceReconciliationResult,
  rawLimits: HybridSynthesisLimits,
) {
  const reconciliation = yield* Schema.decodeUnknown(
    Schema.typeSchema(CrossSourceReconciliationResult),
  )(rawReconciliation).pipe(Effect.mapError(() =>
    hybridSynthesisFailure(
      'malformed',
      'reconciliation',
      'Cross-source reconciliation is invalid',
    )))
  const limits = yield* Schema.decodeUnknown(
    Schema.typeSchema(HybridSynthesisLimits),
  )(rawLimits).pipe(Effect.mapError(() =>
    hybridSynthesisFailure(
      'malformed',
      'limits',
      'Hybrid synthesis limits are invalid',
    )))
  yield* validateReconciliationIdentity(reconciliation)
  const evidenceIds = new Set(reconciliation.evidence.map((item) => item.id))
  if (
    evidenceIds.size !== reconciliation.evidence.length
    || reconciliation.evidence.some((item) =>
      item.id !== computeCrossSourceEvidenceId(item))
  ) {
    return yield* hybridSynthesisFailure(
      'stale-identity',
      'reconciliation.evidence',
      'Reconciliation evidence identities do not match their canonical payloads',
    )
  }
  if (
    reconciliation.status !== 'aligned'
    && reconciliation.status !== 'disclosed-mismatch'
  ) {
    return yield* hybridSynthesisFailure(
      'unapproved-reconciliation',
      'reconciliation.status',
      'Only aligned or explicitly disclosed evidence may be synthesized',
    )
  }
  const querySummaries = yield* Effect.forEach(
    reconciliation.evidence,
    (item) =>
      item.payload.kind === 'dataset'
        ? summarizeQueryResult(
          item.payload.evidence,
          limits.resultSummary,
        ).pipe(Effect.mapError((error) =>
          hybridSynthesisFailure(
            error.reason === 'result-too-large'
              ? 'output-too-large'
              : 'malformed',
            `evidence.${item.id}`,
            error.message,
          )))
        : Effect.succeed(null),
  ).pipe(Effect.map((summaries) =>
    summaries.filter(
      (summary): summary is typeof BoundedQueryResultSummary.Type =>
        summary !== null,
    ).sort((left, right) =>
      compareUtf8(left.summaryHash, right.summaryHash)
    )))
  return yield* Schema.decodeUnknown(
    Schema.typeSchema(HybridSynthesisPrompt),
  )({
    reconciliationId: reconciliation.id,
    claimSignature: reconciliation.claimSignature,
    status: reconciliation.status,
    evidence: reconciliation.evidence,
    querySummaries,
    mismatches: reconciliation.mismatches,
    limitations: reconciliation.limitations,
  }).pipe(Effect.mapError(() =>
    hybridSynthesisFailure(
      'malformed',
      'prompt',
      'Hybrid synthesis prompt is invalid',
    )))
})

function renderedAnswer(
  claims: ReadonlyArray<typeof HybridSynthesisClaimDraft.Type>,
  limitations: ReadonlyArray<string>,
): string {
  const narrative = claims.map((claim) => claim.text).join('\n\n')
  return limitations.length === 0
    ? narrative
    : `${narrative}\n\nLimitations:\n${
      limitations.map((limitation) => `- ${limitation}`).join('\n')
    }`
}

export const validateHybridSynthesis = Effect.fn(
  'HybridSynthesis.validate',
)(function* (
  prompt: HybridSynthesisPrompt,
  rawDraft: HybridSynthesisDraft,
  rawLimits: HybridSynthesisLimits,
) {
  const decodedPrompt = yield* Schema.decodeUnknown(
    Schema.typeSchema(HybridSynthesisPrompt),
  )(prompt).pipe(Effect.mapError(() =>
    hybridSynthesisFailure(
      'malformed',
      'prompt',
      'Hybrid synthesis prompt is invalid',
    )))
  const draft = yield* Schema.decodeUnknown(
    Schema.typeSchema(HybridSynthesisDraft),
  )(rawDraft).pipe(Effect.mapError(() =>
    hybridSynthesisFailure(
      'malformed',
      'draft',
      'Hybrid synthesis draft is invalid',
    )))
  const limits = yield* Schema.decodeUnknown(
    Schema.typeSchema(HybridSynthesisLimits),
  )(rawLimits).pipe(Effect.mapError(() =>
    hybridSynthesisFailure(
      'malformed',
      'limits',
      'Hybrid synthesis limits are invalid',
    )))
  const replayedPrompt = yield* prepareHybridSynthesis({
    id: decodedPrompt.reconciliationId,
    claimSignature: decodedPrompt.claimSignature,
    status: decodedPrompt.status,
    evidence: decodedPrompt.evidence,
    mismatches: decodedPrompt.mismatches,
    conflicts: [],
    limitations: decodedPrompt.limitations,
  }, limits)
  const encodePrompt = Schema.encodeSync(HybridSynthesisPrompt)
  if (
    JSON.stringify(encodePrompt(decodedPrompt))
      !== JSON.stringify(encodePrompt(replayedPrompt))
  ) {
    return yield* hybridSynthesisFailure(
      'stale-identity',
      'prompt',
      'Hybrid synthesis prompt does not match its canonical reconciliation and query summaries',
    )
  }
  if (
    draft.reconciliationId !== decodedPrompt.reconciliationId
    || draft.claimSignature !== decodedPrompt.claimSignature
  ) {
    return yield* hybridSynthesisFailure(
      'stale-identity',
      'draft',
      'Hybrid synthesis draft belongs to a stale or foreign reconciliation',
    )
  }
  if (draft.claims.length > limits.maximumClaims) {
    return yield* hybridSynthesisFailure(
      'output-too-large',
      'draft.claims',
      'Hybrid synthesis draft exceeds the configured claim limit',
    )
  }
  const evidenceById = new Map(
    decodedPrompt.evidence.map((item) => [item.id, item]),
  )
  const claims = yield* Effect.forEach(
    draft.claims,
    (claim, index) =>
      validateHybridSynthesisClaim(claim, evidenceById, `draft.claims.${index}`),
  )
  const answer = renderedAnswer(claims, decodedPrompt.limitations)
  const result = {
    reconciliationId: decodedPrompt.reconciliationId,
    claimSignature: decodedPrompt.claimSignature,
    reconciliationStatus: decodedPrompt.status,
    answer,
    claims,
    evidence: decodedPrompt.evidence,
    querySummaries: decodedPrompt.querySummaries,
    mismatches: decodedPrompt.mismatches,
    limitations: decodedPrompt.limitations,
  }
  if (
    new TextEncoder().encode(canonicalJson(result)).byteLength
      > limits.maximumOutputBytes
  ) {
    return yield* hybridSynthesisFailure(
      'output-too-large',
      'draft',
      'Validated hybrid synthesis exceeds the configured output byte limit',
    )
  }
  return yield* Schema.decodeUnknown(
    Schema.typeSchema(ValidatedHybridSynthesis),
  )(result).pipe(Effect.mapError(() =>
    hybridSynthesisFailure(
      'malformed',
      'result',
      'Validated hybrid synthesis result is invalid',
    )))
})
