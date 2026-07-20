import { describe, expect, it } from 'bun:test'

const upPath = new URL('./0015_report_lifecycle.sql', import.meta.url).pathname
const downPath = new URL('./0015_report_lifecycle.down.sql', import.meta.url).pathname

describe('report lifecycle migration contract', () => {
  it('persists canonical scope, revisions, evidence, and section links', async () => {
    const sql = await Bun.file(upPath).text()

    expect(sql).toMatch(/CREATE TABLE durable_claims/i)
    expect(sql).toMatch(/workspace_id UUID NOT NULL/i)
    expect(sql).toMatch(/project_id UUID NOT NULL/i)
    expect(sql).toMatch(/run_id UUID NOT NULL/i)
    expect(sql).toMatch(/CREATE TABLE claim_revisions/i)
    expect(sql).toMatch(/CREATE TABLE claim_evidence/i)
    expect(sql).toMatch(/evidence_mode TEXT/i)
    expect(sql).toMatch(/unsupported_reason TEXT/i)
    expect(sql).toMatch(/citation_revision INTEGER NOT NULL/i)
    expect(sql).toMatch(/superseded_by_citation_id UUID/i)
    expect(sql).toMatch(/citation_last_idempotency_key TEXT/i)
    expect(sql).toMatch(/citation_updated_at TIMESTAMPTZ NOT NULL/i)
    expect(sql).toMatch(/FOREIGN KEY \(superseded_by_citation_id\)[\s\S]*REFERENCES durable_claims\(citation_id\) ON DELETE RESTRICT/i)
    expect(sql).toMatch(/citation_last_idempotency_key IS NULL[\s\S]*BETWEEN 1 AND 2048/i)
    expect(sql).toMatch(/support_state = 'supported'[\s\S]*evidence_mode IS NOT NULL/i)
    expect(sql).toMatch(/support_state = 'unsupported'[\s\S]*unsupported_reason/i)
    expect(sql).toMatch(/char_length\(unsupported_reason\) BETWEEN 1 AND 65536/i)
    expect(sql).toMatch(/last_publication_key IS NULL[\s\S]*BETWEEN 1 AND 2048/i)
    expect(sql).toMatch(/last_regeneration_key IS NULL[\s\S]*BETWEEN 1 AND 2048/i)
    expect(sql).toMatch(/stance TEXT NOT NULL CHECK \(stance = 'supports'\)/i)
    expect(sql).toMatch(/FOREIGN KEY \(claim_id, claim_signature\)[\s\S]*REFERENCES durable_claims\(id, claim_signature\)/i)
    expect(sql).toMatch(/CREATE TRIGGER claim_evidence_append_only/i)
    expect(sql).toMatch(/CREATE TABLE findings/i)
    expect(sql).toMatch(/CREATE TABLE finding_source_versions/i)
    expect(sql).toMatch(/source_version_id UUID NOT NULL REFERENCES source_versions\(id\)/i)
    expect(sql).toMatch(/CREATE TABLE reports/i)
    expect(sql).toMatch(/CREATE TABLE report_source_versions/i)
    expect(sql).toMatch(/CREATE TABLE report_sections/i)
    expect(sql).toMatch(/CREATE TABLE report_section_revisions/i)
    expect(sql).toMatch(/UNIQUE \(report_id, claim_id\)/i)
    expect(sql).toMatch(/publication_state IN \('draft', 'publishable', 'published', 'superseded'\)/i)
  })

  it('drops the direct greenfield shape in dependency order', async () => {
    const sql = await Bun.file(downPath).text()
    expect(sql.indexOf('DROP TABLE IF EXISTS report_claims'))
      .toBeLessThan(sql.indexOf('DROP TABLE IF EXISTS reports'))
    expect(sql.indexOf('DROP TABLE IF EXISTS report_source_versions'))
      .toBeLessThan(sql.indexOf('DROP TABLE IF EXISTS reports'))
    expect(sql.indexOf('DROP TRIGGER IF EXISTS claim_evidence_append_only'))
      .toBeLessThan(sql.indexOf('DROP TABLE IF EXISTS claim_evidence'))
    expect(sql.trim().endsWith('DROP TABLE IF EXISTS durable_claims;')).toBe(true)
  })
})
