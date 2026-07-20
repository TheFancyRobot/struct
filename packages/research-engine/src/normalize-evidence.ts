/* eslint-disable no-unused-vars -- Babel's parser does not mark type-only imports as used. */
import {
  CrossSourceEvidence,
  CrossSourceEvidenceId,
  CrossSourceEvidenceInput,
  CrossSourceEvidenceScope,
  CrossSourceEvidenceValidationError,
  type CrossSourceDatasetEvidence,
  type CrossSourceDocumentEvidence,
  type CrossSourceEvidence as typeCrossSourceEvidence,
  type CrossSourceEvidenceInput as typeCrossSourceEvidenceInput,
  type CrossSourceEvidencePayload,
  type CrossSourceEvidenceScope as typeCrossSourceEvidenceScope,
  type CrossSourceSemantics,
  type EvidenceFilter,
} from '@struct/domain'
/* eslint-enable no-unused-vars */
import { Effect, Schema } from 'effect'
import { computeRecursiveEvidenceId } from './aggregation-schema.js'
import { orderCanonicalIdentities } from './aggregation-schema.js'

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

function canonicalValue(value: EvidenceFilter['value']): string {
  if (value === null) return 'null'
  if (typeof value === 'boolean') return `boolean:${String(value)}`
  return `string:${value}`
}

function canonicalFilter(filter: EvidenceFilter): string {
  return `${filter.field}\u0000${filter.operator}\u0000${
    canonicalValue(filter.value)
  }`
}

function canonicalSemantics(
  semantics: CrossSourceSemantics,
): CrossSourceSemantics {
  return {
    ...semantics,
    filters: [...semantics.filters].sort((left, right) =>
      compareUtf8(canonicalFilter(left), canonicalFilter(right))
    ),
    joinKeys: [...semantics.joinKeys].sort(compareUtf8),
  }
}

function encodeDocumentLocator(
  locator: CrossSourceDocumentEvidence['locator'],
): string {
  const parts = [
    `chars:${locator.charStart}-${locator.charEnd}`,
    `bytes:${locator.byteStart}-${locator.byteEnd}`,
  ]
  if (locator.page !== null) parts.unshift(`page:${locator.page}`)
  if (locator.paragraph !== null) parts.unshift(`paragraph:${locator.paragraph}`)
  if (locator.section !== null) {
    parts.unshift(`section:${encodeURIComponent(locator.section)}`)
  }
  return `document:${parts.join(',')}`
}

function digestFields(fields: ReadonlyArray<string>): string {
  const canonical = fields.map((field) => `${field.length}:${field}`).join('')
  return `sha256:${new Bun.CryptoHasher('sha256').update(canonical).digest('hex')}`
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

export function computeCrossSourceEvidenceId(
  input: typeCrossSourceEvidenceInput,
): typeof CrossSourceEvidenceId.Type {
  return CrossSourceEvidenceId.make(digestFields([
    input.claimSignature,
    input.stance,
    canonicalJson(canonicalSemantics(input.semantics)),
    canonicalJson(input.payload),
  ]))
}

function sameRows(
  left: CrossSourceDatasetEvidence['evidence']['rows'],
  right: CrossSourceDatasetEvidence['evidence']['rows'],
): boolean {
  return left.length === right.length
    && left.every((row, rowIndex) =>
      row.length === right[rowIndex]?.length
      && row.every((value, columnIndex) =>
        value === right[rowIndex]?.[columnIndex]))
}

const validateDatasetLineage = Effect.fn(
  'CrossSourceEvidence.validateDatasetLineage',
)(function* (
  payload: CrossSourceDatasetEvidence,
  scope: typeCrossSourceEvidenceScope,
  path: string,
) {
  const { citation, snapshot, columns, rows } = payload.evidence
  if (
    citation.workspaceId !== scope.workspaceId
    || citation.projectId !== scope.projectId
    || snapshot.workspaceId !== scope.workspaceId
    || snapshot.projectId !== scope.projectId
    || !scope.datasetSnapshots.some((authorized) =>
      authorized.datasetId === citation.datasetId
      && authorized.datasetSnapshotId === citation.datasetSnapshotId)
  ) {
    return yield* invalid(
      'invalid-lineage',
      path,
      'Dataset evidence is outside the authorized workspace, project, or snapshot scope',
    )
  }
  const binding = snapshot.snapshots.find((candidate) =>
    candidate.datasetId === citation.datasetId
    && candidate.snapshotId === citation.datasetSnapshotId
  )
  if (
    binding === undefined
    || citation.queryResultSnapshotId !== snapshot.id
    || binding.schemaHash !== citation.schemaHash
    || binding.parquetDigest !== citation.parquetDigest
    || citation.resultHash !== snapshot.resultHash
    || citation.resultArtifactHash !== snapshot.resultArtifactHash
    || citation.canonicalSql !== snapshot.canonicalSql
    || snapshot.truncated
  ) {
    return yield* invalid(
      'invalid-lineage',
      path,
      'Dataset citation does not match its immutable query result',
    )
  }
  const expectedColumns = citation.selectedColumns.map((name) =>
    snapshot.columns.find((column) => column.name === name))
  if (
    expectedColumns.some((column) => column === undefined)
    || expectedColumns.length !== columns.length
    || columns.some((column, index) =>
      column.name !== expectedColumns[index]?.name
      || column.ordinal !== expectedColumns[index]?.ordinal
      || column.type !== expectedColumns[index]?.type)
    || citation.rowEndExclusive > snapshot.rows.length
  ) {
    return yield* invalid(
      'invalid-lineage',
      `${path}.columns`,
      'Dataset citation columns or row range do not match the query result',
    )
  }
  const expectedRows = snapshot.rows
    .slice(citation.rowStart, citation.rowEndExclusive)
    .map((row) => columns.map((column) => row[column.ordinal] ?? null))
  if (!sameRows(rows, expectedRows)) {
    return yield* invalid(
      'invalid-lineage',
      `${path}.rows`,
      'Dataset evidence rows do not exactly match the immutable query result',
    )
  }
})

const validatePayloadLineage = Effect.fn(
  'CrossSourceEvidence.validatePayloadLineage',
)(function* (
  payload: CrossSourceEvidencePayload,
  scope: typeCrossSourceEvidenceScope,
  path: string,
) {
  switch (payload.kind) {
    case 'document':
      if (!scope.sourceVersionIds.includes(payload.sourceVersionId)) {
        return yield* invalid(
          'invalid-lineage',
          `${path}.sourceVersionId`,
          'Document evidence source version is outside the bounded scope',
        )
      }
      if (payload.citationLocator !== encodeDocumentLocator(payload.locator)) {
        return yield* invalid(
          'invalid-lineage',
          `${path}.citationLocator`,
          'Document citation locator does not match its exact range',
        )
      }
      break
    case 'dataset':
      yield* validateDatasetLineage(payload, scope, path)
      break
    case 'recursive':
      if (!scope.sourceVersionIds.includes(payload.reference.sourceVersionId)) {
        return yield* invalid(
          'invalid-lineage',
          `${path}.reference.sourceVersionId`,
          'Recursive evidence source version is outside the bounded scope',
        )
      }
      if (
        payload.reference.id !== computeRecursiveEvidenceId(payload.reference)
      ) {
        return yield* invalid(
          'invalid-identity',
          `${path}.reference.id`,
          'Recursive evidence identity does not match its immutable lineage',
        )
      }
      break
  }
})

export const normalizeCrossSourceEvidence = Effect.fn(
  'CrossSourceEvidence.normalize',
)(function* (
  inputs: ReadonlyArray<typeCrossSourceEvidenceInput>,
  rawScope: typeCrossSourceEvidenceScope,
) {
  const scope = yield* Schema.decodeUnknown(
    Schema.typeSchema(CrossSourceEvidenceScope),
  )(
    rawScope,
  ).pipe(Effect.mapError(() =>
    invalid('malformed', 'scope', 'Cross-source evidence scope is invalid')))
  if (new Set(scope.sourceVersionIds).size !== scope.sourceVersionIds.length) {
    return yield* invalid(
      'malformed',
      'scope.sourceVersionIds',
      'Cross-source evidence scope must not contain duplicate source versions',
    )
  }
  const decoded = yield* Schema.decodeUnknown(
    Schema.Array(Schema.typeSchema(CrossSourceEvidenceInput)).pipe(
      Schema.maxItems(512),
    ),
  )(inputs).pipe(Effect.mapError(() =>
    invalid('malformed', 'evidence', 'Cross-source evidence input is invalid')))

  const byId = new Map<typeof CrossSourceEvidenceId.Type, typeCrossSourceEvidence>()
  for (const [index, item] of decoded.entries()) {
    const normalized = {
      ...item,
      semantics: canonicalSemantics(item.semantics),
      limitations: Array.from(new Set(item.limitations)).sort(compareUtf8),
    }
    yield* validatePayloadLineage(
      normalized.payload,
      scope,
      `evidence.${index}.payload`,
    )
    const evidence = yield* Schema.decodeUnknown(
      Schema.typeSchema(CrossSourceEvidence),
    )({
      ...normalized,
      id: computeCrossSourceEvidenceId(normalized),
    }).pipe(Effect.mapError(() =>
      invalid(
        'malformed',
        `evidence.${index}`,
        'Normalized cross-source evidence is invalid',
      )))
    const existing = byId.get(evidence.id)
    byId.set(evidence.id, existing === undefined
      ? evidence
      : {
          ...existing,
          limitations: Array.from(new Set([
            ...existing.limitations,
            ...evidence.limitations,
          ])).sort(compareUtf8),
        })
  }
  return orderCanonicalIdentities([...byId.keys()])
    .map((id) => byId.get(id)!)
})
