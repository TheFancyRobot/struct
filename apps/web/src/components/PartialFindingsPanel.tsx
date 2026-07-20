/* eslint-disable no-unused-vars -- Babel's parser does not mark Solid JSX component imports as used. */
import { For, Show, createMemo, type Component } from 'solid-js'
import type {
  ProjectId,
  RecursiveResultProgress,
  ResearchThreadId,
} from '@struct/domain'

interface PartialFindingsPanelProps {
  readonly projectId: ProjectId
  readonly threadId: ResearchThreadId
  readonly result: RecursiveResultProgress
}

const shortIdentity = (value: string): string => value.slice(-10)

export const PartialFindingsPanel: Component<PartialFindingsPanelProps> = (props) => {
  const coveragePercent = createMemo(() =>
    props.result.coverage.expectedItems === 0
      ? 0
      : Math.round(
          (
            props.result.coverage.examinedItems
            / props.result.coverage.expectedItems
          ) * 100,
        ))
  const evidenceFor = (finding: RecursiveResultProgress['findings'][number], id: string) =>
    finding.evidence.find((evidence) => evidence.id === id)
  const citationFor = (evidenceId: string) =>
    props.result.citations.find((citation) => citation.evidenceId === evidenceId)

  return (
    <section
      aria-labelledby="recursive-findings-title"
      class="research-panel findings-panel"
      data-result-status={props.result.status}
    >
      <header class="panel-heading">
        <div>
          <p class="eyebrow">Evidence notebook</p>
          <h2 id="recursive-findings-title">
            {props.result.status === 'partial' ? 'Partial findings' : 'Findings'}
          </h2>
        </div>
        <span class={`state-chip ${props.result.status === 'partial' ? 'status-warn' : 'status-good'}`}>
          {coveragePercent()}% coverage
        </span>
      </header>

      <Show when={props.result.status === 'partial'}>
        <div role="note" class="partial-banner">
          <strong>Use with care.</strong>
          <span>
            These findings are inspectable now, but missing or excluded evidence may change the conclusion.
          </span>
        </div>
      </Show>

      <div class="coverage-grid" aria-label="Evidence coverage">
        <div><strong>{props.result.coverage.examinedItems}</strong><span>examined</span></div>
        <div><strong>{props.result.coverage.missingItems}</strong><span>missing</span></div>
        <div><strong>{props.result.coverage.excludedItems}</strong><span>excluded</span></div>
        <div><strong>{props.result.contradictions.length}</strong><span>contradictions</span></div>
      </div>

      <div class="finding-list">
        <For
          each={props.result.findings}
          fallback={(
            <div class="empty-state">
              <p>No supported finding has been committed yet.</p>
            </div>
          )}
        >
          {(finding, index) => (
            <article class="finding-card">
              <header>
                <span class="finding-index">{String(index() + 1).padStart(2, '0')}</span>
                <div>
                  <h3>{finding.claim}</h3>
                  <p>
                    {Math.round(finding.confidence * 100)}% confidence · {finding.evidence.length} evidence references
                  </p>
                </div>
              </header>

              <div class="evidence-columns">
                <section aria-label={`Supporting evidence for finding ${index() + 1}`}>
                  <h4>Supporting evidence</h4>
                  <ul>
                    <For each={finding.supportingExamples}>
                      {(id) => (
                        <li>
                          <span class="evidence-mark support" aria-hidden="true">+</span>
                          <span>
                            <code>{shortIdentity(id)}</code>
                            <Show when={evidenceFor(finding, id)}>
                              {(evidence) => (
                                <>
                                  <small>
                                    Source {shortIdentity(evidence().sourceVersionId)} · {evidence().locator}
                                  </small>
                                  <Show when={citationFor(evidence().id)}>
                                    {(citation) => (
                                      <a
                                        class="evidence-link"
                                        href={`/projects/${props.projectId}/research/${props.threadId}/citation/${citation().citationId}`}
                                      >
                                        Open exact citation
                                      </a>
                                    )}
                                  </Show>
                                </>
                              )}
                            </Show>
                          </span>
                        </li>
                      )}
                    </For>
                  </ul>
                </section>
                <section aria-label={`Counterevidence for finding ${index() + 1}`}>
                  <h4>Counterevidence</h4>
                  <Show
                    when={finding.counterEvidence.length > 0}
                    fallback={<p class="quiet">None retained.</p>}
                  >
                    <ul>
                      <For each={finding.counterEvidence}>
                        {(id) => (
                          <li>
                            <span class="evidence-mark conflict" aria-hidden="true">−</span>
                            <span>
                              <code>{shortIdentity(id)}</code>
                              <Show when={evidenceFor(finding, id)}>
                                {(evidence) => (
                                  <>
                                    <small>
                                      Source {shortIdentity(evidence().sourceVersionId)} · {evidence().locator}
                                    </small>
                                    <Show when={citationFor(evidence().id)}>
                                      {(citation) => (
                                        <a
                                          class="evidence-link"
                                          href={`/projects/${props.projectId}/research/${props.threadId}/citation/${citation().citationId}`}
                                        >
                                          Open exact citation
                                        </a>
                                      )}
                                    </Show>
                                  </>
                                )}
                              </Show>
                            </span>
                          </li>
                        )}
                      </For>
                    </ul>
                  </Show>
                </section>
              </div>

              <Show when={finding.limitations.length > 0}>
                <details class="limitation-disclosure">
                  <summary>Limitations ({finding.limitations.length})</summary>
                  <ul>
                    <For each={finding.limitations}>
                      {(limitation) => <li>{limitation}</li>}
                    </For>
                  </ul>
                </details>
              </Show>
            </article>
          )}
        </For>
      </div>

      <Show when={props.result.limitations.length > 0}>
        <aside class="limitations-summary" aria-label="Analysis limitations">
          <h3>Analysis caveats</h3>
          <ul>
            <For each={props.result.limitations}>
              {(limitation) => <li>{limitation}</li>}
            </For>
          </ul>
        </aside>
      </Show>
    </section>
  )
}
