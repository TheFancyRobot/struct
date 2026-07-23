/* eslint-disable no-unused-vars -- Babel does not mark Solid JSX imports as used. */
import { A, useNavigate } from '@solidjs/router'
import {
  For,
  Show,
  createEffect,
  createMemo,
  createResource,
  createSignal,
  type Component,
} from 'solid-js'
import type { ProjectId, ResearchRunId, ResearchThreadId, SourceVersionId } from '@struct/domain'
import { fetchSourceCatalog, decodeSourceActivityEvent, sourceActivityUrl } from '../api/sources'
import { fetchResearchThread, fetchResearchThreads, submitResearch } from '../api/research'
import { useSSE } from '../hooks/useSSE'
import { useWorkspaceState } from './workspace/workspace-state'
import { ResearchStream } from './ResearchStream'

const SourceRefresh: Component<{
  readonly projectId: ProjectId
  readonly cursor: string
  readonly refresh: () => void
}> = (props) => {
  useSSE(
    () => sourceActivityUrl(props.projectId, props.cursor),
    decodeSourceActivityEvent,
    props.refresh,
    ['ingestion-completed', 'ingestion-failed', 'ingestion-cancelled'],
  )
  return null
}

export const ConversationPanel: Component<{
  readonly projectId: ProjectId
  readonly threadId?: ResearchThreadId
  readonly runId?: ResearchRunId
}> = (props) => {
  const navigate = useNavigate()
  const workspace = useWorkspaceState()
  const [catalog, { refetch: refetchCatalog }] = createResource(
    () => props.projectId,
    fetchSourceCatalog,
  )
  const [threads, { refetch: refetchThreads }] = createResource(
    () => props.threadId === undefined ? props.projectId : null,
    (projectId) => projectId === null ? null : fetchResearchThreads(projectId),
  )
  const [history] = createResource(
    () => props.threadId === undefined
      ? null
      : [props.projectId, props.threadId] as const,
    (scope) => scope === null ? null : fetchResearchThread(...scope),
  )
  const [selected, setSelected] = createSignal<ReadonlyArray<SourceVersionId>>([])
  const [selectionTouched, setSelectionTouched] = createSignal(false)
  const [submitting, setSubmitting] = createSignal(false)
  const [submitError, setSubmitError] = createSignal<string>()
  const storageKey = () => `struct:conversation:${props.projectId}:${props.threadId ?? 'new'}`
  const readyVersions = createMemo(() => (catalog()?.items ?? []).flatMap((item) =>
    item.readiness === 'ready' && item.latestVersionId !== null
      ? [item.latestVersionId]
      : []).slice(0, 10))

  createEffect(() => {
    const saved = window.sessionStorage.getItem(storageKey())
    if (saved === null) {
      setSelectionTouched(false)
      return
    }
    try {
      const value = JSON.parse(saved) as {
        draft?: unknown
        selected?: unknown
        selectionTouched?: unknown
      }
      if (typeof value.draft === 'string') workspace.setDraft(value.draft.slice(0, 2_048))
      if (Array.isArray(value.selected)) {
        setSelected(value.selected.filter((id): id is SourceVersionId => typeof id === 'string'))
        setSelectionTouched(value.selectionTouched === true)
      }
    } catch {
      window.sessionStorage.removeItem(storageKey())
    }
  })

  createEffect(() => {
    const ready = readyVersions()
    if (!selectionTouched()) setSelected(ready)
    else setSelected((current) => current.filter((id) => ready.includes(id)))
  })

  createEffect(() => {
    window.sessionStorage.setItem(storageKey(), JSON.stringify({
      draft: workspace.draft().slice(0, 2_048),
      selected: selected(),
      selectionTouched: selectionTouched(),
    }))
  })

  const submit = async () => {
    const question = workspace.draft().trim()
    if (question.length === 0 || selected().length === 0 || submitting()) return
    setSubmitting(true)
    setSubmitError(undefined)
    try {
      const started = await submitResearch(
        props.projectId,
        question,
        selected(),
        props.threadId,
      )
      workspace.setDraft('')
      window.sessionStorage.removeItem(storageKey())
      await refetchThreads()
      navigate(`/projects/${props.projectId}/research/${started.threadId}/runs/${started.runId}`)
    } catch {
      setSubmitError('The question could not be submitted. Your draft was preserved.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <section class="mx-auto max-w-4xl space-y-4" aria-label="Source-grounded conversation">
      <Show when={catalog()}>
        {(loaded) => (
          <SourceRefresh
            projectId={props.projectId}
            cursor={loaded().cursor}
            refresh={() => void refetchCatalog()}
          />
        )}
      </Show>
      <Show when={threads()?.items.length}>
        <nav class="rounded-box border border-base-300 bg-base-100 p-4" aria-label="Conversations">
          <h2 class="font-semibold">Conversations</h2>
          <ul class="mt-2 space-y-1">
            <For each={threads()?.items ?? []}>
              {(thread) => (
                <li>
                  <A class="link link-hover" href={`/projects/${props.projectId}/research/${thread.id}`}>
                    {thread.title}
                  </A>
                </li>
              )}
            </For>
          </ul>
        </nav>
      </Show>
      <Show when={history()}>
        {(loaded) => (
          <section class="rounded-box border border-base-300 bg-base-100 p-4">
            <h1 class="text-lg font-semibold">{loaded().thread.title}</h1>
            <ol class="mt-3 space-y-3">
              <For each={loaded().runs}>
                {(run) => (
                  <li class="rounded-box bg-base-200 p-3">
                    <p>{run.question}</p>
                    <p class="mt-1 text-xs text-base-content/60">{run.status}</p>
                  </li>
                )}
              </For>
            </ol>
          </section>
        )}
      </Show>
      <Show when={props.runId !== undefined && props.threadId !== undefined}>
        <ResearchStream
          projectId={props.projectId}
          threadId={props.threadId!}
          runId={props.runId!}
        />
      </Show>
      <form
        class="rounded-box border border-base-300 bg-base-100 p-4"
        onSubmit={(event) => {
          event.preventDefault()
          void submit()
        }}
      >
        <label class="form-control">
          <span class="label-text font-medium">Ask your sources</span>
          <textarea
            class="textarea textarea-bordered mt-2 min-h-28"
            maxlength={2048}
            value={workspace.draft()}
            onInput={(event) => workspace.setDraft(event.currentTarget.value)}
            placeholder="Ask a question grounded in the ready sources…"
          />
        </label>
        <fieldset class="mt-3">
          <legend class="text-sm font-medium">Ready sources</legend>
          <Show
            when={readyVersions().length > 0}
            fallback={<p class="mt-2 text-sm text-base-content/60">Import a source and wait for it to become ready.</p>}
          >
            <div class="mt-2 flex flex-wrap gap-3">
              <For each={(catalog()?.items ?? []).filter((item) =>
                item.readiness === 'ready' && item.latestVersionId !== null)}
              >
                {(item) => (
                  <label class="label cursor-pointer gap-2">
                    <input
                      type="checkbox"
                      class="checkbox checkbox-sm"
                      checked={selected().includes(item.latestVersionId!)}
                      disabled={!selected().includes(item.latestVersionId!) && selected().length >= 10}
                      onChange={(event) => {
                        setSelectionTouched(true)
                        setSelected((current) => event.currentTarget.checked
                          ? [...new Set([...current, item.latestVersionId!])]
                          : current.filter((id) => id !== item.latestVersionId))
                      }}
                    />
                    <span class="label-text">{item.name}</span>
                  </label>
                )}
              </For>
            </div>
          </Show>
        </fieldset>
        <Show when={submitError()}>{(error) => <p class="alert alert-error mt-3" role="alert">{error()}</p>}</Show>
        <button
          type="submit"
          class="btn btn-primary mt-4"
          disabled={submitting() || workspace.draft().trim().length === 0 || selected().length === 0}
        >
          {submitting() ? 'Submitting…' : props.threadId === undefined ? 'Start research' : 'Ask follow-up'}
        </button>
      </form>
    </section>
  )
}
