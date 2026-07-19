/** @jsxImportSource solid-js */
/* eslint-disable no-unused-vars -- Babel's parser does not mark Solid JSX component imports as used. */
import {
  Show,
  createSignal,
  type Accessor,
  type Component,
} from 'solid-js'
import { Schema } from 'effect'
import {
  DirectoryProgressEvent,
  type DirectoryControlCommand,
  type DirectoryProgressEventType,
  type DirectoryStatusProjection,
  type JobQueueId,
  type ProjectId,
  type WorkspaceId,
} from '@struct/domain'
import { commandDirectory } from '../api/directories'
import { useSSE } from '../hooks/useSSE'
import { DirectoryBrowser } from './DirectoryBrowser'
import { IngestionJobStatus } from './IngestionJobStatus'
import { SourceControls } from './SourceControls'

const eventTypes: ReadonlyArray<DirectoryProgressEventType> = [
  'directory-registered',
  'directory-entry-checkpointed',
  'directory-paused',
  'directory-resumed',
  'directory-retried',
  'directory-cancelled',
  'directory-completed',
]

export interface DirectoryControlPanelProps {
  readonly workspaceId: WorkspaceId
  readonly projectId: ProjectId
  readonly jobId: JobQueueId
  readonly initialStatus: DirectoryStatusProjection
}

export interface DirectoryProgressState {
  readonly status: Accessor<DirectoryStatusProjection>
  readonly lastEventType: Accessor<DirectoryProgressEventType | undefined>
  readonly apply: (event: typeof DirectoryProgressEvent.Type) => void
  readonly replaceStatus: (status: DirectoryStatusProjection) => void
}

export function createDirectoryProgressState(
  initialStatus: DirectoryStatusProjection,
): DirectoryProgressState {
  const [status, setStatus] = createSignal(initialStatus)
  const [lastEventType, setLastEventType] =
    createSignal<DirectoryProgressEventType>()
  const seen = new Set<string>()
  return {
    status,
    lastEventType,
    replaceStatus: setStatus,
    apply: (event) => {
      if (seen.has(event.cursor)) return
      seen.add(event.cursor)
      setStatus(event.status)
      setLastEventType(event.type)
    },
  }
}

export const DirectoryControlPanel: Component<DirectoryControlPanelProps> = (
  props,
) => {
  const progress = createDirectoryProgressState(props.initialStatus)
  const [busy, setBusy] = createSignal(false)
  const [commandError, setCommandError] = createSignal<string>()
  const query = () => new URLSearchParams({
    workspaceId: props.workspaceId,
  }).toString()
  const connection = useSSE(
    () =>
      `/api/projects/${props.projectId}/directory-jobs/${props.jobId}/events?${query()}`,
    Schema.decodeUnknownSync(DirectoryProgressEvent),
    progress.apply,
    eventTypes,
  )
  const runCommand = async (command: DirectoryControlCommand) => {
    setBusy(true)
    setCommandError(undefined)
    try {
      progress.replaceStatus(await commandDirectory({
        workspaceId: props.workspaceId,
        projectId: props.projectId,
        jobId: props.jobId,
        command,
        idempotencyKey: crypto.randomUUID(),
      }))
    } catch {
      setCommandError('The directory command could not be applied.')
    } finally {
      setBusy(false)
    }
  }
  return (
    <section class="space-y-4">
      <IngestionJobStatus
        status={progress.status()}
        registering={false}
        reconnecting={connection.reconnecting()}
        lastEventType={progress.lastEventType()}
      />
      <Show when={connection.error() ?? commandError()}>
        {(error) => <div role="alert" class="alert alert-error">{error()}</div>}
      </Show>
      <DirectoryBrowser status={progress.status()} />
      <SourceControls
        status={progress.status()}
        busy={busy()}
        onCommand={(command) => void runCommand(command)}
      />
    </section>
  )
}
