import { describe, expect, it } from 'bun:test'
import { Cause, Effect, Exit, Option, Schema } from 'effect'
import {
  QueryError,
  UniqueConstraintError,
} from './errors'
import {
  DatasetCitationValidationError,
  DatasetQueryEvidenceConflictError,
  DatasetQueryEvidencePersistenceError,
  DatasetQueryEvidenceScopeError,
} from './repositories/dataset-query-evidence'
import {
  DecodeError,
  decodeSourceRow,
  decodeWorkspaceRow,
} from './repositories/decode'

const RAW_SQL_MARKER = "RAW_SQL_MARKER__SELECT * FROM users WHERE password = 'db-secret-123'"
const PASSWORD_URL_MARKER = 'PASSWORD_URL_MARKER__postgres://db-user:db-pass@db.internal/struct'
const FS_PATH_MARKER = '/Users/private/PATH_MARKER__service-account.json'
const STORED_VALUE_MARKER = 'STORED_VALUE_MARKER__not-a-uuid'
const PARSER_VALUE_MARKER = 'PARSER_VALUE_MARKER__invalid-kind'
const NESTED_CAUSE_MARKER = 'NESTED_CAUSE_MARKER__filesystem-leak'

function observeRepresentations(
  schema: Schema.Schema.AnyNoContext,
  error: Error,
): ReadonlyArray<[label: string, value: string]> {
  return [
    ['message', error.message],
    ['string', String(error)],
    ['json', JSON.stringify(error)],
    ['schema', JSON.stringify(Schema.encodeSync(schema)(error))],
    ['cause-string', String(Cause.fail(error))],
    ['cause-pretty', Cause.pretty(Cause.fail(error))],
  ]
}

function expectMarkersRedacted(
  schema: Schema.Schema.AnyNoContext,
  error: Error,
  markers: ReadonlyArray<string>,
): void {
  for (const [label, value] of observeRepresentations(schema, error)) {
    for (const marker of markers) {
      expect(value, `${label} should redact ${marker}`).not.toContain(marker)
    }
  }
}

function decodeTaggedError(
  schema: Schema.Schema.AnyNoContext,
  tag: string,
  value: Record<string, unknown>,
): any {
  return Schema.decodeUnknownSync(schema)({ _tag: tag, ...value })
}

function expectFailedDecode(exit: Exit.Exit<unknown, unknown>): DecodeError {
  if (!Exit.isFailure(exit)) {
    throw new Error('Expected decode to fail')
  }
  const failure = Option.getOrUndefined(Cause.failureOption(exit.cause))
  if (!(failure instanceof DecodeError)) {
    throw new Error('Expected DecodeError failure')
  }
  return failure
}

describe('persistence error redaction', () => {
  it('redacts QueryError representations and omits nested causes', () => {
    const error = new QueryError({
      operation: RAW_SQL_MARKER,
      entity: 'Project',
      message: FS_PATH_MARKER,
      cause: `${NESTED_CAUSE_MARKER} ${PASSWORD_URL_MARKER}`,
    })

    expect(error.operation).toBe('unknown-operation')
    expect(error.entity).toBe('Project')
    expect(error.message).toBe('Persistence query failed during unknown-operation on Project')
    expectMarkersRedacted(QueryError, error, [
      'RAW_SQL_MARKER',
      'PATH_MARKER',
      'NESTED_CAUSE_MARKER',
      'PASSWORD_URL_MARKER',
      'db-secret-123',
      'db-pass',
    ])
    expect(JSON.stringify(error)).not.toContain('cause')
  })

  it('redacts UniqueConstraintError representations while keeping bounded identifiers', () => {
    const error = new UniqueConstraintError({
      entity: PASSWORD_URL_MARKER,
      field: 'datasetSnapshotId',
      message: RAW_SQL_MARKER,
    })

    expect(error.entity).toBe('unknown-entity')
    expect(error.field).toBe('datasetSnapshotId')
    expect(error.message).toBe('Unique constraint violated on unknown-entity.datasetSnapshotId')
    expectMarkersRedacted(UniqueConstraintError, error, [
      'RAW_SQL_MARKER',
      'PASSWORD_URL_MARKER',
      'db-secret-123',
      'db-pass',
    ])
  })

  it('redacts DecodeError construction and generated decode failures', async () => {
    const constructed = new DecodeError({
      entity: 'Source',
      field: 'kind',
      reason: PARSER_VALUE_MARKER,
      message: `${FS_PATH_MARKER} ${STORED_VALUE_MARKER}`,
    })

    expect(constructed.entity).toBe('Source')
    expect(constructed.field).toBe('kind')
    expect(constructed.reason).toBe('schema-mismatch')
    expect(constructed.message).toBe('Failed to decode Source.kind (schema-mismatch)')
    expectMarkersRedacted(DecodeError, constructed, [
      'PARSER_VALUE_MARKER',
      'PATH_MARKER',
      'STORED_VALUE_MARKER',
    ])

    const invalidWorkspace = expectFailedDecode(await Effect.runPromiseExit(
      decodeWorkspaceRow({
        id: STORED_VALUE_MARKER,
        name: 'Workspace',
        created_at: new Date('2024-01-01T00:00:00Z'),
        updated_at: new Date('2024-01-01T00:00:00Z'),
      }),
    ))
    expect(invalidWorkspace.entity).toBe('Workspace')
    expect(invalidWorkspace.field).toBe('id')
    expect(invalidWorkspace.reason).toBe('schema-mismatch')
    expect(invalidWorkspace.message).toBe('Failed to decode Workspace.id (schema-mismatch)')
    expectMarkersRedacted(DecodeError, invalidWorkspace, ['STORED_VALUE_MARKER'])

    const invalidSource = expectFailedDecode(await Effect.runPromiseExit(
      decodeSourceRow({
        id: '550e8400-e29b-41d4-a716-446655440002',
        project_id: '550e8400-e29b-41d4-a716-446655440001',
        name: 'Source',
        kind: PARSER_VALUE_MARKER,
        created_at: new Date('2024-03-01T00:00:00Z'),
        updated_at: new Date('2024-03-01T00:00:00Z'),
      }),
    ))
    expect(invalidSource.entity).toBe('Source')
    expect(invalidSource.field).toBe('kind')
    expect(invalidSource.reason).toBe('schema-mismatch')
    expect(invalidSource.message).toBe('Failed to decode Source.kind (schema-mismatch)')
    expectMarkersRedacted(DecodeError, invalidSource, ['PARSER_VALUE_MARKER'])
  })

  it('redacts DatasetQueryEvidencePersistenceError construction and schema decoding', () => {
    const input = {
      operation: `${RAW_SQL_MARKER} ${STORED_VALUE_MARKER}`,
      message: `${PASSWORD_URL_MARKER} ${FS_PATH_MARKER} ${PARSER_VALUE_MARKER} ${NESTED_CAUSE_MARKER}`,
      cause: `${NESTED_CAUSE_MARKER} ${RAW_SQL_MARKER}`,
    }

    const constructed = new DatasetQueryEvidencePersistenceError(input)
    expect(constructed.operation).toBe('unknown-operation')
    expect(constructed.message).toBe('Dataset query evidence unknown-operation failed')
    expectMarkersRedacted(DatasetQueryEvidencePersistenceError, constructed, [
      'RAW_SQL_MARKER',
      'STORED_VALUE_MARKER',
      'PASSWORD_URL_MARKER',
      'PATH_MARKER',
      'PARSER_VALUE_MARKER',
      'NESTED_CAUSE_MARKER',
      'db-secret-123',
      'db-pass',
    ])
    expect(JSON.stringify(constructed)).not.toContain('cause')

    const decoded = decodeTaggedError(
      DatasetQueryEvidencePersistenceError,
      'DatasetQueryEvidencePersistenceError',
      input,
    )
    expect(decoded.operation).toBe('unknown-operation')
    expect(decoded.message).toBe('Dataset query evidence unknown-operation failed')
    expectMarkersRedacted(DatasetQueryEvidencePersistenceError, decoded, [
      'RAW_SQL_MARKER',
      'STORED_VALUE_MARKER',
      'PASSWORD_URL_MARKER',
      'PATH_MARKER',
      'PARSER_VALUE_MARKER',
      'NESTED_CAUSE_MARKER',
      'db-secret-123',
      'db-pass',
    ])
    expect(JSON.stringify(decoded)).not.toContain('cause')
  })

  it('redacts DatasetQueryEvidenceScopeError construction and schema decoding', () => {
    const input = {
      entity: 'citation',
      id: `${PASSWORD_URL_MARKER} ${FS_PATH_MARKER}`,
      message: `${RAW_SQL_MARKER} ${NESTED_CAUSE_MARKER}`,
    }

    const constructed = new DatasetQueryEvidenceScopeError(input)
    expect(constructed.entity).toBe('citation')
    expect(constructed.id).toBe('unknown-citation-id')
    expect(constructed.message).toBe('Dataset citation was not found in this scope')
    expectMarkersRedacted(DatasetQueryEvidenceScopeError, constructed, [
      'RAW_SQL_MARKER',
      'PASSWORD_URL_MARKER',
      'PATH_MARKER',
      'NESTED_CAUSE_MARKER',
      'db-secret-123',
      'db-pass',
    ])

    const decoded = decodeTaggedError(
      DatasetQueryEvidenceScopeError,
      'DatasetQueryEvidenceScopeError',
      input,
    )
    expect(decoded.entity).toBe('citation')
    expect(decoded.id).toBe('unknown-citation-id')
    expect(decoded.message).toBe('Dataset citation was not found in this scope')
    expectMarkersRedacted(DatasetQueryEvidenceScopeError, decoded, [
      'RAW_SQL_MARKER',
      'PASSWORD_URL_MARKER',
      'PATH_MARKER',
      'NESTED_CAUSE_MARKER',
      'db-secret-123',
      'db-pass',
    ])
  })

  it('redacts DatasetQueryEvidenceConflictError construction and schema decoding', () => {
    const input = {
      entity: 'citation',
      message: `${RAW_SQL_MARKER} ${PASSWORD_URL_MARKER} ${FS_PATH_MARKER}`,
    }

    const constructed = new DatasetQueryEvidenceConflictError(input)
    expect(constructed.entity).toBe('citation')
    expect(constructed.message).toBe('Dataset citations do not match their immutable result')
    expectMarkersRedacted(DatasetQueryEvidenceConflictError, constructed, [
      'RAW_SQL_MARKER',
      'PASSWORD_URL_MARKER',
      'PATH_MARKER',
      'db-secret-123',
      'db-pass',
    ])

    const decoded = decodeTaggedError(
      DatasetQueryEvidenceConflictError,
      'DatasetQueryEvidenceConflictError',
      input,
    )
    expect(decoded.entity).toBe('citation')
    expect(decoded.message).toBe('Dataset citations do not match their immutable result')
    expectMarkersRedacted(DatasetQueryEvidenceConflictError, decoded, [
      'RAW_SQL_MARKER',
      'PASSWORD_URL_MARKER',
      'PATH_MARKER',
      'db-secret-123',
      'db-pass',
    ])
  })

  it('redacts DatasetCitationValidationError construction and schema decoding', () => {
    const input = {
      citationId: `${PASSWORD_URL_MARKER} ${FS_PATH_MARKER}`,
      reason: `${PARSER_VALUE_MARKER} ${STORED_VALUE_MARKER}`,
      message: `${RAW_SQL_MARKER} ${NESTED_CAUSE_MARKER}`,
    }

    const constructed = new DatasetCitationValidationError(input)
    expect(constructed.citationId).toBe('unknown-citation-id')
    expect(constructed.reason).toBe('validation-failed')
    expect(constructed.message).toBe('Dataset citation evidence is invalid')
    expectMarkersRedacted(DatasetCitationValidationError, constructed, [
      'RAW_SQL_MARKER',
      'PASSWORD_URL_MARKER',
      'PATH_MARKER',
      'PARSER_VALUE_MARKER',
      'STORED_VALUE_MARKER',
      'NESTED_CAUSE_MARKER',
      'db-secret-123',
      'db-pass',
    ])

    const decoded = decodeTaggedError(
      DatasetCitationValidationError,
      'DatasetCitationValidationError',
      input,
    )
    expect(decoded.citationId).toBe('unknown-citation-id')
    expect(decoded.reason).toBe('validation-failed')
    expect(decoded.message).toBe('Dataset citation evidence is invalid')
    expectMarkersRedacted(DatasetCitationValidationError, decoded, [
      'RAW_SQL_MARKER',
      'PASSWORD_URL_MARKER',
      'PATH_MARKER',
      'PARSER_VALUE_MARKER',
      'STORED_VALUE_MARKER',
      'NESTED_CAUSE_MARKER',
      'db-secret-123',
      'db-pass',
    ])
  })
})
