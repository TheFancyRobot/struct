/* eslint-disable no-unused-vars -- Babel does not mark Solid JSX imports as used. */
import { For, type Component } from 'solid-js'

type ConversationTurn = {
  readonly question: string
  readonly status: string
}

export const ConversationHistory: Component<{
  readonly title: string
  readonly runs: ReadonlyArray<ConversationTurn>
}> = (props) => (
  <section aria-labelledby="conversation-heading" class="min-w-0">
    <h1 id="conversation-heading" class="text-lg font-semibold">{props.title}</h1>
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
              <p class="mt-1">Research {run.status}.</p>
            </article>
          </li>
        )}
      </For>
    </ol>
  </section>
)
