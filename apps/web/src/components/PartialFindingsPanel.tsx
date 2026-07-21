/* eslint-disable no-unused-vars -- Babel's parser does not mark Solid JSX component imports as used. */
import { For, Show, createMemo, type Component } from 'solid-js'
import type {
  ProjectId,
  RecursiveResultProgress,
  ResearchThreadId,
} from '@struct/domain'
import { researchCitationPath } from './citation-paths'

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
      class="research-panel findings-panel overflow-hidden rounded-box border border-base-300 bg-base-100"
      data-result-status={props.result.status}
    >
      <header class="panel-heading flex items-start justify-between gap-4 border-b border-base-300 p-4 sm:p-5">
        <div>
          <p class="text-sm font-semibold text-primary">Evidence notebook</p>
          <h2 id="recursive-findings-title" class="mt-1 text-2xl font-semibold tracking-tight">
            {props.result.status === 'partial' ? 'Partial findings' : 'Findings'}
          </h2>
        </div>
        <span class={`badge ${props.result.status === 'partial' ? 'badge-warning' : 'badge-success'}`}>
          {coveragePercent()}% coverage
        </span>
      </header>

      <Show when={props.result.status === 'partial'}>
        <div role="note" class="partial-banner alert alert-warning m-4 items-start sm:m-5">
          <span aria-hidden="true">!</span>
          <div>
          <strong class="block">Use with care.</strong>
          <span class="text-sm">
            These findings are inspectable now, but missing or excluded evidence may change the conclusion.
          </span>
          </div>
        </div>
      </Show>

      <div class="coverage-grid stats stats-horizontal w-full overflow-x-auto rounded-none border-b border-base-300 bg-base-100" aria-label="Evidence coverage">
        <div class="stat min-w-32 py-4"><strong class="stat-value text-2xl">{props.result.coverage.examinedItems}</strong><span class="stat-title text-xs">examined</span></div>
        <div class="stat min-w-32 py-4"><strong class="stat-value text-2xl">{props.result.coverage.missingItems}</strong><span class="stat-title text-xs">missing</span></div>
        <div class="stat min-w-32 py-4"><strong class="stat-value text-2xl">{props.result.coverage.excludedItems}</strong><span class="stat-title text-xs">excluded</span></div>
        <div class="stat min-w-32 py-4"><strong class="stat-value text-2xl">{props.result.contradictions.length}</strong><span class="stat-title text-xs">contradictions</span></div>
      </div>

      <div class="finding-list space-y-3 p-4 sm:p-5">
        <For
          each={props.result.findings}
          fallback={(
            <div class="empty-state hero min-h-40 rounded-box bg-base-200">
              <p class="hero-content text-base-content/60">No supported finding has been committed yet.</p>
            </div>
          )}
        >
          {(finding, index) => (
            <article class="finding-card card border border-base-300 bg-base-100">
              <div class="card-body gap-4 p-4 sm:p-5">
              <header class="flex items-start gap-3">
                <span class="finding-index badge badge-ghost badge-sm mt-0.5">{String(index() + 1).padStart(2, '0')}</span>
                <div>
                  <h3 class="text-lg font-semibold leading-snug">{finding.claim}</h3>
                  <p class="mt-1 text-sm text-base-content/55">
                    {Math.round(finding.confidence * 100)}% confidence · {finding.evidence.length} evidence references
                  </p>
                </div>
              </header>

              <div class="evidence-columns grid gap-3 md:grid-cols-2">
                <section class="rounded-box bg-success/8 p-3" aria-label={`Supporting evidence for finding ${index() + 1}`}>
                  <h4 class="text-sm font-semibold">Supporting evidence</h4>
                  <ul class="mt-2 space-y-2">
                    <For each={finding.supportingExamples}>
                      {(id) => (
                        <li class="flex items-start gap-2 text-sm">
                          <span class="evidence-mark support badge badge-success badge-sm" aria-hidden="true">+</span>
                          <span class="min-w-0">
                            <code class="block break-anywhere text-xs">{shortIdentity(id)}</code>
                            <Show when={evidenceFor(finding, id)}>
                              {(evidence) => (
                                <>
                                  <small class="mt-0.5 block text-xs text-base-content/55">
                                    Source {shortIdentity(evidence().sourceVersionId)} · {evidence().locator}
                                  </small>
                                  <Show when={citationFor(evidence().id)}>
                                    {(citation) => (
                                      <a
                                        class="evidence-link link link-primary mt-1 block text-xs"
                                        href={researchCitationPath(
                                          props.projectId,
                                          props.threadId,
                                          citation().citationId,
                                        )}
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
                <section class="rounded-box bg-warning/8 p-3" aria-label={`Counterevidence for finding ${index() + 1}`}>
                  <h4 class="text-sm font-semibold">Counterevidence</h4>
                  <Show
                    when={finding.counterEvidence.length > 0}
                    fallback={<p class="quiet mt-2 text-sm text-base-content/50">None retained.</p>}
                  >
                    <ul class="mt-2 space-y-2">
                      <For each={finding.counterEvidence}>
                        {(id) => (
                          <li class="flex items-start gap-2 text-sm">
                            <span class="evidence-mark conflict badge badge-warning badge-sm" aria-hidden="true">−</span>
                            <span class="min-w-0">
                              <code class="block break-anywhere text-xs">{shortIdentity(id)}</code>
                              <Show when={evidenceFor(finding, id)}>
                                {(evidence) => (
                                  <>
                                    <small class="mt-0.5 block text-xs text-base-content/55">
                                      Source {shortIdentity(evidence().sourceVersionId)} · {evidence().locator}
                                    </small>
                                    <Show when={citationFor(evidence().id)}>
                                      {(citation) => (
                                        <a
                                          class="evidence-link link link-primary mt-1 block text-xs"
                                          href={researchCitationPath(
                                            props.projectId,
                                            props.threadId,
                                            citation().citationId,
                                          )}
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
                <details class="limitation-disclosure collapse collapse-arrow border border-base-300 bg-base-200">
                  <summary class="collapse-title min-h-0 py-3 text-sm font-medium">Limitations ({finding.limitations.length})</summary>
                  <ul class="collapse-content list-disc space-y-1 pl-9 text-sm text-base-content/65">
                    <For each={finding.limitations}>
                      {(limitation) => <li>{limitation}</li>}
                    </For>
                  </ul>
                </details>
              </Show>
              </div>
            </article>
          )}
        </For>
      </div>

      <Show when={props.result.limitations.length > 0}>
        <aside class="limitations-summary alert alert-warning m-4 items-start sm:m-5" aria-label="Analysis limitations">
          <span aria-hidden="true">!</span>
          <div>
          <h3 class="font-semibold">Analysis caveats</h3>
          <ul class="mt-1 list-disc space-y-1 pl-5 text-sm">
            <For each={props.result.limitations}>
              {(limitation) => <li>{limitation}</li>}
            </For>
          </ul>
          </div>
        </aside>
      </Show>
    </section>
  )
}
