import { describe, expect, it } from 'bun:test'
import {
  isCanonicalStagedArtifactRef,
  MAX_STAGED_ARTIFACT_NAME_LENGTH,
} from './logical-refs'

const uuid = '550e8400-e29b-41d4-a716-446655440000'

describe('isCanonicalStagedArtifactRef', () => {
  it('accepts the bounded path-safe shape emitted by staged storage', () => {
    expect(isCanonicalStagedArtifactRef(`staged://${uuid}/notes.md`)).toBe(true)
    expect(
      isCanonicalStagedArtifactRef(
        `staged://${uuid}/${'a'.repeat(MAX_STAGED_ARTIFACT_NAME_LENGTH)}`,
      ),
    ).toBe(true)
  })

  it('rejects aliases, traversal, malformed identifiers, and unbounded names', () => {
    for (const ref of [
      `staged://${uuid}/Notes.md`,
      `staged://${uuid}/NOTES.MD`,
      `staged://${uuid}/notes.md\n`,
      `staged://${uuid}/../secret.md`,
      `staged://${uuid}/notes..md`,
      `staged://${uuid}/nested/notes.md`,
      'staged://not-a-uuid/notes.md',
      `https://${uuid}/notes.md`,
      `staged://${uuid}/${'a'.repeat(MAX_STAGED_ARTIFACT_NAME_LENGTH + 1)}`,
    ]) {
      expect(isCanonicalStagedArtifactRef(ref)).toBe(false)
    }
  })
})
