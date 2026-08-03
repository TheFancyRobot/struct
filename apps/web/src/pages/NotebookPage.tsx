/* eslint-disable no-unused-vars -- Babel does not mark Solid JSX imports as used. */
import { useParams, useSearchParams } from '@solidjs/router'
import {
  ProjectId,
  ReportId,
  WorkspaceId,
  type Finding,
} from '@struct/domain'
import { Show, createResource, type Component } from 'solid-js'
import { basePathFromPublicBaseUrl, withBasePath } from '../base-path'
import {
  createReportFromFindings,
  exportReport,
  fetchFindings,
  fetchReport,
  mutateReport,
} from '../api/artifacts'
import { NotebookView } from '../components/NotebookView'
import { configuredWorkspaceId } from '../workspace-scope'

export const REPORT_LOAD_TIMEOUT_MS = 8_000

export async function waitForNotebookReport<T>(
  loadReport: (signal: AbortSignal) => Promise<T>,
  timeoutMs = REPORT_LOAD_TIMEOUT_MS,
): Promise<T> {
  const controller = new AbortController()
  let timeout: ReturnType<typeof setTimeout> | undefined
  try {
    return await Promise.race([
      loadReport(controller.signal),
      new Promise<never>((_resolve, reject) => {
        timeout = setTimeout(() => {
          reject(new Error('The report took too long to load.'))
          controller.abort()
        }, timeoutMs)
      }),
    ])
  } finally {
    if (timeout !== undefined) clearTimeout(timeout)
  }
}

export const loadNotebookReport = (
  workspaceId: typeof WorkspaceId.Type,
  projectId: typeof ProjectId.Type,
  reportId: typeof ReportId.Type,
) => waitForNotebookReport((signal) =>
  fetchReport(workspaceId, projectId, reportId, undefined, signal))

export const NotebookPage: Component = () => {
  const params = useParams()
  const [search] = useSearchParams()
  const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
  const rawProjectId = params.projectId
  if (rawProjectId === undefined || !uuid.test(rawProjectId)) {
    return (
      <section class="notebook-state alert alert-error" role="alert">
        This project notebook link is invalid.
      </section>
    )
  }
  const projectId = ProjectId.make(rawProjectId)
  const workspaceId = configuredWorkspaceId()
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
  const [existingReport, { refetch: refetchExistingReport }] = createResource(
    () => reportId,
    async (id) => {
      try {
        return { report: await loadNotebookReport(workspaceId, projectId, id) }
      } catch {
        return { report: undefined, error: true }
      }
    },
  )
  const notebook = () => (
    <NotebookView
      workspaceId={workspaceId}
      projectId={projectId}
      threadId={threadId}
      runId={runId}
      initialReport={existingReport()?.report}
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
        || existingReport()?.report !== undefined
        || existingReport()?.error === true}
      fallback={
        <section class="notebook-state flex min-h-48 items-center justify-center rounded-box border border-base-300 bg-base-100" role="status">
          <span class="loading loading-spinner loading-md" aria-hidden="true" />
          <span>Opening report workspace…</span>
        </section>
      }
    >
      <Show
        when={existingReport()?.error !== true}
        fallback={
          <section class="notebook-state alert alert-error" role="alert">
            <span>This report could not be opened. It may be unavailable or no longer exist.</span>
            <div class="flex gap-2">
              <button class="btn btn-sm" type="button" onClick={() => void refetchExistingReport()}>
                Retry
              </button>
              <a
                class="btn btn-ghost btn-sm"
                href={withBasePath(
                  `/projects/${projectId}`,
                  basePathFromPublicBaseUrl(import.meta.env.BASE_URL),
                )}
              >
                Back to project
              </a>
            </div>
          </section>
        }
      >
        {notebook()}
      </Show>
    </Show>
  )
}
