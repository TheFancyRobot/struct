/* eslint-disable no-unused-vars -- Babel's parser does not mark type-only imports as used. */
import {
  Sha256Digest,
  SourceVersionId,
  type RecursivePartition,
} from '@struct/domain'
/* eslint-enable no-unused-vars */
import { Effect, Schema } from 'effect'

export type BatchScalar = null | boolean | number | string
export const MAX_BATCH_INPUT_RECORDS = 100_000

export interface BatchEvidenceSource {
  readonly entryKey: string
  readonly sourceVersionId: typeof SourceVersionId.Type
  readonly normalizedPath: string
  readonly schemaFamily: string
  readonly contentDigest: typeof Sha256Digest.Type
  readonly bytes: Uint8Array
}

export interface BatchPredicate {
  readonly field: string
  readonly operator: 'equals' | 'not-equals' | 'exists'
  readonly value?: BatchScalar
}

export interface BatchAggregation {
  readonly name: string
  readonly operation: 'count' | 'sum' | 'minimum' | 'maximum'
  readonly field?: string
}

export interface BatchSelectionPlanInput {
  readonly predicates: ReadonlyArray<BatchPredicate>
  readonly projection: ReadonlyArray<string>
  readonly groupBy: ReadonlyArray<string>
  readonly aggregations: ReadonlyArray<BatchAggregation>
  readonly maximumRecords: number
  readonly maximumGroups: number
}

export interface BatchSelectionPlan extends BatchSelectionPlanInput {
  readonly version: '1'
  readonly id: typeof Sha256Digest.Type
}

export interface SelectedField {
  readonly name: string
  readonly value: BatchScalar
  readonly locator: string
  readonly contentTrust: 'untrusted-source-content'
}

export interface SelectedBatchRecord {
  readonly entryKey: string
  readonly sourceVersionId: typeof SourceVersionId.Type
  readonly normalizedPath: string
  readonly schemaFamily: string
  readonly contentDigest: typeof Sha256Digest.Type
  readonly recordIndex: number
  readonly locator: string
  readonly fields: ReadonlyArray<SelectedField>
  readonly contentTrust: 'untrusted-source-content'
}

export interface BatchAggregateGroup {
  readonly key: ReadonlyArray<{
    readonly field: string
    readonly value: BatchScalar
    readonly contentTrust: 'untrusted-source-content'
  }>
  readonly values: ReadonlyArray<{
    readonly name: string
    readonly value: string | null
    readonly contributors: ReadonlyArray<{
      readonly sourceVersionId: typeof SourceVersionId.Type
      readonly locator: string
      readonly contentTrust: 'untrusted-source-content'
    }>
    readonly truncatedContributors: number
  }>
}

export interface BatchSelectionExclusion {
  readonly entryKey: string
  readonly sourceVersionId: typeof SourceVersionId.Type
  readonly normalizedPath: string
  readonly reason:
    | 'malformed-json'
    | 'unsafe-number'
    | 'unsupported-json-shape'
    | 'partition-mismatch'
  readonly contentTrust: 'untrusted-source-content'
}

export interface BatchSelectionCounts {
  readonly expectedEntries: number
  readonly examinedEntries: number
  readonly excludedEntries: number
  readonly inputRecords: number
  readonly matchedRecords: number
  readonly emittedRecords: number
  readonly truncatedRecords: number
  readonly matchedGroups: number
  readonly emittedGroups: number
  readonly truncatedGroups: number
}

export interface BatchSelectionResult {
  readonly records: ReadonlyArray<SelectedBatchRecord>
  readonly groups: ReadonlyArray<BatchAggregateGroup>
  readonly exclusions: ReadonlyArray<BatchSelectionExclusion>
  readonly counts: BatchSelectionCounts
  readonly truncated: boolean
}

export class BatchSelectionValidationError
  extends Schema.TaggedError<BatchSelectionValidationError>()(
    'BatchSelectionValidationError',
    {
      path: Schema.String,
      reason: Schema.String,
      message: Schema.String,
    },
  ) {}

const encoder = new TextEncoder()
const fatalUtf8Decoder = new TextDecoder('utf-8', { fatal: true })

export function compareCanonicalText(left: string, right: string): number {
  const leftBytes = encoder.encode(left)
  const rightBytes = encoder.encode(right)
  const length = Math.min(leftBytes.length, rightBytes.length)
  for (let index = 0; index < length; index += 1) {
    const difference = leftBytes[index]! - rightBytes[index]!
    if (difference !== 0) return difference
  }
  return leftBytes.length - rightBytes.length
}

export function canonicalJson(value: unknown): string {
  if (value === null) return 'null'
  if (typeof value === 'boolean' || typeof value === 'string') {
    return JSON.stringify(value)
  }
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) {
      throw new TypeError('Canonical JSON numbers must be finite')
    }
    return Object.is(value, -0) ? '0' : JSON.stringify(value)
  }
  if (Array.isArray(value)) {
    return `[${value.map(canonicalJson).join(',')}]`
  }
  if (typeof value === 'object') {
    return `{${Object.entries(value)
      .sort(([left], [right]) => compareCanonicalText(left, right))
      .map(([key, item]) => `${JSON.stringify(key)}:${canonicalJson(item)}`)
      .join(',')}}`
  }
  throw new TypeError('Value is not representable as canonical JSON')
}

function digest(value: unknown): typeof Sha256Digest.Type {
  return Sha256Digest.make(
    `sha256:${new Bun.CryptoHasher('sha256')
      .update(canonicalJson(value))
      .digest('hex')}`,
  )
}

const fieldPattern = /^[A-Za-z_][A-Za-z0-9_.-]{0,127}$/
const namePattern = /^[a-z][a-z0-9_-]{0,62}$/

function invalid(path: string, reason: string, message: string) {
  return new BatchSelectionValidationError({ path, reason, message })
}

function validatePlanInput(
  input: BatchSelectionPlanInput,
): Effect.Effect<void, BatchSelectionValidationError> {
  const fields = [
    ...input.projection,
    ...input.groupBy,
    ...input.predicates.map((item) => item.field),
    ...input.aggregations.flatMap((item) =>
      item.field === undefined ? [] : [item.field]),
  ]
  if (
    input.projection.length > 64
    || input.groupBy.length > 16
    || input.predicates.length > 32
    || input.aggregations.length > 32
  ) {
    return Effect.fail(invalid(
      'plan',
      'limit-exceeded',
      'Batch selection fields, predicates, and aggregations must stay bounded',
    ))
  }
  if (fields.some((field) => !fieldPattern.test(field))) {
    return Effect.fail(invalid(
      'plan.fields',
      'invalid-field',
      'Batch selection fields must use bounded dotted identifiers',
    ))
  }
  if (
    new Set(input.projection).size !== input.projection.length
    || new Set(input.groupBy).size !== input.groupBy.length
    || new Set(input.aggregations.map((item) => item.name)).size
      !== input.aggregations.length
  ) {
    return Effect.fail(invalid(
      'plan',
      'duplicate-name',
      'Projection, grouping, and aggregation names must be unique',
    ))
  }
  if (input.aggregations.some((item) =>
    !namePattern.test(item.name)
    || (item.operation === 'count'
      ? item.field !== undefined
      : item.field === undefined))) {
    return Effect.fail(invalid(
      'plan.aggregations',
      'invalid-aggregation',
      'Count must omit a field and numeric aggregations must name one field',
    ))
  }
  if (input.predicates.some((item) =>
    item.operator === 'exists'
      ? item.value !== undefined
      : item.value === undefined
        || scalar(item.value) === undefined
        || (typeof item.value === 'string' && item.value.length > 2_048))) {
    return Effect.fail(invalid(
      'plan.predicates',
      'invalid-predicate',
      'Exists must omit a value and equality predicates must provide one',
    ))
  }
  if (
    !Number.isInteger(input.maximumRecords)
    || input.maximumRecords < 1
    || input.maximumRecords > 4_096
    || !Number.isInteger(input.maximumGroups)
    || input.maximumGroups < 1
    || input.maximumGroups > 4_096
  ) {
    return Effect.fail(invalid(
      'plan.limits',
      'invalid-limit',
      'Batch record and group limits must be integers from 1 through 4096',
    ))
  }
  return Effect.void
}

export const makeBatchSelectionPlan = Effect.fn(
  'BatchSelection.makePlan',
)(function* (input: BatchSelectionPlanInput) {
  yield* validatePlanInput(input)
  const canonical = canonicalPlanInput(input)
  return {
    version: '1',
    id: digest({ version: '1', ...canonical }),
    ...canonical,
  } satisfies BatchSelectionPlan
})

function canonicalPlanInput(
  input: BatchSelectionPlanInput,
): BatchSelectionPlanInput {
  return {
    predicates: input.predicates,
    projection: input.projection,
    groupBy: input.groupBy,
    aggregations: input.aggregations,
    maximumRecords: input.maximumRecords,
    maximumGroups: input.maximumGroups,
  }
}

export const validateBatchSelectionPlan = Effect.fn(
  'BatchSelection.validatePlan',
)(function* (plan: BatchSelectionPlan) {
  yield* validatePlanInput(plan)
  const identity = digest({
    version: plan.version,
    ...canonicalPlanInput(plan),
  })
  if (identity !== plan.id) {
    return yield* invalid(
      'plan.id',
      'identity-mismatch',
      'Batch selection plan identity does not match its canonical inputs',
    )
  }
  return plan
})

function objectField(value: unknown, field: string): unknown {
  let current = value
  for (const segment of field.split('.')) {
    if (current === null || typeof current !== 'object' || Array.isArray(current)) {
      return undefined
    }
    const match = Object.entries(current).find(([key]) => key === segment)
    if (match === undefined) return undefined
    current = match[1]
  }
  return current
}

function scalar(value: unknown): BatchScalar | undefined {
  return value === null
    || typeof value === 'boolean'
    || typeof value === 'string'
    || (typeof value === 'number' && Number.isFinite(value))
    ? value
    : undefined
}

function matches(value: unknown, predicates: ReadonlyArray<BatchPredicate>): boolean {
  return predicates.every((predicate) => {
    const candidate = scalar(objectField(value, predicate.field))
    if (predicate.operator === 'exists') return candidate !== undefined
    if (candidate === undefined) return predicate.operator === 'not-equals'
    const same = canonicalJson(candidate) === canonicalJson(predicate.value)
    return predicate.operator === 'equals' ? same : !same
  })
}

interface JsonRecord {
  readonly value: unknown
  readonly index: number
  readonly pointer: string
}

function recordsFromJson(value: unknown): ReadonlyArray<JsonRecord> | undefined {
  if (Array.isArray(value)) {
    return value.map((item, index) => ({
      value: item,
      index,
      pointer: `/${index}`,
    }))
  }
  if (value !== null && typeof value === 'object') {
    const records = Object.entries(value).find(([key]) => key === 'records')?.[1]
    if (Array.isArray(records)) {
      return records.map((item, index) => ({
        value: item,
        index,
        pointer: `/records/${index}`,
      }))
    }
    return [{ value, index: 0, pointer: '' }]
  }
  return undefined
}

function sourceOrder(
  left: BatchEvidenceSource,
  right: BatchEvidenceSource,
): number {
  return compareCanonicalText(
    `${left.sourceVersionId}\u0000${left.normalizedPath}\u0000${left.entryKey}`,
    `${right.sourceVersionId}\u0000${right.normalizedPath}\u0000${right.entryKey}`,
  )
}

interface MatchedRecord {
  readonly source: BatchEvidenceSource
  readonly recordIndex: number
  readonly recordPointer: string
  readonly value: unknown
}

function jsonPointerSegment(segment: string): string {
  return segment.replaceAll('~', '~0').replaceAll('/', '~1')
}

function fieldPointer(field: string): string {
  return field.split('.').map((segment) =>
    `/${jsonPointerSegment(segment)}`).join('')
}

function selectedRecord(
  matched: MatchedRecord,
  projection: ReadonlyArray<string>,
): SelectedBatchRecord {
  const locator =
    `${matched.source.normalizedPath}#${matched.recordPointer}`
  return {
    entryKey: matched.source.entryKey,
    sourceVersionId: matched.source.sourceVersionId,
    normalizedPath: matched.source.normalizedPath,
    schemaFamily: matched.source.schemaFamily,
    contentDigest: matched.source.contentDigest,
    recordIndex: matched.recordIndex,
    locator,
    fields: projection.flatMap((name) => {
      const value = scalar(objectField(matched.value, name))
      return value === undefined
        ? []
        : [{
            name,
            value,
            locator: `${locator}${fieldPointer(name)}`,
            contentTrust: 'untrusted-source-content' as const,
          }]
    }),
    contentTrust: 'untrusted-source-content',
  }
}

function recordLocator(item: MatchedRecord): string {
  return `${item.source.normalizedPath}#${item.recordPointer}`
}

function contributors(
  records: ReadonlyArray<MatchedRecord>,
  field?: string,
): {
  readonly contributors: BatchAggregateGroup['values'][number]['contributors']
  readonly truncatedContributors: number
} {
  const contributing = field === undefined
    ? records
    : records.filter((record) =>
        typeof objectField(record.value, field) === 'number')
  const maximumContributors = 64
  return {
    contributors: contributing.slice(0, maximumContributors).map((record) => ({
      sourceVersionId: record.source.sourceVersionId,
      locator: field === undefined
        ? recordLocator(record)
        : `${recordLocator(record)}${fieldPointer(field)}`,
      contentTrust: 'untrusted-source-content',
    })),
    truncatedContributors: Math.max(
      0,
      contributing.length - maximumContributors,
    ),
  }
}

interface Decimal {
  readonly coefficient: bigint
  readonly scale: number
}

function decimalFromNumber(value: number): Decimal {
  return decimalFromLexeme(value.toString())
}

function decimalFromLexeme(lexeme: string): Decimal {
  const [mantissa, exponentText] = lexeme.toLowerCase().split('e')
  const exponent = exponentText === undefined ? 0 : Number(exponentText)
  const negative = mantissa!.startsWith('-')
  const unsigned = negative ? mantissa!.slice(1) : mantissa!
  const [integer, fraction = ''] = unsigned.split('.')
  const digits = `${integer}${fraction}`.replace(/^0+(?=\d)/, '')
  const coefficient = BigInt(`${negative ? '-' : ''}${digits}`)
  const scale = fraction.length - exponent
  return scale >= 0
    ? { coefficient, scale }
    : { coefficient: coefficient * (10n ** BigInt(-scale)), scale: 0 }
}

/**
 * Native JSON parsing is safe for this boundary only when converting the
 * source lexeme to a number and back preserves its exact decimal value.
 */
function hasLosslessNumericLexemes(text: string): boolean {
  const numberPattern = /-?(?:0|[1-9][0-9]*)(?:\.[0-9]+)?(?:[eE][+-]?[0-9]+)?/y
  let inString = false
  let escaped = false
  for (let index = 0; index < text.length; index += 1) {
    const character = text[index]!
    if (inString) {
      if (escaped) escaped = false
      else if (character === '\\') escaped = true
      else if (character === '"') inString = false
      continue
    }
    if (character === '"') {
      inString = true
      continue
    }
    if (character !== '-' && (character < '0' || character > '9')) continue
    numberPattern.lastIndex = index
    const match = numberPattern.exec(text)
    if (match === null) continue
    const lexeme = match[0]
    const numeric = Number(lexeme)
    const exponentText = lexeme.toLowerCase().split('e')[1]
    const exponent = exponentText === undefined ? 0 : Number(exponentText)
    if (
      !Number.isFinite(numeric)
      || Math.abs(exponent) > 400
      || (numeric === 0 && !/^[-+]?0*(?:\.0*)?(?:e[-+]?[0-9]+)?$/i.test(lexeme))
      || compareDecimal(
        decimalFromLexeme(lexeme),
        decimalFromNumber(numeric),
      ) !== 0
    ) {
      return false
    }
    index += lexeme.length - 1
  }
  return true
}

function alignDecimal(value: Decimal, scale: number): bigint {
  return value.coefficient * (10n ** BigInt(scale - value.scale))
}

function compareDecimal(left: Decimal, right: Decimal): number {
  const scale = Math.max(left.scale, right.scale)
  const leftValue = alignDecimal(left, scale)
  const rightValue = alignDecimal(right, scale)
  return leftValue < rightValue ? -1 : leftValue > rightValue ? 1 : 0
}

function renderDecimal(value: Decimal): string {
  const negative = value.coefficient < 0n
  const absolute = (negative ? -value.coefficient : value.coefficient).toString()
  if (value.scale === 0) return `${negative ? '-' : ''}${absolute}`
  const padded = absolute.padStart(value.scale + 1, '0')
  const split = padded.length - value.scale
  const integer = padded.slice(0, split)
  const fraction = padded.slice(split).replace(/0+$/, '')
  return `${negative ? '-' : ''}${integer}${fraction.length > 0 ? `.${fraction}` : ''}`
}

function aggregateDecimals(
  operation: Exclude<BatchAggregation['operation'], 'count'>,
  values: ReadonlyArray<number>,
): string | null {
  if (values.length === 0) return operation === 'sum' ? '0' : null
  const decimals = values.map(decimalFromNumber)
  if (operation === 'sum') {
    const scale = Math.max(...decimals.map((value) => value.scale))
    return renderDecimal({
      coefficient: decimals.reduce(
        (total, value) => total + alignDecimal(value, scale),
        0n,
      ),
      scale,
    })
  }
  const selected = decimals.reduce((result, value) => {
    const comparison = compareDecimal(value, result)
    return operation === 'minimum'
      ? comparison < 0 ? value : result
      : comparison > 0 ? value : result
  })
  return renderDecimal(selected)
}

function aggregate(
  matches: ReadonlyArray<MatchedRecord>,
  plan: BatchSelectionPlan,
): {
  readonly groups: ReadonlyArray<BatchAggregateGroup>
  readonly matchedGroups: number
} {
  if (plan.groupBy.length === 0 && plan.aggregations.length === 0) {
    return { groups: [], matchedGroups: 0 }
  }
  const grouped = new Map<string, {
    readonly key: BatchAggregateGroup['key']
    readonly records: Array<MatchedRecord>
  }>()
  if (matches.length === 0 && plan.groupBy.length === 0) {
    grouped.set('[]', { key: [], records: [] })
  }
  for (const item of matches) {
    const key = plan.groupBy.map((field) => ({
      field,
      value: scalar(objectField(item.value, field)) ?? null,
      contentTrust: 'untrusted-source-content' as const,
    }))
    const identity = canonicalJson(key)
    const existing = grouped.get(identity)
    if (existing === undefined) grouped.set(identity, { key, records: [item] })
    else existing.records.push(item)
  }
  const ordered = [...grouped.entries()]
    .sort(([left], [right]) => compareCanonicalText(left, right))
  return {
    matchedGroups: ordered.length,
    groups: ordered.slice(0, plan.maximumGroups).map(([, group]) => ({
      key: group.key,
      values: plan.aggregations.map((aggregation) => {
        if (aggregation.operation === 'count') {
          return {
            name: aggregation.name,
            value: String(group.records.length),
            ...contributors(group.records),
          }
        }
        const field = aggregation.field
        const values = group.records.flatMap((record) => {
          const value = field === undefined
            ? undefined
            : objectField(record.value, field)
          return typeof value === 'number' && Number.isFinite(value) ? [value] : []
        })
        return {
          name: aggregation.name,
          value: aggregateDecimals(aggregation.operation, values),
          ...contributors(group.records, field),
        }
      }),
    })),
  }
}

export const selectBatchEvidence = Effect.fn(
  'BatchSelection.select',
)(function* (
  partition: RecursivePartition,
  sources: ReadonlyArray<BatchEvidenceSource>,
  plan: BatchSelectionPlan,
) {
  yield* validateBatchSelectionPlan(plan)

  const expectedKeys = new Set(partition.entryKeys)
  const expectedSources = new Set(partition.sourceVersionIds)
  const exclusions: BatchSelectionExclusion[] = []
  const matched: MatchedRecord[] = []
  let inputRecords = 0
  const examinedKeys = new Set<string>()
  let excludedExpectedEntries = 0

  for (const source of [...sources].sort(sourceOrder)) {
    yield* Effect.yieldNow()
    if (
      !expectedKeys.has(source.entryKey)
      || !expectedSources.has(source.sourceVersionId)
      || source.schemaFamily !== partition.schemaFamily
    ) {
      exclusions.push({
        entryKey: source.entryKey,
        sourceVersionId: source.sourceVersionId,
        normalizedPath: source.normalizedPath,
        reason: 'partition-mismatch',
        contentTrust: 'untrusted-source-content',
      })
      continue
    }
    if (examinedKeys.has(source.entryKey)) {
      exclusions.push({
        entryKey: source.entryKey,
        sourceVersionId: source.sourceVersionId,
        normalizedPath: source.normalizedPath,
        reason: 'partition-mismatch',
        contentTrust: 'untrusted-source-content',
      })
      continue
    }
    examinedKeys.add(source.entryKey)
    const decoded = yield* Effect.try({
      try: () => fatalUtf8Decoder.decode(source.bytes),
      catch: () => invalid(
        `sources.${source.entryKey}`,
        'malformed-json',
        'Source bytes are not valid JSON',
      ),
    }).pipe(Effect.either)
    if (decoded._tag === 'Left') {
      exclusions.push({
        entryKey: source.entryKey,
        sourceVersionId: source.sourceVersionId,
        normalizedPath: source.normalizedPath,
        reason: 'malformed-json',
        contentTrust: 'untrusted-source-content',
      })
      excludedExpectedEntries += 1
      continue
    }
    if (!hasLosslessNumericLexemes(decoded.right)) {
      exclusions.push({
        entryKey: source.entryKey,
        sourceVersionId: source.sourceVersionId,
        normalizedPath: source.normalizedPath,
        reason: 'unsafe-number',
        contentTrust: 'untrusted-source-content',
      })
      excludedExpectedEntries += 1
      continue
    }
    const parsed = yield* Effect.try({
      try: (): unknown => JSON.parse(decoded.right),
      catch: () => invalid(
        `sources.${source.entryKey}`,
        'malformed-json',
        'Source bytes are not valid JSON',
      ),
    }).pipe(Effect.either)
    if (parsed._tag === 'Left') {
      exclusions.push({
        entryKey: source.entryKey,
        sourceVersionId: source.sourceVersionId,
        normalizedPath: source.normalizedPath,
        reason: 'malformed-json',
        contentTrust: 'untrusted-source-content',
      })
      excludedExpectedEntries += 1
      continue
    }
    const records = recordsFromJson(parsed.right)
    if (records === undefined) {
      exclusions.push({
        entryKey: source.entryKey,
        sourceVersionId: source.sourceVersionId,
        normalizedPath: source.normalizedPath,
        reason: 'unsupported-json-shape',
        contentTrust: 'untrusted-source-content',
      })
      excludedExpectedEntries += 1
      continue
    }
    if (inputRecords + records.length > MAX_BATCH_INPUT_RECORDS) {
      return yield* invalid(
        `sources.${source.entryKey}`,
        'record-limit-exceeded',
        `Batch selection accepts at most ${MAX_BATCH_INPUT_RECORDS} input records`,
      )
    }
    inputRecords += records.length
    for (const [offset, record] of records.entries()) {
      if (offset > 0 && offset % 1_024 === 0) yield* Effect.yieldNow()
      if (matches(record.value, plan.predicates)) {
        matched.push({
          source,
          recordIndex: record.index,
          recordPointer: record.pointer,
          value: record.value,
        })
      }
    }
  }

  const ordered = matched.sort((left, right) => sourceOrder(left.source, right.source)
    || left.recordIndex - right.recordIndex)
  const emitted = ordered.slice(0, plan.maximumRecords)
    .map((item) => selectedRecord(item, plan.projection))
  const aggregation = aggregate(ordered, plan)
  const missingEntries = Math.max(0, partition.entryKeys.length - examinedKeys.size)
  const truncatedRecords = Math.max(0, ordered.length - emitted.length)
  const emittedGroups = aggregation.groups.length
  const truncatedGroups = aggregation.matchedGroups - emittedGroups
  return {
    records: emitted,
    groups: aggregation.groups,
    exclusions,
    counts: {
      expectedEntries: partition.entryKeys.length,
      examinedEntries: examinedKeys.size,
      excludedEntries: excludedExpectedEntries + missingEntries,
      inputRecords,
      matchedRecords: ordered.length,
      emittedRecords: emitted.length,
      truncatedRecords,
      matchedGroups: aggregation.matchedGroups,
      emittedGroups,
      truncatedGroups,
    },
    truncated: truncatedRecords > 0 || truncatedGroups > 0,
  } satisfies BatchSelectionResult
})
