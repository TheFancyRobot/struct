/** @jsxImportSource solid-js */
/* eslint-disable no-unused-vars -- Babel does not mark Solid JSX imports as used. */
import { describe, expect, it } from 'bun:test'
import { Schema } from 'effect'
import { renderToString } from 'solid-js/web'
import {
  CitationDetail,
  DatasetCitationEvidence,
} from '@struct/domain'
import { DatasetEvidence, DocumentEvidence } from './EvidenceInspector'

const id = (suffix: string) => `750e8400-e29b-41d4-a716-4466554400${suffix}`
const sha = (character: string) => `sha256:${character.repeat(64)}`
const digest = (character: string) => character.repeat(64)

describe('evidence inspector', () => {
  it('renders exact document hashes, locator, bounds, and untrusted source as text', () => {
    const evidence = Schema.decodeUnknownSync(CitationDetail)({
      id: id('01'),
      runId: id('02'),
      sourceVersionId: id('03'),
      sourceName: '<script>source</script>',
      sourceVersion: 4,
      originalContentHash: sha('a'),
      normalizedContentHash: sha('b'),
      locator: 'document:section:Launch,chars:7-13,bytes:7-13',
      contextLines: [{
        lineNumber: 2,
        segments: [{ text: '<img src=x onerror=alert(1)>', cited: true }],
      }],
      startLine: 2,
      endLine: 2,
    })

    const html = renderToString(() => <DocumentEvidence evidence={evidence} />)

    expect(html).toContain(sha('a'))
    expect(html).toContain(sha('b'))
    expect(html).toContain('document:section:Launch')
    expect(html).toContain('2–2')
    expect(html).toContain('&lt;script>source&lt;/script>')
    expect(html).toContain('&lt;img src=x onerror=alert(1)>')
    expect(html).not.toContain('<script>source</script>')
  })

  it('renders the persisted deterministic query provenance and truncation state', () => {
    const evidence = Schema.decodeUnknownSync(DatasetCitationEvidence)({
      citation: {
        id: id('04'),
        queryResultSnapshotId: id('05'),
        workspaceId: id('06'),
        projectId: id('07'),
        datasetId: id('08'),
        datasetSnapshotId: id('09'),
        schemaHash: sha('c'),
        parquetDigest: digest('d'),
        resultHash: sha('e'),
        resultArtifactHash: sha('f'),
        canonicalSql: 'SELECT account, risk FROM renewal_health',
        selectedColumns: ['account', 'risk'],
        rowStart: 0,
        rowEndExclusive: 1,
        createdAt: 1,
      },
      snapshot: {
        id: id('05'),
        workspaceId: id('06'),
        projectId: id('07'),
        requestHash: sha('1'),
        protocolVersion: '1',
        engineVersion: 'duckdb-test',
        engineConfigHash: sha('2'),
        canonicalSql: 'SELECT account, risk FROM renewal_health',
        snapshots: [{
          alias: 'renewal_health',
          datasetId: id('08'),
          snapshotId: id('09'),
          schemaHash: sha('c'),
          parquetDigest: digest('d'),
        }],
        schemaHash: sha('3'),
        resultHash: sha('e'),
        resultArtifactHash: sha('f'),
        columns: [
          { ordinal: 0, name: 'account', type: 'VARCHAR' },
          { ordinal: 1, name: 'risk', type: 'BOOLEAN' },
        ],
        rows: [['Acme', true]],
        rowCount: 1,
        truncated: true,
        executedAt: 2,
        createdAt: 3,
      },
      columns: [
        { ordinal: 0, name: 'account', type: 'VARCHAR' },
        { ordinal: 1, name: 'risk', type: 'BOOLEAN' },
      ],
      rows: [['Acme', true]],
    })

    const html = renderToString(() => <DatasetEvidence evidence={evidence} />)

    expect(html).toContain(String(evidence.citation.queryResultSnapshotId))
    expect(html).toContain(evidence.snapshot.requestHash)
    expect(html).toContain(evidence.citation.resultArtifactHash)
    expect(html).toContain(evidence.citation.parquetDigest)
    expect(html).toContain('duckdb-test · protocol 1')
    expect(html).toContain('account, risk')
    expect(html).toContain('1 persisted · truncated')
  })
})
