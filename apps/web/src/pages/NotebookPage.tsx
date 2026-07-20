/* eslint-disable no-unused-vars -- Babel does not mark Solid JSX imports as used. */
import { useParams, useSearchParams } from '@solidjs/router'
import {
  ProjectId,
  ReportId,
  WorkspaceId,
  type Finding,
} from '@struct/domain'
import { Show, createResource, type Component } from 'solid-js'
import {
  createReportFromFindings,
  exportReport,
  fetchFindings,
  fetchReport,
  mutateReport,
} from '../api/artifacts'
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
  const reportId = typeof search.reportId === 'string' && uuid.test(search.reportId)
    ? ReportId.make(search.reportId)
    : undefined
  const [existingReport] = createResource(
    () => reportId,
    (id) => fetchReport(workspaceId, projectId, id),
  )
  const notebook = () => (
    <NotebookView
      workspaceId={workspaceId}
      projectId={projectId}
      threadId={threadId}
      runId={runId}
      initialReport={existingReport()}
      loadFindings={() => fetchFindings(workspaceId, projectId)}
      composeReport={(findings: ReadonlyArray<Finding>) =>
        createReportFromFindings(workspaceId, projectId, findings)}
      mutateReport={mutateReport}
      loadReportRevision={(report, revision) =>
        fetchReport(workspaceId, projectId, report.id, revision)}
      exportReport={exportReport}
    />
  )
  return (
    <Show
      when={reportId === undefined
        || existingReport() !== undefined
        || existingReport.error !== undefined}
      fallback={
        <section class="notebook-state" role="status">
          Opening report workspace…
        </section>
      }
    >
      <Show
        when={!existingReport.error}
        fallback={
          <section class="notebook-state notebook-error" role="alert">
            This report could not be opened. Check your connection and try again.
          </section>
        }
      >
        {notebook()}
      </Show>
    </Show>
  )
}
