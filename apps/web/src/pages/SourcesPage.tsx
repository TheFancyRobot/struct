/* eslint-disable no-unused-vars -- Babel does not mark Solid JSX imports as used. */
import { useParams } from '@solidjs/router'
import { Schema } from 'effect'
import {
  Show,
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
  sourceActivityUrl,
} from '../api/sources'
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
  const [catalog, { refetch }] = createResource(
    projectId,
    (id) => id === null ? null : fetchSourceCatalog(id),
  )
  const [commandError, setCommandError] = createSignal<string>()

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

  return (
    <section class="mx-auto max-w-4xl space-y-4">
      <Show when={projectId() !== null} fallback={<p class="alert alert-error">This project is no longer available.</p>}>
        <Show when={commandError()}>{(error) => <p class="alert alert-error" role="alert">{error()}</p>}</Show>
        <Show when={catalog.error === undefined} fallback={(
          <section class="alert alert-error gap-3" role="alert">
            <span>Sources could not be loaded.</span>
            <button type="button" class="btn btn-sm" onClick={() => void refetch()}>Retry</button>
          </section>
        )}>
          <Show when={catalog() ?? undefined} fallback={<p class="rounded-box border border-base-300 bg-base-100 p-4" role="status">Loading sources…</p>}>
            {(loaded) => (
              <>
                <SourceActivitySubscription
                  projectId={projectId()!}
                  cursor={loaded().cursor}
                  onEvent={() => void refetch()}
                />
                <BackgroundActivityTray
                  items={loaded().items}
                  onCommand={(item, command) => void control(item, command)}
                />
                <SourceImportPanel
                  projectId={projectId()!}
                  onAccepted={() => void refetch()}
                />
                <SourceCatalogList items={loaded().items} />
              </>
            )}
          </Show>
        </Show>
      </Show>
    </section>
  )
}
