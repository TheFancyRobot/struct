/* eslint-disable no-unused-vars -- Babel does not mark Solid JSX imports as used. */
import { useParams } from '@solidjs/router'
import { Schema } from 'effect'
import {
  For,
  Show,
  createEffect,
  createMemo,
  createResource,
  createSignal,
  type Component,
} from 'solid-js'
import { ProjectId, type SourceCatalog } from '@struct/domain'
import {
  commandSourceJob,
  decodeSourceActivityEvent,
  fetchSourceCatalog,
  fetchWorkspaceSourceCatalog,
  setProjectSourceAttached,
  sourceActivityUrl,
} from '../api/sources'
import { fetchProjects } from '../api/projects'
import { BackgroundActivityTray } from '../components/BackgroundActivityTray'
import { SourceCatalogList } from '../components/SourceCatalogList'
import { SourceImportPanel } from '../components/SourceImportPanel'
import { useSSE } from '../hooks/useSSE'

const SourceActivitySubscription: Component<{
  readonly projectId: typeof ProjectId.Type
  readonly cursor: string
  readonly onEvent: () => void
}> = (props) => {
  const activity = useSSE(
    () => sourceActivityUrl(props.projectId, props.cursor),
    decodeSourceActivityEvent,
    props.onEvent,
    [
      'ingestion-requested',
      'file-processed',
      'ingestion-completed',
      'ingestion-failed',
      'ingestion-retried',
      'ingestion-cancelled',
    ],
  )
  return (
    <Show when={activity.error()} fallback={(
      <Show when={activity.reconnecting()}>
        <p class="text-sm text-base-content/60" role="status">Reconnecting source activity…</p>
      </Show>
    )}>
      {(error) => (
        <section class="alert alert-warning gap-3" role="alert">
          <span>{error()}</span>
          <button type="button" class="btn btn-sm" onClick={() => window.location.reload()}>
            Reload
          </button>
        </section>
      )}
    </Show>
  )
}

export const SourcesPage: Component = () => {
  const params = useParams()
  const projectId = createMemo(() =>
    Schema.is(ProjectId)(params.projectId) ? params.projectId : null)
  const libraryMode = createMemo(() => params.projectId === undefined)
  const [projects] = createResource(fetchProjects)
  const [selectedProjectId, setSelectedProjectId] = createSignal<typeof ProjectId.Type | null>(null)
  const [attachNewSources, setAttachNewSources] = createSignal(false)
  const [catalog, { refetch }] = createResource(
    () => libraryMode() ? 'workspace' : projectId(),
    (scope) => scope === 'workspace'
      ? fetchWorkspaceSourceCatalog()
      : scope === null || !Schema.is(ProjectId)(scope)
        ? null
        : fetchSourceCatalog(scope),
  )
  const [commandError, setCommandError] = createSignal<string>()

  createEffect(() => {
    if (selectedProjectId() === null) {
      setSelectedProjectId(projects()?.items[0]?.id ?? null)
    }
  })

  const control = async (
    item: SourceCatalog['items'][number],
    command: 'cancel' | 'retry',
  ) => {
    if (item.job === null || projectId() === null) return
    try {
      await commandSourceJob(projectId()!, item.job.id, command)
      setCommandError(undefined)
      await refetch()
    } catch {
      setCommandError('The source job could not be updated. Try again.')
    }
  }

  const setAttached = async (
    sourceId: SourceCatalog['items'][number]['sourceId'],
    attached: boolean,
  ) => {
    const selected = selectedProjectId()
    if (selected === null) return
    try {
      await setProjectSourceAttached(selected, sourceId, attached)
      setCommandError(undefined)
      await refetch()
    } catch {
      setCommandError('The project source selection could not be updated. Try again.')
    }
  }

  return (
    <section class="mx-auto max-w-4xl space-y-4 px-4 sm:px-6 pt-4 sm:pt-6">
      <Show when={libraryMode() || projectId() !== null} fallback={<p class="alert alert-error">This project is no longer available.</p>}>
        <h1 class="text-lg font-semibold">{libraryMode() ? 'Source library' : 'Sources'}</h1>
        <Show when={commandError()}>{(error) => <p class="alert alert-error" role="alert">{error()}</p>}</Show>
        <Show when={libraryMode()}>
          <div data-testid="source-library-attachment-notice" class="space-y-3 rounded-box border border-base-300 bg-base-100 p-4">
            <label class="flex min-h-11 cursor-pointer items-center gap-3">
              <input
                type="checkbox"
                class="checkbox checkbox-sm"
                checked={attachNewSources()}
                disabled={selectedProjectId() === null}
                onChange={(event) => setAttachNewSources(event.currentTarget.checked)}
              />
              <span>Attach new sources to a project</span>
            </label>
            <Show when={(projects()?.items.length ?? 0) > 0}>
            <label class="form-control block">
              <span class="label-text">Project</span>
              <select
                class="select select-bordered mt-1 w-full"
                aria-label="Project for new sources"
                value={selectedProjectId() ?? ''}
                onChange={(event) => setSelectedProjectId(ProjectId.make(event.currentTarget.value))}
              >
                <For each={projects()?.items ?? []}>
                  {(project) => <option value={project.id}>{project.name}</option>}
                </For>
              </select>
            </label>
            </Show>
          </div>
        </Show>
        <SourceImportPanel
          projectId={libraryMode()
            ? attachNewSources() ? selectedProjectId() : null
            : projectId()}
          attachToProject={!libraryMode() || attachNewSources()}
          onAccepted={() => void refetch()}
        />
        <Show when={catalog.error === undefined} fallback={(
          <section class="alert alert-error gap-3" role="alert">
            <span>Sources could not be loaded.</span>
            <button type="button" class="btn btn-sm" onClick={() => void refetch()}>Retry</button>
          </section>
        )}>
        <Show when={catalog() ?? undefined} fallback={<p class="rounded-box border border-base-300 bg-base-100 p-4" role="status">Loading sources…</p>}>
          {(loaded) => (
            <>
              <Show when={!libraryMode() && projectId() !== null}>
                <SourceActivitySubscription
                  projectId={projectId()!}
                  cursor={loaded().cursor}
                  onEvent={() => void refetch()}
                />
                <BackgroundActivityTray
                  items={loaded().items}
                  onCommand={(item, command) => void control(item, command)}
                />
              </Show>
              <Show when={libraryMode()} fallback={<SourceCatalogList items={loaded().items} />}>
                <section aria-labelledby="workspace-source-library-heading">
                  <h2 id="workspace-source-library-heading" class="mb-3 text-lg font-semibold">Library sources</h2>
                  <ul class="space-y-2">
                    <For each={loaded().items} fallback={<li class="text-sm text-base-content/60">No sources loaded.</li>}>
                      {(source) => (
                        <li class="flex min-h-11 items-center justify-between gap-3 border-b border-base-300 py-2">
                          <span class="min-w-0 truncate">{source.name}</span>
                          <label class="flex min-h-11 cursor-pointer items-center gap-2 text-sm">
                            <input
                              type="checkbox"
                              class="checkbox checkbox-sm"
                              disabled={selectedProjectId() === null}
                              checked={selectedProjectId() !== null && source.projectIds.includes(selectedProjectId()!)}
                              onChange={(event) => void setAttached(source.sourceId, event.currentTarget.checked)}
                            />
                            Use in project
                          </label>
                        </li>
                      )}
                    </For>
                  </ul>
                </section>
              </Show>
            </>
          )}
        </Show>
        </Show>
      </Show>
    </section>
  )
}
