/* eslint-disable no-unused-vars -- Babel's parser does not mark Solid JSX component imports as used. */
import { A } from '@solidjs/router'
import { createResource, For, Show, type Component } from 'solid-js'
import type {
  CitationId,
  ProjectId,
  ResearchThreadId,
} from '@struct/domain'
import { fetchCitation } from '../api/research'

interface CitationViewerProps {
  readonly projectId: ProjectId
  readonly threadId: ResearchThreadId
  readonly citationId: CitationId
}

export const CitationViewer: Component<CitationViewerProps> = (props) => {
  const [citation, { refetch }] = createResource(
    () => [props.projectId, props.threadId, props.citationId] as const,
    ([projectId, threadId, citationId]) =>
      fetchCitation(projectId, threadId, citationId),
  )

  return (
    <section aria-labelledby="citation-title" class="max-w-3xl mx-auto space-y-4">
      <Show when={citation.loading}>
        <p>Loading citation…</p>
      </Show>
      <Show when={citation.error}>
        <div role="alert" class="alert alert-error">
          <span>{citation.error instanceof Error ? citation.error.message : 'Citation could not be loaded.'}</span>
          <button class="btn btn-sm" onClick={() => void refetch()}>Try again</button>
        </div>
      </Show>
      <Show when={citation()}>
        {(detail) => (
          <>
            <A
              class="link link-hover"
              href={`/projects/${props.projectId}/research/${props.threadId}/runs/${detail().runId}`}
            >
              ← Back to research
            </A>
            <article class="card border border-base-300 bg-base-200">
              <div class="card-body">
                <h2 id="citation-title" class="card-title">{detail().sourceName}</h2>
                <p class="text-sm text-base-content/60">
                  Immutable source version {detail().sourceVersion} · {detail().locator}
                </p>
                <pre class="whitespace-pre-wrap overflow-x-auto rounded bg-base-300 p-4">
                  <code>
                    <For each={detail().contextLines}>
                      {(line) => (
                        <span class="block">
                          <span class="select-none text-base-content/50">{line.lineNumber}: </span>
                          <For each={line.segments}>
                            {(segment) => (
                              <span classList={{ 'bg-warning/40 font-semibold': segment.cited }}>
                                {segment.text}
                              </span>
                            )}
                          </For>
                        </span>
                      )}
                    </For>
                  </code>
                </pre>
              </div>
            </article>
          </>
        )}
      </Show>
    </section>
  )
}
