/* eslint-disable no-unused-vars -- Babel does not mark Solid JSX imports as used. */
import { A, useNavigate, useSearchParams } from '@solidjs/router'
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
  archiveNote,
  createNote,
  fetchNote,
  fetchNotes,
  updateNote,
} from '../api/notes'

interface Draft {
  readonly title: string
  readonly body: string
  readonly expectedRevision: number
}

function draftKey(projectId: ProjectId, noteId: NoteId): string {
  return `struct:note:${projectId}:${noteId}`
}

function readDraft(key: string): Draft | null {
  const raw = window.sessionStorage.getItem(key)
  if (raw === null) return null
  try {
    const value = JSON.parse(raw) as Partial<Draft>
    return typeof value.title === 'string'
      && typeof value.body === 'string'
      && typeof value.expectedRevision === 'number'
      ? {
          title: value.title,
          body: value.body,
          expectedRevision: value.expectedRevision,
        }
      : null
  } catch {
    window.sessionStorage.removeItem(key)
    return null
  }
}

export const NotesPanel: Component<{
  readonly projectId: ProjectId
  readonly noteId?: NoteId
}> = (props) => {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const archived = () => searchParams.archived === 'true'
  const [notes, { refetch: refetchNotes }] = createResource(
    () => [props.projectId, archived()] as const,
    ([projectId, includeArchived]) => fetchNotes(projectId, includeArchived),
  )
  const [note, { refetch: refetchNote }] = createResource(
    () => props.noteId === undefined
      ? null
      : [props.projectId, props.noteId, archived()] as const,
    (scope) => scope === null ? null : fetchNote(...scope),
  )
  const [title, setTitle] = createSignal('')
  const [body, setBody] = createSignal('')
  const [revision, setRevision] = createSignal(0)
  const [dirty, setDirty] = createSignal(false)
  const [status, setStatus] = createSignal<
    'idle' | 'saving' | 'saved' | 'failed' | 'conflict'
  >('idle')
  let loadedNoteId: NoteId | undefined
  let saving: Promise<boolean> | undefined

  createEffect(() => {
    const loaded = note()
    if (loaded === undefined || loaded === null || loaded.id === loadedNoteId) return
    loadedNoteId = loaded.id
    const draft = readDraft(draftKey(props.projectId, loaded.id))
    setTitle(draft?.title ?? loaded.current.title)
    setBody(draft?.body ?? loaded.current.body)
    setRevision(draft?.expectedRevision ?? loaded.current.revision)
    setDirty(draft !== null)
    setStatus(
      draft !== null && draft.expectedRevision !== loaded.current.revision
        ? 'conflict'
        : 'idle',
    )
  })

  createEffect(() => {
    const noteId = props.noteId
    if (!dirty() || noteId === undefined) return
    window.sessionStorage.setItem(draftKey(props.projectId, noteId), JSON.stringify({
      title: title(),
      body: body(),
      expectedRevision: revision(),
    } satisfies Draft))
  })

  const save = (): Promise<boolean> => {
    if (!dirty() || props.noteId === undefined) return Promise.resolve(true)
    if (saving !== undefined) return saving
    const noteId = props.noteId
    const snapshot = {
      title: title(),
      body: body(),
      expectedRevision: revision(),
    }
    setStatus('saving')
    saving = updateNote({
      projectId: props.projectId,
      noteId,
      ...snapshot,
    }).then(async (saved) => {
      setRevision(saved.current.revision)
      if (title() === snapshot.title && body() === snapshot.body) {
        setTitle(saved.current.title)
        setBody(saved.current.body)
        setDirty(false)
        window.sessionStorage.removeItem(draftKey(props.projectId, noteId))
        setStatus('saved')
      } else {
        setStatus('idle')
      }
      await refetchNotes()
      return true
    }).catch((error: unknown) => {
      setStatus(error instanceof NoteConflictError ? 'conflict' : 'failed')
      return false
    }).finally(() => {
      saving = undefined
    })
    return saving
  }

  const flush = async (): Promise<boolean> => {
    const saved = await save()
    return saved && dirty() ? flush() : saved
  }

  createEffect(() => {
    const currentTitle = title()
    const currentBody = body()
    if (
      !dirty()
      || props.noteId === undefined
      || status() === 'failed'
      || status() === 'conflict'
    ) return
    const timer = window.setTimeout(() => {
      void currentTitle
      void currentBody
      void save()
    }, 750)
    onCleanup(() => window.clearTimeout(timer))
  })

  onCleanup(() => {
    if (dirty()) void flush()
  })

  const reloadLatest = async () => {
    const noteId = props.noteId
    if (noteId === undefined) return
    window.sessionStorage.removeItem(draftKey(props.projectId, noteId))
    setDirty(false)
    setStatus('idle')
    loadedNoteId = undefined
    await refetchNote()
  }

  const saveCopy = async () => {
    const loaded = note()
    if (loaded === undefined || loaded === null) return
    setStatus('saving')
    try {
      const copy = await createNote({
        projectId: props.projectId,
        title: title(),
        body: body(),
        origin: loaded.origin,
        idempotencyKey: `note-copy:${loaded.id}:${crypto.randomUUID()}`,
      })
      window.sessionStorage.removeItem(draftKey(props.projectId, loaded.id))
      navigate(`/projects/${props.projectId}/notes/${copy.id}`)
    } catch {
      setStatus('failed')
    }
  }

  const setArchived = async (next: boolean) => {
    const loaded = note()
    if (loaded === undefined || loaded === null || !await flush()) return
    setStatus('saving')
    try {
      const saved = await archiveNote({
        projectId: props.projectId,
        noteId: loaded.id,
        archived: next,
        expectedRevision: revision(),
      })
      setRevision(saved.current.revision)
      setDirty(false)
      setStatus('saved')
      setSearchParams({ archived: next ? 'true' : undefined })
      navigate(
        next
          ? `/projects/${props.projectId}/notes?archived=true`
          : `/projects/${props.projectId}/notes/${loaded.id}`,
      )
    } catch (error) {
      setStatus(error instanceof NoteConflictError ? 'conflict' : 'failed')
    }
  }

  return (
    <section class="mx-auto grid max-w-5xl gap-4 lg:grid-cols-[18rem_minmax(0,1fr)]" aria-label="Notes">
      <aside class="rounded-box border border-base-300 bg-base-100 p-4">
        <div class="flex items-center justify-between gap-2">
          <h1 class="text-lg font-semibold">Notes</h1>
          <button
            class="btn btn-ghost btn-xs"
            type="button"
            onClick={() => setSearchParams({ archived: archived() ? undefined : 'true' })}
          >
            {archived() ? 'Active notes' : 'Archived notes'}
          </button>
        </div>
        <Show when={notes.loading}><p role="status" class="mt-3">Loading notes…</p></Show>
        <Show when={notes.error}>
          <div role="alert" class="alert alert-error mt-3">
            <span>Notes could not be loaded.</span>
            <button class="btn btn-sm" type="button" onClick={() => void refetchNotes()}>Retry</button>
          </div>
        </Show>
        <Show when={!notes.loading && !notes.error && (notes()?.items.length ?? 0) === 0}>
          <p class="mt-3 text-sm text-base-content/60">
            {archived() ? 'No archived notes.' : 'Save an answer to create your first note.'}
          </p>
        </Show>
        <ul class="mt-3 space-y-2">
          <For each={notes()?.items ?? []}>
            {(item) => (
              <li>
                <A
                  class="link link-hover"
                  href={
                    `/projects/${props.projectId}/notes/${item.id}`
                    + (archived() ? '?archived=true' : '')
                  }
                  aria-current={item.id === props.noteId ? 'page' : undefined}
                  onClick={() => { void flush() }}
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
                  if (status() === 'failed') setStatus('idle')
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
                  if (status() === 'failed') setStatus('idle')
                }}
              />
            </label>
            <p class="mt-2 text-sm" role="status">
              {status() === 'saving' ? 'Saving…'
                : status() === 'saved' ? 'Saved'
                  : status() === 'failed' ? 'Save failed. Your draft is preserved.'
                    : status() === 'conflict' ? 'This note changed elsewhere. Your draft is preserved.'
                      : ''}
            </p>
            <Show when={status() === 'failed'}>
              <button class="btn btn-sm mt-2" type="button" onClick={() => void save()}>
                Retry
              </button>
            </Show>
            <Show when={status() === 'conflict'}>
              <div class="mt-2 flex flex-wrap gap-2">
                <button class="btn btn-sm" type="button" onClick={() => void reloadLatest()}>
                  Reload latest
                </button>
                <button class="btn btn-sm" type="button" onClick={() => void saveCopy()}>
                  Save copy
                </button>
              </div>
            </Show>
            <button
              class="btn btn-outline btn-sm mt-4"
              type="button"
              onClick={() => void setArchived(!note()!.archived)}
            >
              {note()!.archived ? 'Restore note' : 'Archive note'}
            </button>
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
                      onClick={() => { void flush() }}
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
