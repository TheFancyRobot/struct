const BOUNDED_IDENTIFIER = /^[A-Za-z][A-Za-z0-9_.-]{0,63}$/
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const DECODE_REASON_CODES = new Set([
  'schema-mismatch',
  'missing-field',
  'invalid-type',
  'invalid-value',
])
const DATASET_QUERY_EVIDENCE_OPERATIONS = new Set([
  'record',
  'result validation',
  'citation validation',
  'result decode',
  'citation decode',
  'history decode',
  'result replay',
  'citation replay',
  'citation reopen',
  'citation result decode',
  'history',
  'history validation',
])
const DATASET_QUERY_EVIDENCE_ENTITIES = new Set(['result', 'citation'])
const DATASET_CITATION_VALIDATION_REASONS = new Set([
  'immutable-evidence-mismatch',
  'invalid-evidence-range',
  'validation-failed',
])

function sanitizeAllowedValue(
  value: string,
  allowed: ReadonlySet<string>,
  fallback: string,
): string {
  const candidate = value.trim()
  return allowed.has(candidate) ? candidate : fallback
}

export function sanitizeBoundedIdentifier(
  value: string,
  fallback: string,
): string {
  const candidate = value.trim()
  return BOUNDED_IDENTIFIER.test(candidate) ? candidate : fallback
}

export function sanitizeOperation(operation: string): string {
  return sanitizeBoundedIdentifier(operation, 'unknown-operation')
}

export function sanitizeEntity(entity: string): string {
  return sanitizeBoundedIdentifier(entity, 'unknown-entity')
}

export function sanitizeField(field: string): string {
  return sanitizeBoundedIdentifier(field, 'unknown-field')
}

export function sanitizeDecodeReason(reason: string): string {
  const candidate = sanitizeBoundedIdentifier(reason, 'schema-mismatch')
  return DECODE_REASON_CODES.has(candidate) ? candidate : 'schema-mismatch'
}

export function sanitizeDatasetQueryEvidenceOperation(operation: string): string {
  return sanitizeAllowedValue(
    operation,
    DATASET_QUERY_EVIDENCE_OPERATIONS,
    'unknown-operation',
  )
}

export function sanitizeDatasetQueryEvidenceEntity(entity: string): string {
  return sanitizeAllowedValue(entity, DATASET_QUERY_EVIDENCE_ENTITIES, 'result')
}

export function sanitizeDatasetQueryEvidenceId(id: string, fallback: string): string {
  const candidate = id.trim()
  return UUID.test(candidate) ? candidate : fallback
}

export function sanitizeDatasetCitationValidationReason(reason: string): string {
  return sanitizeAllowedValue(
    reason,
    DATASET_CITATION_VALIDATION_REASONS,
    'validation-failed',
  )
}

export function classifyDecodeReason(_cause: unknown): string {
  return 'schema-mismatch'
}

export function queryErrorMessage(operation: string, entity: string): string {
  return `Persistence query failed during ${operation} on ${entity}`
}

export function uniqueConstraintErrorMessage(entity: string, field: string): string {
  return `Unique constraint violated on ${entity}.${field}`
}

export function decodeErrorMessage(
  entity: string,
  field: string,
  reason: string,
): string {
  return `Failed to decode ${entity}.${field} (${reason})`
}

export function datasetQueryEvidencePersistenceErrorMessage(
  operation: string,
): string {
  return `Dataset query evidence ${operation} failed`
}

export function datasetQueryEvidenceScopeErrorMessage(entity: string): string {
  return entity === 'citation'
    ? 'Dataset citation was not found in this scope'
    : 'Dataset query result was not found in this scope'
}

export function datasetQueryEvidenceConflictErrorMessage(entity: string): string {
  return entity === 'citation'
    ? 'Dataset citations do not match their immutable result'
    : 'Query request replay does not match its stored result'
}

export function datasetCitationValidationErrorMessage(reason: string): string {
  return reason === 'immutable-evidence-mismatch'
    ? 'Dataset citation no longer matches its immutable evidence'
    : 'Dataset citation evidence is invalid'
}
