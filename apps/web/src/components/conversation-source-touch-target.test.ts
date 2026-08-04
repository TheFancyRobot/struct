import { describe, expect, it } from 'bun:test'
import { readFileSync } from 'node:fs'
import path from 'node:path'

const conversationPanel = readFileSync(
  path.resolve(new URL('.', import.meta.url).pathname, './ConversationPanel.tsx'),
  'utf8',
)

describe('BUG-0083 conversation source touch targets', () => {
  it('keeps each ready-source label at the 44px minimum target size with separation when wrapped', () => {
    expect(conversationPanel).toContain('class="mt-2 flex flex-wrap gap-3"')
    expect(conversationPanel).toContain(
      'class="flex min-h-11 cursor-pointer items-center gap-2 rounded-box px-2"',
    )
  })
})
