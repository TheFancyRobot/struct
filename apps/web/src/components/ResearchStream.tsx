/* eslint-disable no-unused-vars -- Babel's parser does not mark Solid JSX component imports as used. */
import { A } from '@solidjs/router'
import { ErrorBoundary, For, Show, type Component } from 'solid-js'
import { createStore } from 'solid-js/store'
import { Schema } from 'effect'
import type {
  ProjectId,
  ResearchRunId,
  ResearchThreadId,
} from '@struct/domain'
import { ResearchEvent } from '@struct/domain'
import { useSSE } from '../hooks/useSSE'

interface ResearchStreamProps {
  readonly projectId: ProjectId
  readonly threadId: ResearchThreadId
  readonly runId: ResearchRunId
}

const eventLabel = (event: ResearchEvent): string => {
  switch (event.type) {
    case 'research-started': return 'Research started'
    case 'retrieval-completed': return `Retrieved ${event.data.evidenceCount} evidence items`
    case 'citations-validated': return `Validated ${event.data.citationCount} citations`
    case 'research-completed': return 'Research completed'
    case 'research-failed': return event.data.message
  }
}

export const ResearchStream: Component<ResearchStreamProps> = (props) => {
  const [state, setState] = createStore<{ events: ResearchEvent[] }>({ events: [] })
  const connection = useSSE<ResearchEvent>(
    () => `/api/projects/${props.projectId}/runs/${props.runId}/events`,
    Schema.decodeUnknownSync(ResearchEvent),
    (event) => {
      if (state.events.some((existing) => existing.cursor === event.cursor)) return
      setState('events', (events) => [...events, event])
    },
    [
      'research-started',
      'retrieval-completed',
      'citations-validated',
      'research-completed',
      'research-failed',
    ],
  )

  return (
    <ErrorBoundary fallback={<div role="alert" class="alert alert-error">Progress could not be rendered.</div>}>
      <section aria-labelledby="research-progress-title" class="space-y-4">
        <div class="flex items-center justify-between">
          <h2 id="research-progress-title" class="text-xl font-semibold">Research progress</h2>
          <span class="badge badge-outline">
            {connection.connected() ? 'Live' : connection.reconnecting() ? 'Reconnecting' : 'Connecting'}
          </span>
        </div>
        <Show when={connection.error()}>
          {(message) => <div role="alert" class="alert alert-error">{message()}</div>}
        </Show>
        <Show
          when={state.events.length > 0}
          fallback={<p class="text-base-content/60">Waiting for persisted progress…</p>}
        >
          <ol class="timeline timeline-vertical">
            <For each={state.events}>
              {(event) => (
                <li class="timeline-box">
                  <p class="font-medium">{eventLabel(event)}</p>
                  <Show when={event.type === 'research-completed' ? event : undefined}>
                    {(completed) => (
                      <div class="mt-3 space-y-3">
                        <p>{completed().data.answer}</p>
                        <For each={completed().data.citations}>
                          {(citation, index) => (
                            <A
                              class="link link-primary"
                              href={`/projects/${props.projectId}/research/${props.threadId}/citation/${citation.id}`}
                            >
                              Open citation {index() + 1}
                            </A>
                          )}
                        </For>
                      </div>
                    )}
                  </Show>
                </li>
              )}
            </For>
          </ol>
        </Show>
      </section>
    </ErrorBoundary>
  )
}
