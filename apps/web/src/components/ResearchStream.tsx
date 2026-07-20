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
    case 'research-plan-accepted': return 'Research plan accepted'
    case 'research-planning-failed':
      return `Research planning failed (${event.data.reason})`
    case 'research-checkpointed': return 'Progress checkpoint saved'
    case 'retrieval-completed': return event.data.evidenceCount === 0
      ? 'No evidence matched the selected documents'
      : `Retrieved ${event.data.evidenceCount} evidence items`
    case 'citations-validated': return `Validated ${event.data.citationCount} citations`
    case 'research-cancelled': return 'Research cancelled'
    case 'research-completed': return 'Research completed'
    case 'research-failed': return event.data.message
  }
}

const failureGuidance = (errorTag: string): string => {
  switch (errorTag) {
    case 'EvidenceInsufficientError':
      return 'The selected documents did not contain enough support for an answer. Add relevant sources or narrow the question.'
    case 'EvidenceContradictionError':
      return 'The selected documents conflict on this question. Review the evidence before drawing a conclusion.'
    case 'ResearchCitationValidationError':
      return 'The answer was withheld because its supporting citation could not be verified.'
    case 'RetrievalQueryError':
      return 'The selected document evidence could not be retrieved. Retry the run.'
    case 'UnsupportedSourceTypeError':
      return 'A selected source has a format that document research does not support.'
    default:
      return 'Research could not be completed. Retry the run or review the source selection.'
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
      'research-plan-accepted',
      'research-planning-failed',
      'research-checkpointed',
      'retrieval-completed',
      'citations-validated',
      'research-cancelled',
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
          fallback={<p role="status" class="text-base-content/60">Waiting for persisted progress…</p>}
        >
          <ol aria-live="polite" class="timeline timeline-vertical">
            <For each={state.events}>
              {(event) => (
                <li class="timeline-box">
                  <p class="font-medium">{eventLabel(event)}</p>
                  <Show when={event.type === 'retrieval-completed' && event.data.evidenceCount === 0}>
                    <p class="mt-2 text-sm text-base-content/70">
                      The run will stop unless the workflow can establish sufficient evidence.
                    </p>
                  </Show>
                  <Show when={event.type === 'research-failed' ? event : undefined}>
                    {(failed) => (
                      <div role="alert" class="alert alert-warning mt-3">
                        <span>{failureGuidance(failed().data.errorTag)}</span>
                      </div>
                    )}
                  </Show>
                  <Show when={event.type === 'research-completed' ? event : undefined}>
                    {(completed) => (
                      <div class="mt-3 space-y-3">
                        <p>{completed().data.answer}</p>
                        <For each={completed().data.citations}>
                          {(citation, index) => (
                            <A
                              class="link link-primary"
                              href={`/projects/${props.projectId}/research/${props.threadId}/citation/${citation.id}`}
                              aria-label={`Open citation ${index() + 1} in source version`}
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
