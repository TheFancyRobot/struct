import { describe, expect, it } from 'bun:test'
import {
  CitationId,
  DatasetCitationId,
} from '@struct/domain'
import {
  evidenceSelection,
  parseEvidenceSelection,
} from './evidence-selection'

const id = '750e8400-e29b-41d4-a716-446655440003'
const documentId = CitationId.make(id)
const datasetId = DatasetCitationId.make(id)

describe('evidence selection', () => {
  it('round-trips document and dataset citations and rejects malformed state', () => {
    expect(parseEvidenceSelection(evidenceSelection(
      'document',
      documentId,
    ))).toEqual({ kind: 'document', id: documentId })
    expect(parseEvidenceSelection(evidenceSelection(
      'dataset',
      datasetId,
    ))).toEqual({ kind: 'dataset', id: datasetId })
    expect(parseEvidenceSelection('document:not-an-id')).toBeNull()
  })
})
