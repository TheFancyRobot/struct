/** @jsxImportSource solid-js */
/* eslint-disable no-unused-vars -- Babel does not mark Solid JSX imports as used. */
import {
  Finding,
  ProjectId,
  WorkspaceId,
} from '@struct/domain'
import { describe, expect, it } from 'bun:test'
import { Schema } from 'effect'
import { renderToString } from 'solid-js/web'
import { NotebookView } from './NotebookView'

const uuid = (suffix: string) =>
  `c80e8400-e29b-41d4-a716-${suffix.padStart(12, '0')}`
const workspaceId = WorkspaceId.make(uuid('1'))
const projectId = ProjectId.make(uuid('2'))

function finding(suffix: string, runId = uuid('3')): Finding {
  return Schema.decodeUnknownSync(Schema.typeSchema(Finding))({
    id: uuid(`${suffix}10`),
    workspaceId,
    projectId,
    runId,
    sourceVersionIds: [uuid(`${suffix}11`)],
    titleRevisions: [{
      id: uuid(`${suffix}12`),
      revision: 0,
      content: `Finding ${suffix}`,
      authorship: {
        kind: 'generated',
        runId,
        model: 'test',
        promptVersion: 'v1',
      },
      idempotencyKey: `title:${suffix}`,
      createdAt: 1n,
    }],
    currentRevision: 0,
    claims: [{
      id: uuid(`${suffix}13`),
      claimSignature: `sha256:${suffix.repeat(64)}`,
      citation: {
        citationId: uuid(`${suffix}14`),
        state: 'valid',
        revision: 0,
        supersededBy: null,
        lastIdempotencyKey: null,
        updatedAt: 1n,
      },
      origin: { kind: 'research-run', runId },
      revisions: [{
        id: uuid(`${suffix}15`),
        revision: 0,
        content: `Completed output ${suffix}`,
        authorship: {
          kind: 'generated',
          runId,
          model: 'test',
          promptVersion: 'v1',
        },
        idempotencyKey: `claim:${suffix}`,
        createdAt: 1n,
      }],
      currentRevision: 0,
      support: {
        kind: 'unsupported',
        reason: 'Durable validation required',
      },
      createdAt: 1n,
    }],
    supersededBy: null,
    createdAt: 1n,
    updatedAt: 1n,
  })
}

describe('NotebookView', () => {
  it('renders uniquely named findings and only opens citations for matching run context', () => {
    const html = renderToString(() => (
      <NotebookView
        workspaceId={workspaceId}
        projectId={projectId}
        threadId={uuid('4')}
        runId={uuid('3')}
        initialFindings={[
          finding('1'),
          finding('2', uuid('5')),
        ]}
        loadFindings={() => Promise.resolve([])}
        composeReport={() => Promise.reject(new Error('not used'))}
        mutateReport={() => Promise.reject(new Error('not used'))}
        loadReportRevision={() => Promise.reject(new Error('not used'))}
        exportReport={() => Promise.reject(new Error('not used'))}
      />
    ))
    expect(html).toContain('aria-label="Select Finding 1"')
    expect(html).toContain('aria-label="Select Finding 2"')
    expect(html.match(/Open citation · valid/g)).toHaveLength(1)
    expect(html).toContain('Citation needs validation')
  })

  it('renders an honest empty notebook', () => {
    const html = renderToString(() => (
      <NotebookView
        workspaceId={workspaceId}
        projectId={projectId}
        initialFindings={[]}
        loadFindings={() => Promise.resolve([])}
        composeReport={() => Promise.reject(new Error('not used'))}
        mutateReport={() => Promise.reject(new Error('not used'))}
        loadReportRevision={() => Promise.reject(new Error('not used'))}
        exportReport={() => Promise.reject(new Error('not used'))}
      />
    ))
    expect(html).toContain('No saved findings yet')
    expect(html).not.toContain('notebook-finding-card')
  })
})
