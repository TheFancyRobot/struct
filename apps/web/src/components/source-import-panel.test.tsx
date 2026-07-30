/** @jsxImportSource solid-js */
/* eslint-disable no-unused-vars -- Babel does not mark Solid JSX imports as used. */
import { describe, expect, it } from 'bun:test'
import { renderToString } from 'solid-js/web'
import {
  JobQueueId,
  ProjectId,
  SourceId,
  type SourceCatalogItem,
} from '@struct/domain'
import { BackgroundActivityTray } from './BackgroundActivityTray'
import { SourceImportPanel } from './SourceImportPanel'

const projectId = ProjectId.make('b50e8400-e29b-41d4-a716-446655440001')

function item(status: 'pending' | 'in-progress' | 'completed' | 'failed' | 'cancelled'): SourceCatalogItem {
  return {
    sourceId: SourceId.make('b50e8400-e29b-41d4-a716-446655440002'),
    name: 'notes.md',
    kind: 'document',
    mediaType: 'text/markdown',
    latestVersionId: null,
    latestVersion: null,
    readiness: status === 'failed' ? 'failed' : status === 'cancelled' ? 'cancelled' : 'pending',
    updatedAt: 1_700_000_000_000,
    job: {
      id: JobQueueId.make('b50e8400-e29b-41d4-a716-446655440003'),
      status,
      attempts: status === 'failed' ? 1 : 0,
      maxAttempts: 3,
      updatedAt: 1_700_000_000_000,
    },
    projectIds: [],
  }
}

describe('source import components', () => {
  it('keeps file and paste import in-page with a multi-file fallback explanation', () => {
    const html = renderToString(() => (
      <SourceImportPanel projectId={projectId} onAccepted={() => undefined} />
    ))

    expect(html).toContain('Add sources')
    expect(html).toContain('Files')
    expect(html).toContain('Paste')
    expect(html).toContain('select multiple files instead')
    expect(html).not.toContain('modal')
  })

  it('renders workspace import without a project', () => {
    const html = renderToString(() => (
      <SourceImportPanel projectId={null} attachToProject={false} onAccepted={() => undefined} />
    ))

    expect(html).toContain('Add sources')
    expect(html).not.toContain('Create a project')
  })

  it('exposes the import mode switcher as a labeled group with toggle-button selection semantics', () => {
    const html = renderToString(() => (
      <SourceImportPanel projectId={projectId} onAccepted={() => undefined} />
    ))

    // The group container must declare a role that supports aria-label (resolves
    // axe aria-prohibited-attr on a role-less div).
    expect(html).toMatch(/<div(?=[^>]*role="group")(?=[^>]*aria-label="Import mode")[^>]*>/)
    // Each mode button must expose its active state via aria-pressed, not just a class.
    expect(html).toMatch(/<button(?=[^>]*aria-pressed="true")[^>]*>\s*Files\s*<\/button>/)
    expect(html).toMatch(/<button(?=[^>]*aria-pressed="false")[^>]*>\s*Paste\s*<\/button>/)
    expect(html).toMatch(/<button(?=[^>]*aria-pressed="false")[^>]*>\s*Dataset\s*<\/button>/)
  })

  it('provides a visible accessible label for the file picker in the default files mode', () => {
    const html = renderToString(() => (
      <SourceImportPanel projectId={projectId} onAccepted={() => undefined} />
    ))

    expect(html).toContain('Select files to import')
    // The label must wrap the input so axe associates them (implicit labeling).
    expect(html).toMatch(/<label[^>]*>[\s\S]*?Select files to import[\s\S]*?<input[^>]*file-input[\s\S]*?<\/label>/)
  })

  it('keeps failed work actionable without hiding successful source history', () => {
    const html = renderToString(() => (
      <BackgroundActivityTray
        items={[item('failed')]}
        onCommand={() => undefined}
      />
    ))

    expect(html).toContain('Background activity')
    expect(html).toContain('Retry')
    expect(html).toContain('Remove')
  })
})
