/* eslint-disable no-unused-vars -- Babel does not mark Solid JSX imports as used. */
import type { Finding, ProjectId, Report, WorkspaceId } from '@struct/domain'
import {
  For,
  Show,
  createMemo,
  createResource,
  createSignal,
  type Component,
} from 'solid-js'

export interface NotebookViewProps {
  readonly workspaceId: typeof WorkspaceId.Type
  readonly projectId: typeof ProjectId.Type
  readonly threadId?: string
  readonly runId?: string
  readonly initialFindings?: ReadonlyArray<Finding>
  readonly loadFindings: () => Promise<ReadonlyArray<Finding>>
  readonly composeReport: (
    findings: ReadonlyArray<Finding>,
  ) => Promise<Report>
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
  const [report, setReport] = createSignal<Report | null>(null)
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
      setReport(await props.composeReport(selectedFindings()))
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
    <section class="notebook-workspace" aria-labelledby="notebook-title">
      <header class="notebook-hero">
        <div>
          <p class="eyebrow">Project notebook</p>
          <h1 id="notebook-title">Findings into reports</h1>
          <p>Collect completed research, keep its evidence, and shape a durable brief.</p>
        </div>
        <button
          type="button"
          class="notebook-compose"
          disabled={selectedFindings().length === 0 || saving()}
          onClick={compose}
        >
          {saving() ? 'Saving report…' : `Compose report (${selectedFindings().length})`}
        </button>
      </header>

      <Show when={props.initialFindings === undefined && findings.loading}>
        <div class="notebook-state" role="status">Loading durable findings…</div>
      </Show>
      <Show when={props.initialFindings === undefined && findings.error}>
        <div class="notebook-state notebook-error" role="alert">
          Project notebook unavailable. Try again.
        </div>
      </Show>
      <Show when={!findings.loading && !findings.error && visibleFindings().length === 0}>
        <div class="notebook-state">
          <strong>No saved findings yet</strong>
          <span>Complete research and save its output to start this notebook.</span>
        </div>
      </Show>
      <Show when={saveError().length > 0}>
        <div class="notebook-state notebook-error" role="alert">{saveError()}</div>
      </Show>

      <div class="notebook-grid">
        <div class="notebook-finding-list" aria-label="Durable findings">
          <For each={visibleFindings()}>
            {(finding) => (
              <article
                class="notebook-finding-card"
                classList={{ selected: selected().has(finding.id) }}
              >
                <label>
                  <input
                    type="checkbox"
                    aria-label={`Select ${currentTitle(finding)}`}
                    checked={selected().has(finding.id)}
                    onChange={() => toggle(finding.id)}
                  />
                  <span class="finding-index">Finding</span>
                </label>
                <h2>{currentTitle(finding)}</h2>
                <p>
                  {finding.claims.length} claim{finding.claims.length === 1 ? '' : 's'}
                  {' · '}
                  {finding.sourceVersionIds.length} immutable source version
                  {finding.sourceVersionIds.length === 1 ? '' : 's'}
                </p>
                <Show when={hasInvalidCitation(finding)}>
                  <span class="citation-warning">Citation needs validation</span>
                </Show>
                <div class="finding-citations">
                  <For each={finding.claims}>
                    {(claim) => (
                      <Show
                        when={
                          props.threadId !== undefined
                          && props.runId === finding.runId
                        }
                        fallback={<span>{claim.citation.state}</span>}
                      >
                        <a href={
                          `/projects/${props.projectId}/research/${props.threadId}`
                          + `/citation/${claim.citation.citationId}`
                        }>
                          Open citation · {claim.citation.state}
                        </a>
                      </Show>
                    )}
                  </For>
                </div>
              </article>
            )}
          </For>
        </div>

        <aside class="report-composer" aria-label="Report preview">
          <Show
            when={report()}
            fallback={
              <div class="report-placeholder">
                <span>Report canvas</span>
                <strong>Select findings to compose a durable report.</strong>
              </div>
            }
          >
            {(current) => (
              <>
                <p class="eyebrow">Draft report · revision {current().revision}</p>
                <h2>
                  {current().titleRevisions[current().currentTitleRevision]?.content}
                </h2>
                <For each={current().sections}>
                  {(section) => (
                    <section class="report-section-card">
                      <span>{String(section.ordinal + 1).padStart(2, '0')}</span>
                      <div>
                        <h3>{section.heading}</h3>
                        <Show when={
                          section.revisions[section.currentRevision]?.content
                            .trim() !== section.heading.trim()
                        }>
                          <p>{section.revisions[section.currentRevision]?.content}</p>
                        </Show>
                      </div>
                    </section>
                  )}
                </For>
              </>
            )}
          </Show>
        </aside>
      </div>
    </section>
  )
}
