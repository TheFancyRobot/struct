/** @jsxImportSource solid-js */
/* eslint-disable no-unused-vars -- Babel's parser does not mark Solid JSX component imports as used. */
import { describe, expect, it } from 'bun:test'
import { renderToString } from 'solid-js/web'
import {
  MixedSourceReport,
  mixedSourceDemoFixture,
} from './MixedSourceReport'

describe('mixed-source report Solid component', () => {
  it('retains exact cross-source provenance and quantitative semantics', () => {
    const html = renderToString(() => (
      <MixedSourceReport report={mixedSourceDemoFixture('complete')} />
    ))
    expect(html).toContain('lines 118–123')
    expect(html).toContain('View canonical SQL')
    expect(html).toContain('handoff_risk')
    expect(html).toContain('DECIMAL(4,1)')
    expect(html).toContain('24.7')
    expect(html).toContain('73 reviewed accounts')
    expect(html).toContain('Comparison disclosed')
    expect(html).toContain('EMEA strategic accounts only')
  })

  it('renders honest non-success states without the completed report body', () => {
    const empty = renderToString(() => (
      <MixedSourceReport report={mixedSourceDemoFixture('empty')} />
    ))
    const error = renderToString(() => (
      <MixedSourceReport report={mixedSourceDemoFixture('error')} />
    ))
    expect(empty).toContain('No evidence matched this question')
    expect(empty).not.toContain('Delayed implementation handoffs')
    expect(error).toContain('Research result unavailable')
    expect(error).toContain('Retry the read')
    expect(error).not.toContain('Delayed implementation handoffs')
  })

  it('uses unique dataset anchors and renders boolean and null cells explicitly', () => {
    const fixture = mixedSourceDemoFixture('complete')
    const firstDataset = fixture.datasetEvidence[0]!
    const html = renderToString(() => (
      <MixedSourceReport report={{
        ...fixture,
        datasetEvidence: [
          {
            ...firstDataset,
            rows: [['flagged', true, null]],
          },
          {
            ...firstDataset,
            id: 'data-02',
            sourceName: 'renewal-health-follow-up.parquet',
          },
        ],
      }} />
    ))
    expect(html).toContain('href="#dataset-evidence-data-01"')
    expect(html.match(/id="dataset-evidence-data-01"/g)).toHaveLength(1)
    expect(html.match(/id="dataset-evidence-data-02"/g)).toHaveLength(1)
    expect(html).toContain('<td>true</td>')
    expect(html).toContain('<td>null</td>')
  })
})
