/* eslint-disable no-unused-vars -- Babel does not mark Solid JSX imports as used. */
import { For, Show, createEffect, createSignal, type Component } from 'solid-js'
import type { ProjectId, SourceImportResponse } from '@struct/domain'
import { importBrowserSources } from '../api/sources'

type ImportMode = 'files' | 'folder' | 'paste'

export const SourceImportPanel: Component<{
  readonly projectId: ProjectId
  readonly onAccepted: (result: SourceImportResponse) => void
}> = (props) => {
  const [mode, setMode] = createSignal<ImportMode>('files')
  const [files, setFiles] = createSignal<ReadonlyArray<File>>([])
  const [pasteName, setPasteName] = createSignal('pasted-notes.md')
  const [pasteContent, setPasteContent] = createSignal('')
  const [busy, setBusy] = createSignal(false)
  const [error, setError] = createSignal<string | null>(null)
  const [rejected, setRejected] = createSignal<SourceImportResponse['rejected']>([])
  let fileInput: HTMLInputElement | undefined
  const folderPickerSupported = typeof HTMLInputElement !== 'undefined'
    && 'webkitdirectory' in HTMLInputElement.prototype

  createEffect(() => {
    if (mode() === 'folder') {
      fileInput?.setAttribute('webkitdirectory', '')
    } else {
      fileInput?.removeAttribute('webkitdirectory')
    }
  })

  const submit = async (event: SubmitEvent) => {
    event.preventDefault()
    if (busy()) return
    setBusy(true)
    setError(null)
    setRejected([])
    try {
      const result = await importBrowserSources(
        props.projectId,
        mode() === 'paste'
          ? { mode: 'paste', name: pasteName(), content: pasteContent() }
          : { mode: mode() as 'files' | 'folder', files: files() },
      )
      setRejected(result.rejected)
      if (result.accepted.length > 0) {
        setFiles([])
        if (fileInput !== undefined) fileInput.value = ''
        setPasteContent('')
        props.onAccepted(result)
      }
    } catch {
      setError('Sources could not be accepted. Check the files and try again.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <section class="rounded-box border border-base-300 bg-base-100 p-4" aria-labelledby="source-import-heading">
      <div class="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 id="source-import-heading" class="font-semibold">Add sources</h2>
          <p class="mt-1 text-sm text-base-content/65">
            Accepted items continue processing in the background.
          </p>
        </div>
        <div class="join" aria-label="Import mode">
          <button type="button" class="btn btn-sm join-item" classList={{ 'btn-active': mode() === 'files' }} onClick={() => setMode('files')}>
            Files
          </button>
          <button type="button" class="btn btn-sm join-item" classList={{ 'btn-active': mode() === 'paste' }} onClick={() => setMode('paste')}>
            Paste
          </button>
          <Show when={folderPickerSupported}>
            <button type="button" class="btn btn-sm join-item" classList={{ 'btn-active': mode() === 'folder' }} onClick={() => setMode('folder')}>
              Folder
            </button>
          </Show>
        </div>
      </div>

      <form class="mt-4 space-y-3" onSubmit={(event) => void submit(event)}>
        <Show when={mode() !== 'paste'} fallback={(
          <>
            <label class="form-control block">
              <span class="label-text">Source name</span>
              <input class="input input-bordered mt-1 w-full" required value={pasteName()} onInput={(event) => setPasteName(event.currentTarget.value)} />
            </label>
            <label class="form-control block">
              <span class="label-text">Text or Markdown</span>
              <textarea class="textarea textarea-bordered mt-1 min-h-32 w-full" required value={pasteContent()} onInput={(event) => setPasteContent(event.currentTarget.value)} />
            </label>
          </>
        )}>
          <input
            class="file-input file-input-bordered w-full"
            type="file"
            multiple
            required
            ref={(input) => { fileInput = input }}
            onChange={(event) => setFiles(Array.from(event.currentTarget.files ?? []))}
          />
          <Show when={!folderPickerSupported}>
            <p class="text-xs text-base-content/60">
              Folder selection is unavailable in this browser; select multiple files instead.
            </p>
          </Show>
        </Show>
        <button class="btn btn-primary btn-sm" type="submit" disabled={busy()}>
          {busy() ? 'Accepting…' : 'Add sources'}
        </button>
      </form>

      <Show when={error() !== null}>
        <p class="alert alert-error mt-3 text-sm" role="alert">{error()}</p>
      </Show>
      <Show when={rejected().length > 0}>
        <ul class="mt-3 space-y-1 text-sm text-error" aria-live="polite">
          <For each={rejected()}>{(item) => <li>{item.name}: {item.reason}</li>}</For>
        </ul>
      </Show>
    </section>
  )
}
