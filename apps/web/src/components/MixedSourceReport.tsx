/* eslint-disable no-unused-vars -- Babel's parser does not mark Solid JSX component imports as used. */
import {
  For,
  Match,
  Show,
  Switch,
  createMemo,
  createSignal,
  type Component,
} from 'solid-js'

export type MixedSourceReportStatus =
  | 'loading'
  | 'live'
  | 'reconnecting'
  | 'complete'
  | 'cancelled'
  | 'empty'
  | 'error'

export interface MixedSourceDocumentEvidence {
  readonly id: string
  readonly sourceName: string
  readonly sourceVersion: string
  readonly locator: string
  readonly excerpt: string
  readonly stance: 'supports' | 'conflicts'
}

export interface MixedSourceDatasetEvidence {
  readonly id: string
  readonly sourceName: string
  readonly snapshot: string
  readonly canonicalSql: string
  readonly columns: ReadonlyArray<{
    readonly name: string
    readonly type: string
  }>
  readonly rows: ReadonlyArray<ReadonlyArray<string | boolean | null>>
  readonly rowRange: string
  readonly semantics: ReadonlyArray<{
    readonly label: string
    readonly value: string
  }>
}

export interface MixedSourceReportModel {
  readonly title: string
  readonly question: string
  readonly status: MixedSourceReportStatus
  readonly progress: number
  readonly progressLabel: string
  readonly answer: string
  readonly documentEvidence: ReadonlyArray<MixedSourceDocumentEvidence>
  readonly datasetEvidence: ReadonlyArray<MixedSourceDatasetEvidence>
  readonly mismatches: ReadonlyArray<{
    readonly dimension: string
    readonly values: ReadonlyArray<string>
  }>
  readonly limitations: ReadonlyArray<string>
  readonly errorMessage?: string
}

interface MixedSourceReportProps {
  readonly report: MixedSourceReportModel
}

type MobilePane = 'sources' | 'report' | 'evidence'

const statusLabel = (
  status: MixedSourceReportStatus,
): string => {
  switch (status) {
    case 'loading': return 'Loading'
    case 'live': return 'Live'
    case 'reconnecting': return 'Reconnecting'
    case 'complete': return 'Complete'
    case 'cancelled': return 'Cancelled'
    case 'empty': return 'No evidence'
    case 'error': return 'Unavailable'
  }
}

const statusClass = (status: MixedSourceReportStatus): string => {
  switch (status) {
    case 'complete': return 'badge-success'
    case 'live': return 'badge-info'
    case 'loading':
    case 'reconnecting': return 'badge-warning'
    case 'cancelled':
    case 'empty':
    case 'error': return 'badge-error'
  }
}

export const mixedSourceDemoFixture = (
  status: MixedSourceReportStatus = 'complete',
): MixedSourceReportModel => ({
  title: 'Renewal risk synthesis',
  question: 'What is driving enterprise renewal risk, and how large is the affected cohort?',
  status,
  progress: status === 'complete' ? 100 : status === 'live' ? 68 : 42,
  progressLabel: status === 'complete'
    ? '3 evidence branches reconciled'
    : status === 'reconnecting'
      ? 'Connection interrupted · preserving committed evidence'
      : status === 'cancelled'
        ? 'Run cancelled · committed evidence retained'
        : 'Document and dataset branches in progress',
  answer: 'Delayed implementation handoffs are the clearest renewal-risk signal. '
    + 'The immutable Q2 snapshot identifies 18 affected enterprise accounts, '
    + 'representing 24.7% of the reviewed cohort. Document evidence supports the '
    + 'pattern, while one regional memo uses a narrower cohort and is disclosed below.',
  documentEvidence: [{
    id: 'doc-01',
    sourceName: 'customer-success-review.md',
    sourceVersion: 'v4 · sha256:7a91…e42c',
    locator: 'lines 118–123',
    excerpt: 'Enterprise accounts with an implementation handoff longer than '
      + 'fourteen days showed repeated sponsor escalation and delayed adoption.',
    stance: 'supports',
  }, {
    id: 'doc-02',
    sourceName: 'emea-renewal-notes.md',
    sourceVersion: 'v2 · sha256:3b80…a11d',
    locator: 'lines 41–45',
    excerpt: 'Within the EMEA strategic cohort, procurement timing was cited more '
      + 'often than implementation handoff time.',
    stance: 'conflicts',
  }],
  datasetEvidence: [{
    id: 'data-01',
    sourceName: 'renewal-health.parquet',
    snapshot: '2026-Q2 · sha256:12df…91ab',
    canonicalSql: 'SELECT handoff_risk, COUNT(*) AS accounts,\n'
      + '  ROUND(100.0 * COUNT(*) / SUM(COUNT(*)) OVER (), 1) AS cohort_pct\n'
      + 'FROM renewal_health\n'
      + "WHERE segment = 'enterprise' AND quarter = '2026-Q2'\n"
      + 'GROUP BY handoff_risk ORDER BY accounts DESC;',
    columns: [
      { name: 'handoff_risk', type: 'VARCHAR' },
      { name: 'accounts', type: 'BIGINT' },
      { name: 'cohort_pct', type: 'DECIMAL(4,1)' },
    ],
    rows: [
      ['not_flagged', '55', '75.3'],
      ['flagged', '18', '24.7'],
    ],
    rowRange: 'rows 1–2 of 2 · result sha256:84ce…f10a',
    semantics: [
      { label: 'Unit', value: 'accounts' },
      { label: 'Window', value: '2026-Q2 · UTC' },
      { label: 'Cohort', value: 'enterprise' },
      { label: 'Denominator', value: '73 reviewed accounts' },
    ],
  }],
  mismatches: [{
    dimension: 'Cohort',
    values: ['All enterprise accounts', 'EMEA strategic accounts only'],
  }],
  limitations: [
    'The EMEA memo covers a narrower cohort and is not directly comparable to the global dataset total.',
    'Three accounts with incomplete implementation dates were excluded before the immutable snapshot was created.',
  ],
  errorMessage: status === 'error'
    ? 'The mixed-source result could not be loaded. Committed progress is safe; retry the read.'
    : undefined,
})

export const MixedSourceReport: Component<MixedSourceReportProps> = (props) => {
  const [mobilePane, setMobilePane] = createSignal<MobilePane>('report')
  const sourceCount = createMemo(() =>
    props.report.documentEvidence.length + props.report.datasetEvidence.length)
  const firstDatasetEvidenceId = createMemo(() => {
    const evidence = props.report.datasetEvidence[0]
    return evidence === undefined ? '#evidence-title' : `#dataset-evidence-${evidence.id}`
  })

  return (
    <section
      aria-labelledby="mixed-source-title"
      class="mixed-report overflow-hidden rounded-box border border-base-300 bg-base-100"
      data-report-status={props.report.status}
      data-mobile-pane={mobilePane()}
    >
      <header class="mixed-report-header flex flex-col gap-4 border-b border-base-300 p-4 sm:flex-row sm:items-start sm:justify-between sm:p-5">
        <div>
          <p class="text-sm font-semibold text-primary">Cross-source notebook</p>
          <h2 id="mixed-source-title" class="mt-1 text-2xl font-semibold tracking-[-0.025em] sm:text-3xl">{props.report.title}</h2>
          <p class="mt-1 max-w-3xl text-base text-base-content/65">{props.report.question}</p>
        </div>
        <div class="mixed-status flex shrink-0 items-center gap-2 sm:flex-col sm:items-end">
          <span class={`badge ${statusClass(props.report.status)}`}>
            {statusLabel(props.report.status)}
          </span>
          <span class="text-xs text-base-content/60">{sourceCount()} immutable sources</span>
        </div>
      </header>

      <nav class="mixed-mobile-tabs tabs tabs-box m-2 grid grid-cols-3 sm:hidden" aria-label="Mixed-source report sections">
        <For each={[
          ['sources', 'Sources'],
          ['report', 'Synthesis'],
          ['evidence', 'Evidence'],
        ] as const}>
          {([pane, label]) => (
            <button
              type="button"
              class="tab h-10"
              classList={{ 'tab-active': mobilePane() === pane }}
              aria-pressed={mobilePane() === pane}
              onClick={() => setMobilePane(pane)}
            >
              {label}
            </button>
          )}
        </For>
      </nav>

      <Switch>
        <Match when={props.report.status === 'loading'}>
          <div class="mixed-state flex min-h-72 flex-col gap-4 p-6" role="status" aria-label="Loading mixed-source research">
            <span class="skeleton h-3 w-28" />
            <span class="skeleton h-9 w-2/3" />
            <span class="skeleton h-28 w-full" />
            <p class="text-sm text-base-content/60">Loading committed evidence…</p>
          </div>
        </Match>
        <Match when={props.report.status === 'error'}>
          <div class="mixed-state alert alert-error m-4" role="alert">
            <span aria-hidden="true">!</span>
            <div>
            <strong>Research result unavailable</strong>
            <p>{props.report.errorMessage}</p>
            </div>
            <a class="btn btn-sm" href="?demo=mixed-source&state=complete">Retry the read</a>
          </div>
        </Match>
        <Match when={props.report.status === 'empty'}>
          <div class="mixed-state hero min-h-72" role="status">
            <div class="hero-content text-center">
              <div class="max-w-md">
                <span class="mb-3 inline-grid size-10 place-items-center rounded-full bg-base-200 text-lg" aria-hidden="true">○</span>
                <strong class="block text-lg">No evidence matched this question</strong>
                <p class="mt-2 text-base-content/65">Choose another source or narrow the question before running again.</p>
              </div>
            </div>
          </div>
        </Match>
        <Match when={true}>
          <div class="mixed-layout block sm:grid sm:grid-cols-[minmax(12rem,.7fr)_minmax(22rem,1.3fr)] lg:grid-cols-[minmax(12rem,.7fr)_minmax(22rem,1.3fr)_minmax(18rem,1fr)]">
            <aside
              class="source-rail mixed-pane hidden min-w-0 p-4 sm:block sm:border-r sm:border-base-300"
              classList={{ 'max-sm:block': mobilePane() === 'sources' }}
              aria-labelledby="source-rail-title"
            >
              <div class="mixed-pane-heading flex items-center gap-2">
                <span class="badge badge-ghost badge-sm">01</span>
                <h3 id="source-rail-title" class="text-lg font-semibold">Sources</h3>
              </div>
              <p class="pane-intro mt-2 text-sm text-base-content/60">Immutable inputs retained for this answer.</p>
              <div class="source-group mt-5">
                <h4 class="mb-2 text-xs font-semibold text-base-content/55">Documents · {props.report.documentEvidence.length}</h4>
                <For each={props.report.documentEvidence}>
                  {(evidence) => (
                    <details class="source-item collapse collapse-arrow mb-2 border border-base-300 bg-base-100">
                      <summary class="collapse-title min-h-0 p-3 pr-9 text-sm">
                        <span class="flex min-w-0 items-center gap-2">
                          <span class={`badge badge-sm ${evidence.stance === 'supports' ? 'badge-success' : 'badge-warning'}`}>D</span>
                          <span class="min-w-0">
                            <strong class="block truncate">{evidence.sourceName}</strong>
                            <small class="block text-xs text-base-content/55">{evidence.locator}</small>
                          </span>
                        </span>
                      </summary>
                      <div class="collapse-content text-sm">
                        <blockquote class="border-l-2 border-primary/30 pl-3 text-base-content/75">“{evidence.excerpt}”</blockquote>
                        <code class="mt-3 block break-anywhere text-xs text-base-content/55">{evidence.sourceVersion}</code>
                      </div>
                    </details>
                  )}
                </For>
              </div>
              <div class="source-group mt-5">
                <h4 class="mb-2 text-xs font-semibold text-base-content/55">Datasets · {props.report.datasetEvidence.length}</h4>
                <For each={props.report.datasetEvidence}>
                  {(evidence) => (
                    <div class="source-item dataset-source flex items-center gap-2 rounded-field border border-base-300 p-3">
                      <span class="badge badge-accent badge-sm">Σ</span>
                      <span class="min-w-0">
                        <strong class="block truncate text-sm">{evidence.sourceName}</strong>
                        <small class="block text-xs text-base-content/55">{evidence.snapshot}</small>
                      </span>
                    </div>
                  )}
                </For>
              </div>
            </aside>

            <article
              class="synthesis-pane mixed-pane hidden min-w-0 p-4 sm:block sm:p-5 lg:p-6"
              classList={{ 'max-sm:block': mobilePane() === 'report' }}
              aria-labelledby="synthesis-title"
            >
              <div class="mixed-pane-heading flex items-center gap-2">
                <span class="badge badge-ghost badge-sm">02</span>
                <h3 id="synthesis-title" class="text-lg font-semibold">Synthesis</h3>
              </div>
              <div class="run-progress mt-4" aria-live="polite">
                <div class="mb-2 flex items-center justify-between gap-4 text-sm">
                  <span class="text-base-content/65">{props.report.progressLabel}</span>
                  <strong>{props.report.progress}%</strong>
                </div>
                <progress class="progress progress-primary h-1.5 w-full" max="100" value={props.report.progress}>
                  {props.report.progress}%
                </progress>
              </div>
              <Show when={props.report.status === 'reconnecting'}>
                <div class="mixed-callout alert alert-warning mt-4 text-sm" role="status">
                  Reconnecting to live progress. The report below shows the last committed checkpoint.
                </div>
              </Show>
              <Show when={props.report.status === 'cancelled'}>
                <div class="mixed-callout alert alert-warning mt-4 text-sm" role="status">
                  This run was cancelled. Committed evidence remains available for inspection.
                </div>
              </Show>
              <div class="answer-copy py-8 sm:py-10">
                <p class="text-xl leading-relaxed sm:text-2xl">{props.report.answer}</p>
                <div class="inline-citations mt-4 flex gap-2" aria-label="Answer citations">
                  <a
                    class="badge badge-outline badge-primary"
                    href="#document-evidence"
                    onClick={() => setMobilePane('evidence')}
                  >
                    [D1]
                  </a>
                  <a
                    class="badge badge-outline badge-primary"
                    href={firstDatasetEvidenceId()}
                    onClick={() => setMobilePane('evidence')}
                  >
                    [Q1]
                  </a>
                  <a class="badge badge-outline badge-warning" href="#mismatch-note">[M1]</a>
                </div>
              </div>
              <aside id="mismatch-note" class="mismatch-note alert alert-warning items-start" aria-labelledby="mismatch-title">
                <span class="text-xl" aria-hidden="true">≠</span>
                <div>
                  <h4 id="mismatch-title" class="font-semibold">Comparison disclosed</h4>
                  <For each={props.report.mismatches}>
                    {(mismatch) => (
                      <p>
                        <strong>{mismatch.dimension}:</strong>{' '}
                        {mismatch.values.join(' ↔ ')}
                      </p>
                    )}
                  </For>
                </div>
              </aside>
              <details class="report-limitations collapse collapse-arrow mt-4 border border-base-300 bg-base-200">
                <summary class="collapse-title font-medium">Limitations · {props.report.limitations.length}</summary>
                <ul class="collapse-content list-disc space-y-2 pl-9 text-sm text-base-content/70">
                  <For each={props.report.limitations}>
                    {(limitation) => <li>{limitation}</li>}
                  </For>
                </ul>
              </details>
            </article>

            <aside
              class="evidence-explorer mixed-pane hidden min-w-0 border-t border-base-300 p-4 sm:col-span-2 sm:grid sm:grid-cols-2 sm:gap-4 lg:col-span-1 lg:block lg:border-l lg:border-t-0"
              classList={{ 'max-sm:block': mobilePane() === 'evidence' }}
              aria-labelledby="evidence-title"
            >
              <div class="mixed-pane-heading col-span-full flex items-center gap-2">
                <span class="badge badge-ghost badge-sm">03</span>
                <h3 id="evidence-title" class="text-lg font-semibold">Evidence</h3>
              </div>
              <section id="document-evidence" class="evidence-block card mt-4 border border-base-300 bg-base-100 p-4 sm:mt-0 lg:mt-4">
                <p class="evidence-kicker text-xs font-semibold text-primary">Exact document span · D1</p>
                <For each={props.report.documentEvidence.slice(0, 1)}>
                  {(evidence) => (
                    <>
                      <h4 class="mt-2 font-semibold">{evidence.sourceName}</h4>
                      <p class="evidence-meta mt-1 text-xs text-base-content/55">{evidence.locator} · {evidence.sourceVersion}</p>
                      <blockquote class="mt-3 border-l-2 border-primary/30 pl-3 text-sm text-base-content/75">“{evidence.excerpt}”</blockquote>
                    </>
                  )}
                </For>
              </section>
              <For each={props.report.datasetEvidence}>
                {(evidence) => (
                  <section id={`dataset-evidence-${evidence.id}`} class="evidence-block card mt-4 border border-base-300 bg-base-100 p-4 sm:mt-0 lg:mt-4">
                    <p class="evidence-kicker text-xs font-semibold text-primary">Exact query result · Q1</p>
                    <h4 class="mt-2 font-semibold">{evidence.sourceName}</h4>
                    <details class="collapse collapse-arrow mt-3 bg-base-200">
                      <summary class="collapse-title min-h-0 py-3 text-sm font-medium">View canonical SQL</summary>
                      <pre class="collapse-content overflow-x-auto text-xs"><code>{evidence.canonicalSql}</code></pre>
                    </details>
                    <div class="result-table-wrap mt-3 overflow-x-auto" tabindex="0" aria-label="Scrollable query results">
                      <table class="table table-sm">
                        <caption class="pb-2 text-left text-xs text-base-content/55">{evidence.rowRange}</caption>
                        <thead>
                          <tr>
                            <For each={evidence.columns}>
                              {(column) => (
                                <th scope="col">
                                  {column.name}<small class="block font-normal text-base-content/45">{column.type}</small>
                                </th>
                              )}
                            </For>
                          </tr>
                        </thead>
                        <tbody>
                          <For each={evidence.rows}>
                            {(row) => (
                              <tr>
                                <For each={row}>
                                  {(value) => <td>{value === null ? 'null' : String(value)}</td>}
                                </For>
                              </tr>
                            )}
                          </For>
                        </tbody>
                      </table>
                    </div>
                    <dl class="semantics-list mt-3 grid grid-cols-2 gap-px overflow-hidden rounded-field border border-base-300 bg-base-300">
                      <For each={evidence.semantics}>
                        {(semantic) => (
                          <div class="bg-base-100 p-2">
                            <dt class="text-xs text-base-content/50">{semantic.label}</dt>
                            <dd class="mt-0.5 text-sm font-medium">{semantic.value}</dd>
                          </div>
                        )}
                      </For>
                    </dl>
                  </section>
                )}
              </For>
            </aside>
          </div>
        </Match>
      </Switch>
    </section>
  )
}
