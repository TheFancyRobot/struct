/* eslint-disable no-unused-vars -- Babel's parser does not mark Solid JSX component imports as used. */
import {
  For,
  Show,
  createMemo,
  type Component,
} from 'solid-js'
import type { RecursiveRunProgress } from '@struct/domain'

interface RecursiveRunTimelineProps {
  readonly progress: RecursiveRunProgress
  readonly connected: boolean
  readonly reconnecting: boolean
  readonly cancelling: boolean
  readonly cancelError?: string
  readonly onCancel: () => void
}
const statusBadge = (status: string): string => {
  if (status === 'completed' || status === 'committed') return 'badge-success'
  if (status === 'failed' || status === 'cancelled') return 'badge-error'
  if (status === 'partial' || status === 'retrying') return 'badge-warning'
  return 'badge-info'
}

const statusDot = (status: string): string => {
  if (status === 'completed' || status === 'committed') return 'bg-success'
  if (status === 'failed' || status === 'cancelled') return 'bg-error'
  if (status === 'partial' || status === 'retrying') return 'bg-warning'
  return 'bg-info'
}

const formatTime = (value: number | null): string =>
  value === null
    ? 'Not started'
    : new Intl.DateTimeFormat(undefined, {
        hour: 'numeric',
        minute: '2-digit',
        second: '2-digit',
      }).format(new Date(value))

export const RecursiveRunTimeline: Component<RecursiveRunTimelineProps> = (props) => {
  const completion = createMemo(() => props.progress.expectedPartitions === 0
    ? 0
    : Math.round(
        (
          (props.progress.committedPartitions + props.progress.failedPartitions)
          / props.progress.expectedPartitions
        ) * 100,
      ))
  const cancellable = createMemo(() =>
    !['completed', 'failed', 'cancelled'].includes(props.progress.status)
    && props.progress.cancellation === 'none')

  return (
    <section
      aria-labelledby="recursive-progress-title"
      class="research-panel recursive-timeline overflow-hidden rounded-box border border-base-300 bg-base-100"
    >
      <header class="panel-heading flex items-start justify-between gap-4 border-b border-base-300 p-4 sm:p-5">
        <div>
          <p class="text-sm font-semibold text-primary">Corpus map</p>
          <h2 id="recursive-progress-title" class="mt-1 text-2xl font-semibold tracking-tight">Analysis progress</h2>
        </div>
        <div class="connection-cluster flex flex-wrap items-center justify-end gap-2">
          <span
            class={`badge ${statusBadge(props.progress.status)}`}
            data-status={props.progress.status}
          >
            {props.progress.status}
          </span>
          <span class="connection-label text-xs text-base-content/55" aria-live="polite">
            {props.connected
              ? 'Live'
              : props.reconnecting
                ? 'Reconnecting'
                : 'Replay loaded'}
          </span>
        </div>
      </header>

      <div class="progress-summary stats stats-horizontal w-full overflow-x-auto rounded-none border-b border-base-300 bg-base-100">
        <div class="stat min-w-28 py-4"><span class="metric-value stat-value text-2xl">{completion()}%</span><span class="metric-label stat-title text-xs">accounted</span></div>
        <div class="stat min-w-28 py-4"><span class="metric-value stat-value text-2xl">{props.progress.committedPartitions}</span><span class="metric-label stat-title text-xs">committed</span></div>
        <div class="stat min-w-28 py-4"><span class="metric-value stat-value text-2xl">{props.progress.failedPartitions}</span><span class="metric-label stat-title text-xs">failed</span></div>
        <div class="stat min-w-28 py-4"><span class="metric-value stat-value text-2xl">{props.progress.recoveryCount}</span><span class="metric-label stat-title text-xs">recoveries</span></div>
      </div>
      <progress
        class="progress progress-primary mx-4 my-4 block h-1.5 w-[calc(100%_-_2rem)] sm:mx-5 sm:w-[calc(100%_-_2.5rem)]"
        value={completion()}
        max="100"
        aria-label={`${completion()} percent of partitions accounted for`}
      />

      <Show when={props.reconnecting}>
        <div role="status" class="inline-notice alert alert-info mx-4 mb-4 text-sm sm:mx-5">
          Connection interrupted. Replaying committed updates from the last cursor…
        </div>
      </Show>
      <Show when={props.cancelError}>
        {(message) => <div role="alert" class="inline-notice danger alert alert-error mx-4 mb-4 text-sm sm:mx-5">{message()}</div>}
      </Show>

      <div class="timeline-list space-y-2 border-t border-base-300 p-4 sm:p-5" aria-label="Partition progress">
        <For
          each={props.progress.partitions}
          fallback={(
            <div class="empty-state hero min-h-32 rounded-box bg-base-200">
              <p class="hero-content text-base-content/60">No partitions have committed progress yet.</p>
            </div>
          )}
        >
          {(partition) => (
            <details class="partition-row collapse collapse-arrow border border-base-300 bg-base-100">
              <summary class="collapse-title grid min-h-0 grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 p-3 pr-10 sm:grid-cols-[auto_minmax(0,1fr)_auto_auto]">
                <span class={`timeline-dot size-2.5 rounded-full ${statusDot(partition.status)}`} />
                <span class="partition-name min-w-0 font-medium">
                  Partition {partition.ordinal + 1}
                  <small class="block text-xs font-normal text-base-content/50">{partition.batches.length} {partition.batches.length === 1 ? 'batch' : 'batches'}</small>
                </span>
                <span class={`badge badge-sm ${statusBadge(partition.status)}`}>
                  {partition.status}
                </span>
                <time class="hidden text-xs text-base-content/50 sm:block">{formatTime(partition.updatedAt)}</time>
              </summary>
              <div class="partition-detail collapse-content">
                <dl class="grid gap-2 rounded-field bg-base-200 p-3 text-sm sm:grid-cols-3">
                  <div><dt class="text-xs text-base-content/50">Attempt</dt><dd>{partition.attempt}</dd></div>
                  <div><dt class="text-xs text-base-content/50">Started</dt><dd>{formatTime(partition.startedAt)}</dd></div>
                  <div><dt class="text-xs text-base-content/50">Node</dt><dd class="identity break-anywhere font-mono text-xs">{partition.nodeId}</dd></div>
                </dl>
                <Show when={partition.failureTag}>
                  {(failure) => (
                    <div role="alert" class="inline-notice danger alert alert-error mt-3 text-sm">
                      Failed with {failure()}
                    </div>
                  )}
                </Show>
                <ol class="batch-list mt-3 space-y-2">
                  <For each={partition.batches}>
                    {(batch) => (
                      <li class="flex items-center gap-3 rounded-field border border-base-300 p-3 text-sm">
                        <span class={`timeline-dot size-2.5 shrink-0 rounded-full ${statusDot(batch.status)}`} />
                        <span class="min-w-0 flex-1">
                          Batch <code>{batch.id.slice(-10)}</code>
                          <small class="block text-xs text-base-content/50">
                            {batch.evidenceIds.length} evidence references · attempt {batch.attempt}
                          </small>
                        </span>
                        <span class={`badge badge-sm ${statusBadge(batch.status)}`}>
                          {batch.status}
                        </span>
                      </li>
                    )}
                  </For>
                </ol>
              </div>
            </details>
          )}
        </For>
      </div>

      <footer class="panel-actions flex flex-col items-stretch justify-between gap-3 border-t border-base-300 p-4 sm:flex-row sm:items-center sm:p-5">
        <span class="identity break-anywhere font-mono text-xs text-base-content/50">Request {props.progress.requestId.slice(-12)}</span>
        <button
          type="button"
          class="btn btn-outline btn-sm"
          disabled={!cancellable() || props.cancelling}
          onClick={props.onCancel}
        >
          {props.cancelling
            ? 'Requesting cancellation…'
            : props.progress.cancellation === 'requested'
              ? 'Cancellation requested'
              : 'Cancel analysis'}
        </button>
      </footer>
    </section>
  )
}
