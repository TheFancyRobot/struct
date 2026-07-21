/* eslint-disable no-unused-vars -- Babel does not mark Solid JSX imports as used. */
import type {
  ExportBundleStatus,
  Finding,
  ProjectId,
  Report,
  WorkspaceId,
} from '@struct/domain'
import {
  For,
  Show,
  createMemo,
  createResource,
  createSignal,
  type Component,
} from 'solid-js'
import type { ReportMutation } from '../api/artifacts'
import { ReportEditor } from './ReportEditor'
import { basePathFromPublicBaseUrl, withBasePath } from '../base-path'

const appBasePath = basePathFromPublicBaseUrl(import.meta.env.BASE_URL)

export interface NotebookViewProps {
  readonly workspaceId: typeof WorkspaceId.Type
  readonly projectId: typeof ProjectId.Type
  readonly threadId?: string
  readonly runId?: string
  readonly initialFindings?: ReadonlyArray<Finding>
  readonly initialReport?: Report
  readonly loadFindings: () => Promise<ReadonlyArray<Finding>>
  readonly composeReport: (
    findings: ReadonlyArray<Finding>,
  ) => Promise<Report>
  readonly mutateReport: (
    report: Report,
    mutation: ReportMutation,
  ) => Promise<Report>
  readonly loadReportRevision: (
    report: Report,
    revision: number,
  ) => Promise<Report>
  readonly exportReport: (report: Report) => Promise<ExportBundleStatus>
}

function currentTitle(finding: Finding): string {
  return finding.titleRevisions[finding.currentRevision]?.content
    ?? 'Untitled finding'
}

function hasInvalidCitation(finding: Finding): boolean {
  return finding.claims.some((claim) =>
    claim.support.kind === 'unsupported'
    || !['valid', 'publishable'].includes(claim.citation.state))
}

export const NotebookView: Component<NotebookViewProps> = (props) => {
  const [findings] = createResource(
    () => props.initialFindings === undefined,
    (shouldLoad) => shouldLoad ? props.loadFindings() : Promise.resolve([]),
  )
  const visibleFindings = () => props.initialFindings ?? findings() ?? []
  const [selected, setSelected] = createSignal<ReadonlySet<string>>(new Set())
  const [report, setReport] = createSignal<Report | null>(
    props.initialReport ?? null,
  )
  const [saving, setSaving] = createSignal(false)
  const [saveError, setSaveError] = createSignal('')
  const selectedFindings = createMemo(() =>
    visibleFindings().filter((finding) => selected().has(finding.id)))

  const toggle = (findingId: string) => {
    setSelected((current) => {
      const next = new Set(current)
      if (next.has(findingId)) next.delete(findingId)
      else next.add(findingId)
      return next
    })
  }
  const compose = async () => {
    if (selectedFindings().length === 0 || saving()) return
    setSaving(true)
    setSaveError('')
    try {
      const saved = await props.composeReport(selectedFindings())
      setReport(saved)
      const url = new URL(window.location.href)
      url.searchParams.set('reportId', saved.id)
      window.history.replaceState({}, '', url)
    } catch (error) {
      setSaveError(
        error instanceof Error
          ? error.message
          : 'The notebook could not be saved. Try again.',
      )
    } finally {
      setSaving(false)
    }
  }

  return (
    <section class="notebook-workspace space-y-5" aria-labelledby="notebook-title">
      <header class="notebook-hero flex flex-col gap-4 rounded-box border border-base-300 bg-base-100 p-4 sm:flex-row sm:items-end sm:justify-between sm:p-6">
        <div>
          <p class="text-sm font-semibold text-primary">Project notebook</p>
          <h1 id="notebook-title" class="mt-1 text-3xl font-semibold tracking-[-0.035em] sm:text-4xl">Findings into reports</h1>
          <p class="mt-2 max-w-2xl text-base text-base-content/65">Collect completed research, keep its evidence, and shape a durable brief.</p>
        </div>
        <button
          type="button"
          class="notebook-compose btn btn-primary"
          disabled={selectedFindings().length === 0 || saving()}
          onClick={compose}
        >
          {saving() ? 'Saving report…' : `Compose report (${selectedFindings().length})`}
        </button>
      </header>

      <Show when={props.initialFindings === undefined && findings.loading}>
        <div class="notebook-state flex min-h-40 items-center justify-center gap-3 rounded-box border border-base-300 bg-base-100" role="status">
          <span class="loading loading-spinner loading-md" aria-hidden="true" />
          <span>Loading durable findings…</span>
        </div>
      </Show>
      <Show when={props.initialFindings === undefined && findings.error}>
        <div class="notebook-state alert alert-error" role="alert">
          Project notebook unavailable. Try again.
        </div>
      </Show>
      <Show when={!findings.loading && !findings.error && visibleFindings().length === 0}>
        <div class="notebook-state hero min-h-48 rounded-box border border-base-300 bg-base-100">
          <div class="hero-content text-center">
            <div>
              <strong class="text-lg">No saved findings yet</strong>
              <span class="mt-1 block text-base-content/60">Complete research and save its output to start this notebook.</span>
            </div>
          </div>
        </div>
      </Show>
      <Show when={saveError().length > 0}>
        <div class="notebook-state alert alert-error" role="alert">{saveError()}</div>
      </Show>

      <div class="notebook-grid grid gap-4 lg:grid-cols-[minmax(16rem,.75fr)_minmax(0,1.75fr)]">
        <div class="notebook-finding-list space-y-3" aria-label="Durable findings">
          <For each={visibleFindings()}>
            {(finding) => (
              <article
                class="notebook-finding-card card border bg-base-100 transition-colors"
                classList={{
                  'border-primary ring-1 ring-primary/20': selected().has(finding.id),
                  'border-base-300': !selected().has(finding.id),
                }}
              >
                <div class="card-body gap-3 p-4">
                <label class="flex cursor-pointer items-center gap-2 text-sm font-medium">
                  <input
                    type="checkbox"
                    class="checkbox checkbox-primary checkbox-sm"
                    aria-label={`Select ${currentTitle(finding)}`}
                    checked={selected().has(finding.id)}
                    onChange={() => toggle(finding.id)}
                  />
                  <span class="finding-index text-xs text-base-content/55">Finding</span>
                </label>
                <h2 class="card-title text-lg">{currentTitle(finding)}</h2>
                <p class="text-sm text-base-content/60">
                  {finding.claims.length} claim{finding.claims.length === 1 ? '' : 's'}
                  {' · '}
                  {finding.sourceVersionIds.length} immutable source version
                  {finding.sourceVersionIds.length === 1 ? '' : 's'}
                </p>
                <Show when={hasInvalidCitation(finding)}>
                  <span class="citation-warning badge badge-warning badge-sm">Citation needs validation</span>
                </Show>
                <div class="finding-citations flex flex-wrap gap-2">
                  <For each={finding.claims}>
                    {(claim) => (
                      <Show
                        when={
                          props.threadId !== undefined
                          && props.runId === finding.runId
                        }
                        fallback={<span class="badge badge-ghost badge-sm">{claim.citation.state}</span>}
                      >
                        <a class="link link-primary text-sm" href={
                          withBasePath(`/projects/${props.projectId}/research/${props.threadId}`
                          + `/citation/${claim.citation.citationId}`
                          , appBasePath)
                        }>
                          Open citation · {claim.citation.state}
                        </a>
                      </Show>
                    )}
                  </For>
                </div>
                </div>
              </article>
            )}
          </For>
        </div>

        <aside class="report-composer min-w-0" aria-label="Report preview">
          <Show
            when={report()}
            fallback={
              <div class="report-placeholder hero min-h-72 rounded-box border border-base-300 bg-base-100">
                <div class="hero-content text-center">
                  <div>
                    <span class="badge badge-ghost">Report canvas</span>
                    <strong class="mt-3 block text-lg">Select findings to compose a durable report.</strong>
                  </div>
                </div>
              </div>
            }
          >
            {(current) => (
              <ReportEditor
                initialReport={current()}
                findings={visibleFindings()}
                threadId={props.threadId}
                mutate={props.mutateReport}
                loadRevision={(revision) =>
                  props.loadReportRevision(current(), revision)}
                exportCurrent={props.exportReport}
              />
            )}
          </Show>
        </aside>
      </div>
    </section>
  )
}
