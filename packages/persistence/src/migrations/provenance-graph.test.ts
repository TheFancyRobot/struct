import { describe, expect, it } from 'bun:test'

const up = await Bun.file(
  new URL('./0016_provenance_graph.sql', import.meta.url),
).text()
const down = await Bun.file(
  new URL('./0016_provenance_graph.down.sql', import.meta.url),
).text()
const reportLifecycle = await Bun.file(
  new URL('./0015_report_lifecycle.sql', import.meta.url),
).text()

describe('provenance graph migration', () => {
  it('creates scoped graph, typed edge, and edge-addressable validation rows', () => {
    const findings = reportLifecycle.slice(
      reportLifecycle.indexOf('CREATE TABLE findings'),
      reportLifecycle.indexOf('CREATE TABLE finding_source_versions'),
    )
    const reports = reportLifecycle.slice(
      reportLifecycle.indexOf('CREATE TABLE reports'),
      reportLifecycle.indexOf('CREATE INDEX idx_reports_scope'),
    )
    expect(findings).not.toMatch(/UNIQUE \(id, workspace_id, project_id, revision\)/i)
    expect(reports).toMatch(/UNIQUE \(id, workspace_id, project_id, revision\)/i)
    expect(up).toMatch(/CREATE TABLE provenance_graphs/i)
    expect(up).toMatch(
      /FOREIGN KEY \(report_id, workspace_id, project_id, report_revision\)/i,
    )
    expect(up).toMatch(/UNIQUE \(report_id, report_revision, revalidation_key\)/i)
    expect(up).toMatch(/CREATE TABLE provenance_edges/i)
    expect(up).toMatch(/edge_kind IN \(/i)
    expect(up).toMatch(
      /FOREIGN KEY \(report_id, report_revision, claim_id\)/i,
    )
    expect(up).toMatch(
      /FOREIGN KEY \(claim_id, claim_revision_id, claim_revision\)/i,
    )
    expect(up).toMatch(/FOREIGN KEY \(claim_id, evidence_id\)/i)
    expect(up).toMatch(/= \(evidence_id IS NOT NULL\)/i)
    expect(up).toMatch(/CREATE TABLE citation_validation_facts/i)
    expect(up).toMatch(/FOREIGN KEY \(graph_id, edge_id\)/i)
  })

  it('drops dependants before graph roots', () => {
    expect(down.indexOf('citation_validation_facts'))
      .toBeLessThan(down.indexOf('provenance_edges'))
    expect(down.indexOf('provenance_edges'))
      .toBeLessThan(down.indexOf('provenance_graphs'))
  })
})
