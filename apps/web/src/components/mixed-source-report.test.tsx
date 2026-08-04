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

  it('uses AA-contrast metadata in the light mixed-source report', () => {
    const html = renderToString(() => (
      <MixedSourceReport report={mixedSourceDemoFixture('complete')} />
    ))

    expect(html).toMatch(/<h4 class="[^"]*text-base-content\/65[^"]*">Documents · 2<\/h4>/)
    expect(html).toMatch(/<small class="[^"]*text-base-content\/65[^"]*">lines 118–123<\/small>/)
    expect(html).toMatch(/<code class="[^"]*text-base-content\/65[^"]*">v4 · sha256:7a91…e42c<\/code>/)
    expect(html).toMatch(/<h4 class="[^"]*text-base-content\/65[^"]*">Datasets · 1<\/h4>/)
    expect(html).toMatch(/<small class="[^"]*text-base-content\/65[^"]*">2026-Q2 · sha256:12df…91ab<\/small>/)
    expect(html).toMatch(/<p class="[^"]*evidence-meta[^"]*text-base-content\/65[^"]*">lines 118–123 · v4 · sha256:7a91…e42c<\/p>/)
    expect(html).toMatch(/<caption class="[^"]*text-base-content\/65[^"]*">rows 1–2 of 2 · result sha256:84ce…f10a<\/caption>/)
    expect(html).not.toMatch(/text-base-content\/55/)
  })

  it('uses AA-contrast text for compact dataset type labels in both themes', () => {
    const html = renderToString(() => (
      <MixedSourceReport report={mixedSourceDemoFixture('complete')} />
    ))

    expect(html).toMatch(/<small class="[^"]*text-base-content\/65[^"]*">VARCHAR<\/small>/)
    expect(html).toMatch(/<small class="[^"]*text-base-content\/65[^"]*">BIGINT<\/small>/)
    expect(html).not.toMatch(/<small class="[^"]*text-base-content\/45[^"]*">(?:VARCHAR|BIGINT)<\/small>/)
  })
})
