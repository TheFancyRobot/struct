/** @jsxImportSource solid-js */
/* eslint-disable no-unused-vars -- Babel's parser does not mark Solid JSX component imports as used. */
import { Show, type Component } from 'solid-js'
import type {
  DirectoryProgressEventType,
  DirectoryStatusProjection,
} from '@struct/domain'

export type DirectoryViewState =
  | 'registering'
  | 'scanning'
  | 'processing'
  | 'paused'
  | 'partial-failure'
  | 'retrying'
  | 'cancelled'
  | 'completed'
  | 'reconnect-replay'

export interface DirectoryViewStateInput {
  readonly status: DirectoryStatusProjection | null
  readonly registering: boolean
  readonly reconnecting: boolean
  readonly lastEventType?: DirectoryProgressEventType
}

export function directoryViewState(
  input: DirectoryViewStateInput,
): DirectoryViewState {
  if (input.reconnecting) return 'reconnect-replay'
  if (input.registering || input.status === null) return 'registering'
  if (input.status.status === 'completed') return 'completed'
  if (input.status.status === 'cancelled') return 'cancelled'
  if (input.status.status === 'paused') return 'paused'
  if (input.status.counts.failed > 0) return 'partial-failure'
  if (
    input.lastEventType === 'directory-retried'
    || (input.status.status === 'ready' && input.status.attempts > 0)
  ) {
    return 'retrying'
  }
  if (input.status.status === 'running') return 'processing'
  return 'scanning'
}

const labels: Readonly<Record<DirectoryViewState, string>> = {
  registering: 'Registering directory',
  scanning: 'Scanning directory',
  processing: 'Processing entries',
  paused: 'Ingestion paused',
  'partial-failure': 'Completed entries with failures',
  retrying: 'Retry queued',
  cancelled: 'Ingestion cancelled',
  completed: 'Directory ready',
  'reconnect-replay': 'Reconnecting to persisted progress',
}

export interface IngestionJobStatusProps extends DirectoryViewStateInput {}

export const IngestionJobStatus: Component<IngestionJobStatusProps> = (props) => {
  const state = () => directoryViewState({
    status: props.status,
    registering: props.registering,
    reconnecting: props.reconnecting,
    lastEventType: props.lastEventType,
  })
  return (
    <section aria-live="polite" aria-label="Directory ingestion status">
      <span class="badge badge-outline" data-state={state()}>{labels[state()]}</span>
      <Show when={props.status}>
        {(status) => (
          <p class="text-sm">
            Attempt {status().attempts} of {status().maxAttempts}
          </p>
        )}
      </Show>
    </section>
  )
}
