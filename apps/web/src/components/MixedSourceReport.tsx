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
    case 'complete': return 'status-good'
    case 'live': return 'status-live'
    case 'loading':
    case 'reconnecting': return 'status-warn'
    case 'cancelled':
    case 'empty':
    case 'error': return 'status-bad'
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
      class="mixed-report"
      data-report-status={props.report.status}
      data-mobile-pane={mobilePane()}
    >
      <header class="mixed-report-header">
        <div>
          <p class="eyebrow">Cross-source notebook</p>
          <h2 id="mixed-source-title">{props.report.title}</h2>
          <p>{props.report.question}</p>
        </div>
        <div class="mixed-status">
          <span class={`state-chip ${statusClass(props.report.status)}`}>
            {statusLabel(props.report.status)}
          </span>
          <span>{sourceCount()} immutable sources</span>
        </div>
      </header>

      <nav class="mixed-mobile-tabs" aria-label="Mixed-source report sections">
        <For each={[
          ['sources', 'Sources'],
          ['report', 'Synthesis'],
          ['evidence', 'Evidence'],
        ] as const}>
          {([pane, label]) => (
            <button
              type="button"
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
          <div class="mixed-state" role="status" aria-label="Loading mixed-source research">
            <span class="skeleton h-3 w-28" />
            <span class="skeleton h-9 w-2/3" />
            <span class="skeleton h-28 w-full" />
            <p>Loading committed evidence…</p>
          </div>
        </Match>
        <Match when={props.report.status === 'error'}>
          <div class="mixed-state" role="alert">
            <strong>Research result unavailable</strong>
            <p>{props.report.errorMessage}</p>
            <a href="?demo=mixed-source&state=complete">Retry the read</a>
          </div>
        </Match>
        <Match when={props.report.status === 'empty'}>
          <div class="mixed-state" role="status">
            <span class="empty-orbit" aria-hidden="true" />
            <strong>No evidence matched this question</strong>
            <p>Choose another source or narrow the question before running again.</p>
          </div>
        </Match>
        <Match when={true}>
          <div class="mixed-layout">
            <aside class="source-rail mixed-pane" aria-labelledby="source-rail-title">
              <div class="mixed-pane-heading">
                <span>01</span>
                <h3 id="source-rail-title">Sources</h3>
              </div>
              <p class="pane-intro">Immutable inputs retained for this answer.</p>
              <div class="source-group">
                <h4>Documents · {props.report.documentEvidence.length}</h4>
                <For each={props.report.documentEvidence}>
                  {(evidence) => (
                    <details class="source-item">
                      <summary>
                        <span class={`source-glyph ${evidence.stance}`}>D</span>
                        <span>
                          <strong>{evidence.sourceName}</strong>
                          <small>{evidence.locator}</small>
                        </span>
                      </summary>
                      <blockquote>“{evidence.excerpt}”</blockquote>
                      <code>{evidence.sourceVersion}</code>
                    </details>
                  )}
                </For>
              </div>
              <div class="source-group">
                <h4>Datasets · {props.report.datasetEvidence.length}</h4>
                <For each={props.report.datasetEvidence}>
                  {(evidence) => (
                    <div class="source-item dataset-source">
                      <span class="source-glyph dataset">Σ</span>
                      <span>
                        <strong>{evidence.sourceName}</strong>
                        <small>{evidence.snapshot}</small>
                      </span>
                    </div>
                  )}
                </For>
              </div>
            </aside>

            <article class="synthesis-pane mixed-pane" aria-labelledby="synthesis-title">
              <div class="mixed-pane-heading">
                <span>02</span>
                <h3 id="synthesis-title">Synthesis</h3>
              </div>
              <div class="run-progress" aria-live="polite">
                <div>
                  <span>{props.report.progressLabel}</span>
                  <strong>{props.report.progress}%</strong>
                </div>
                <progress max="100" value={props.report.progress}>
                  {props.report.progress}%
                </progress>
              </div>
              <Show when={props.report.status === 'reconnecting'}>
                <p class="mixed-callout warning" role="status">
                  Reconnecting to live progress. The report below shows the last committed checkpoint.
                </p>
              </Show>
              <Show when={props.report.status === 'cancelled'}>
                <p class="mixed-callout warning" role="status">
                  This run was cancelled. Committed evidence remains available for inspection.
                </p>
              </Show>
              <div class="answer-copy">
                <p>{props.report.answer}</p>
                <div class="inline-citations" aria-label="Answer citations">
                  <a
                    href="#document-evidence"
                    onClick={() => setMobilePane('evidence')}
                  >
                    [D1]
                  </a>
                  <a
                    href={firstDatasetEvidenceId()}
                    onClick={() => setMobilePane('evidence')}
                  >
                    [Q1]
                  </a>
                  <a href="#mismatch-note">[M1]</a>
                </div>
              </div>
              <aside id="mismatch-note" class="mismatch-note" aria-labelledby="mismatch-title">
                <span aria-hidden="true">≠</span>
                <div>
                  <h4 id="mismatch-title">Comparison disclosed</h4>
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
              <details class="report-limitations">
                <summary>Limitations · {props.report.limitations.length}</summary>
                <ul>
                  <For each={props.report.limitations}>
                    {(limitation) => <li>{limitation}</li>}
                  </For>
                </ul>
              </details>
            </article>

            <aside class="evidence-explorer mixed-pane" aria-labelledby="evidence-title">
              <div class="mixed-pane-heading">
                <span>03</span>
                <h3 id="evidence-title">Evidence</h3>
              </div>
              <section id="document-evidence" class="evidence-block">
                <p class="evidence-kicker">Exact document span · D1</p>
                <For each={props.report.documentEvidence.slice(0, 1)}>
                  {(evidence) => (
                    <>
                      <h4>{evidence.sourceName}</h4>
                      <p class="evidence-meta">{evidence.locator} · {evidence.sourceVersion}</p>
                      <blockquote>“{evidence.excerpt}”</blockquote>
                    </>
                  )}
                </For>
              </section>
              <For each={props.report.datasetEvidence}>
                {(evidence) => (
                  <section id={`dataset-evidence-${evidence.id}`} class="evidence-block">
                    <p class="evidence-kicker">Exact query result · Q1</p>
                    <h4>{evidence.sourceName}</h4>
                    <details>
                      <summary>View canonical SQL</summary>
                      <pre><code>{evidence.canonicalSql}</code></pre>
                    </details>
                    <div class="result-table-wrap" tabindex="0" aria-label="Scrollable query results">
                      <table>
                        <caption>{evidence.rowRange}</caption>
                        <thead>
                          <tr>
                            <For each={evidence.columns}>
                              {(column) => (
                                <th scope="col">
                                  {column.name}<small>{column.type}</small>
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
                    <dl class="semantics-list">
                      <For each={evidence.semantics}>
                        {(semantic) => (
                          <div>
                            <dt>{semantic.label}</dt>
                            <dd>{semantic.value}</dd>
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
