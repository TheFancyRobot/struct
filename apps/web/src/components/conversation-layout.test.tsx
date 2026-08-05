/* eslint-disable no-unused-vars -- Babel does not mark Solid JSX component imports as used. */
/** @jsxImportSource solid-js */
import { describe, expect, it } from 'bun:test'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { renderToString } from 'solid-js/web'
import { ConversationHistory } from './ConversationHistory'

describe('conversation layout', () => {
  it('renders role-aware message bubbles and a compact footer composer', () => {
    const html = renderToString(() => (
      <ConversationHistory
        title="Launch date"
        runs={[{ question: 'When is the launch?', status: 'completed' }]}
      />
    ))
    const panel = readFileSync(
      path.resolve(new URL('.', import.meta.url).pathname, './ConversationPanel.tsx'),
      'utf8',
    )

    expect(html).toContain('role="log"')
    expect(html).toContain('aria-label="You"')
    expect(html).toContain('aria-label="Struct"')
    expect(html).toContain('ml-auto max-w-[85%]')
    expect(html).toContain('mr-auto max-w-[85%]')
    expect(panel).toContain('mt-auto rounded-box border border-base-300 bg-base-100 p-3 shadow-sm')
    expect(panel).toContain('textarea textarea-bordered mt-2 min-h-20 w-full')
  })
})
