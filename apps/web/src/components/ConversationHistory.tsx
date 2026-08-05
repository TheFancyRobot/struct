/* eslint-disable no-unused-vars -- Babel does not mark Solid JSX imports as used. */
import { createUniqueId, For, Show, type Component } from 'solid-js'
import type { DatasetCitation, ResearchStatus } from '@struct/domain'

export type ConversationTurn = {
  readonly question: string
  readonly status: ResearchStatus
  readonly result?: {
    readonly answer: string
    readonly citations: ReadonlyArray<{
      readonly id: string
      readonly sourceVersionId: string
      readonly locator: string
    }>
    readonly datasetCitations: ReadonlyArray<DatasetCitation>
  }
}

export const ConversationHistory: Component<{
  readonly title: string
  readonly runs: ReadonlyArray<ConversationTurn>
}> = (props) => {
  const headingId = `conversation-heading-${createUniqueId()}`
  return (
  <section aria-labelledby={headingId} class="min-w-0">
    <h1 id={headingId} class="text-lg font-semibold">{props.title}</h1>
    <ol class="mt-4 space-y-4" role="log" aria-live="polite" aria-label="Conversation messages">
      <For each={props.runs}>
        {(run) => (
          <li class="space-y-2">
            <article aria-label="You" class="ml-auto max-w-[85%] rounded-box bg-primary px-4 py-3 text-primary-content">
              <p class="text-xs font-semibold uppercase tracking-wide opacity-75">You</p>
              <p class="mt-1 whitespace-pre-wrap">{run.question}</p>
            </article>
            <article aria-label="Struct" class="mr-auto max-w-[85%] rounded-box bg-base-200 px-4 py-3">
              <p class="text-xs font-semibold uppercase tracking-wide text-base-content/60">Struct</p>
              <Show when={run.result} fallback={<p class="mt-1">Research {run.status}.</p>}>
                {(result) => (
                  <div class="mt-1 space-y-2">
                    <p class="whitespace-pre-wrap">{result().answer}</p>
                    <For each={result().citations}>
                      {(citation, index) => (
                        <p class="text-sm">Citation {index() + 1}: {citation.locator}</p>
                      )}
                    </For>
                    <For each={result().datasetCitations}>
                      {(_, index) => <p class="text-sm">Dataset citation {index() + 1}</p>}
                    </For>
                  </div>
                )}
              </Show>
            </article>
          </li>
        )}
      </For>
    </ol>
  </section>
  )
}
