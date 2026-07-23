import { describe, expect, it } from 'bun:test'

const up = await Bun.file(new URL('./0019_user_notes.sql', import.meta.url)).text()
const down = await Bun.file(new URL('./0019_user_notes.down.sql', import.meta.url)).text()

describe('note lifecycle migration', () => {
  it('keeps revisions append-only and origin immutable', () => {
    expect(up).toContain('PRIMARY KEY (note_id, revision)')
    expect(up).toContain('notes_origin_immutable')
    expect(up).toContain('octet_length(body) BETWEEN 1 AND 262144')
    expect(down).toContain('DROP TABLE IF EXISTS note_revisions')
  })
})
