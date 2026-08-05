/* eslint-disable no-unused-vars -- Babel does not mark Solid JSX component imports as used. */
/** @jsxImportSource solid-js */
import { describe, expect, it } from 'bun:test'
import { renderToString } from 'solid-js/web'
import { ConversationHistory } from './ConversationHistory'

describe('conversation layout', () => {
  it('renders persisted answers and citations in instance-safe conversations', () => {
    const html = renderToString(() => (
      <>
        <ConversationHistory
          title="Launch date"
          runs={[{
            question: 'When is the launch?',
            status: 'completed',
            result: {
              answer: 'July 18.',
              citations: [{
                id: '750e8400-e29b-41d4-a716-446655440001',
                sourceVersionId: '750e8400-e29b-41d4-a716-446655440002',
                locator: 'lines:1-1',
              }],
              datasetCitations: [],
            },
          }]}
        />
        <ConversationHistory title="Follow-up" runs={[]} />
      </>
    ))

    expect(html).toContain('role="log"')
    expect(html).toContain('aria-label="You"')
    expect(html).toContain('aria-label="Struct"')
    expect(html).toContain('July 18.')
    expect(html).toContain('Citation 1: lines:1-1')
    expect(html).not.toContain('Research completed.')
    expect(new Set([...html.matchAll(/id="(conversation-heading-[^"]+)"/g)].map(
      (match) => match[1],
    )).size).toBe(2)
  })
})
