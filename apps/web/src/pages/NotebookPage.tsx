/* eslint-disable no-unused-vars -- Babel does not mark Solid JSX imports as used. */
import { useParams, useSearchParams } from '@solidjs/router'
import { ProjectId, WorkspaceId, type Finding } from '@struct/domain'
import type { Component } from 'solid-js'
import { createReportFromFindings, fetchFindings } from '../api/artifacts'
import { NotebookView } from '../components/NotebookView'

export const NotebookPage: Component = () => {
  const params = useParams()
  const [search] = useSearchParams()
  const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
  const rawProjectId = params.projectId
  const rawWorkspaceId = typeof search.workspaceId === 'string'
    ? search.workspaceId
    : undefined
  if (
    rawProjectId === undefined
    || rawWorkspaceId === undefined
    || !uuid.test(rawProjectId)
    || !uuid.test(rawWorkspaceId)
  ) {
    return (
      <section class="notebook-state notebook-error" role="alert">
        This project notebook link is invalid.
      </section>
    )
  }
  const projectId = ProjectId.make(rawProjectId)
  const workspaceId = WorkspaceId.make(rawWorkspaceId)
  const threadId = typeof search.threadId === 'string'
    && uuid.test(search.threadId)
    ? search.threadId
    : undefined
  const runId = typeof search.runId === 'string' && uuid.test(search.runId)
    ? search.runId
    : undefined
  return (
    <NotebookView
      workspaceId={workspaceId}
      projectId={projectId}
      threadId={threadId}
      runId={runId}
      loadFindings={() => fetchFindings(workspaceId, projectId)}
      composeReport={(findings: ReadonlyArray<Finding>) =>
        createReportFromFindings(workspaceId, projectId, findings)}
    />
  )
}
