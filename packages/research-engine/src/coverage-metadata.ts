import {
  CoverageSnapshotId,
  ResearchContractValidationError,
} from '@struct/domain'
// eslint-disable-next-line no-unused-vars -- Type-only namespace is consumed by TypeScript.
import type * as Domain from '@struct/domain'
import { Effect } from 'effect'

function digestFields(fields: ReadonlyArray<string>): string {
  const canonical = fields.map((field) => `${field.length}:${field}`).join('')
  return `sha256:${new Bun.CryptoHasher('sha256').update(canonical).digest('hex')}`
}

export function computeCoverageSnapshotId(
  coverage: Omit<Domain.RecursiveCoverage, 'id'>,
): CoverageSnapshotId {
  return CoverageSnapshotId.make(digestFields([
    String(coverage.expectedItems),
    String(coverage.examinedItems),
    String(coverage.missingItems),
    String(coverage.excludedItems),
    String(coverage.expectedPartitions),
    String(coverage.examinedPartitions),
    coverage.status,
  ]))
}

export const validateCoverageIdentity = Effect.fn(
  'RecursiveCoverage.validateIdentity',
)(function* (
  coverage: Domain.RecursiveCoverage,
  contract: 'recursive-batch' | 'recursive-aggregation' = 'recursive-aggregation',
) {
  if (coverage.id !== computeCoverageSnapshotId(coverage)) {
    return yield* new ResearchContractValidationError({
      contract,
      reason: 'invalid-identity',
      path: 'coverage.id',
      message: 'Coverage identity does not match its canonical counts',
    })
  }
  return coverage
})
