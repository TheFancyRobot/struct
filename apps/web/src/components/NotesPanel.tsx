/* eslint-disable no-unused-vars -- Babel does not mark Solid JSX imports as used. */
import { A } from '@solidjs/router'
import {
  For,
  Show,
  createEffect,
  createResource,
  createSignal,
  onCleanup,
  type Component,
} from 'solid-js'
import type { NoteId, ProjectId } from '@struct/domain'
import {
  NoteConflictError,
  fetchNote,
  fetchNotes,
  updateNote,
} from '../api/notes'

export const NotesPanel: Component<{
  readonly projectId: ProjectId
  readonly noteId?: NoteId
}> = (props) => {
  const [notes, { refetch: refetchNotes }] = createResource(
    () => props.projectId,
    fetchNotes,
  )
  const [note, { refetch: refetchNote }] = createResource(
    () => props.noteId === undefined
      ? null
      : [props.projectId, props.noteId] as const,
    (scope) => scope === null ? null : fetchNote(...scope),
  )
  const [title, setTitle] = createSignal('')
  const [body, setBody] = createSignal('')
  const [revision, setRevision] = createSignal(0)
  const [dirty, setDirty] = createSignal(false)
  const [status, setStatus] = createSignal<'idle' | 'saving' | 'saved' | 'failed' | 'conflict'>('idle')

  createEffect(() => {
    const loaded = note()
    if (loaded === undefined || loaded === null || dirty()) return
    setTitle(loaded.current.title)
    setBody(loaded.current.body)
    setRevision(loaded.current.revision)
  })

  createEffect(() => {
    if (!dirty() || props.noteId === undefined) return
    const timer = window.setTimeout(async () => {
      setStatus('saving')
      try {
        const saved = await updateNote({
          projectId: props.projectId,
          noteId: props.noteId!,
          title: title(),
          body: body(),
          expectedRevision: revision(),
        })
        await refetchNote()
        setRevision(saved.current.revision)
        setDirty(false)
        setStatus('saved')
        await refetchNotes()
      } catch (error) {
        setStatus(error instanceof NoteConflictError ? 'conflict' : 'failed')
      }
    }, 750)
    onCleanup(() => window.clearTimeout(timer))
  })

  return (
    <section class="mx-auto grid max-w-5xl gap-4 lg:grid-cols-[18rem_minmax(0,1fr)]" aria-label="Notes">
      <aside class="rounded-box border border-base-300 bg-base-100 p-4">
        <h1 class="text-lg font-semibold">Notes</h1>
        <Show when={notes.loading}><p role="status" class="mt-3">Loading notes…</p></Show>
        <Show when={notes.error}>
          <div role="alert" class="alert alert-error mt-3">
            <span>Notes could not be loaded.</span>
            <button class="btn btn-sm" type="button" onClick={() => void refetchNotes()}>Retry</button>
          </div>
        </Show>
        <Show when={!notes.loading && !notes.error && (notes()?.length ?? 0) === 0}>
          <p class="mt-3 text-sm text-base-content/60">Save an answer to create your first note.</p>
        </Show>
        <ul class="mt-3 space-y-2">
          <For each={notes() ?? []}>
            {(item) => (
              <li>
                <A
                  class="link link-hover"
                  href={`/projects/${props.projectId}/notes/${item.id}`}
                  aria-current={item.id === props.noteId ? 'page' : undefined}
                >
                  {item.current.title}
                </A>
              </li>
            )}
          </For>
        </ul>
      </aside>
      <Show
        when={props.noteId !== undefined}
        fallback={<div class="rounded-box border border-base-300 bg-base-100 p-6 text-base-content/60">Select a note to edit it.</div>}
      >
        <section class="rounded-box border border-base-300 bg-base-100 p-4">
          <Show when={note.loading}><p role="status">Opening note…</p></Show>
          <Show when={note.error}>
            <div role="alert" class="alert alert-error">
              <span>This note could not be loaded.</span>
              <button class="btn btn-sm" type="button" onClick={() => void refetchNote()}>Retry</button>
            </div>
          </Show>
          <Show when={note()}>
            <label class="form-control">
              <span class="label-text">Title</span>
              <input
                class="input input-bordered mt-2"
                maxlength={200}
                value={title()}
                onInput={(event) => {
                  setTitle(event.currentTarget.value)
                  setDirty(true)
                }}
              />
            </label>
            <label class="form-control mt-4">
              <span class="label-text">Note</span>
              <textarea
                class="textarea textarea-bordered mt-2 min-h-64"
                value={body()}
                onInput={(event) => {
                  setBody(event.currentTarget.value)
                  setDirty(true)
                }}
              />
            </label>
            <p class="mt-2 text-sm" role="status">
              {status() === 'saving' ? 'Saving…'
                : status() === 'saved' ? 'Saved'
                  : status() === 'failed' ? 'Save failed. Keep editing to retry.'
                    : status() === 'conflict' ? 'This note changed elsewhere.'
                      : ''}
            </p>
            <Show when={status() === 'conflict'}>
              <button
                class="btn btn-sm mt-2"
                type="button"
                onClick={async () => {
                  setDirty(false)
                  setStatus('idle')
                  await refetchNote()
                }}
              >
                Reload latest
              </button>
            </Show>
            <section class="mt-6 border-t border-base-300 pt-4" aria-label="Original evidence">
              <h2 class="font-semibold">Original evidence</h2>
              <div class="mt-2 flex flex-wrap gap-2">
                <For each={note()?.origin.citations ?? []}>
                  {(citation, index) => (
                    <A
                      class="link link-primary"
                      href={
                        `/projects/${props.projectId}/research/${note()!.origin.threadId}`
                        + `/runs/${note()!.origin.runId}?evidence=`
                        + encodeURIComponent(`${citation.kind}:${citation.id}`)
                      }
                    >
                      Open citation {index() + 1}
                    </A>
                  )}
                </For>
              </div>
            </section>
          </Show>
        </section>
      </Show>
    </section>
  )
}
