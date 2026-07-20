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
const statusTone = (status: string): string => {
  if (status === 'completed' || status === 'committed') return 'status-good'
  if (status === 'failed' || status === 'cancelled') return 'status-bad'
  if (status === 'partial' || status === 'retrying') return 'status-warn'
  return 'status-live'
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
      class="research-panel recursive-timeline"
    >
      <header class="panel-heading">
        <div>
          <p class="eyebrow">Corpus map</p>
          <h2 id="recursive-progress-title">Analysis progress</h2>
        </div>
        <div class="connection-cluster">
          <span
            class={`state-chip ${statusTone(props.progress.status)}`}
            data-status={props.progress.status}
          >
            {props.progress.status}
          </span>
          <span class="connection-label" aria-live="polite">
            {props.connected
              ? 'Live'
              : props.reconnecting
                ? 'Reconnecting'
                : 'Replay loaded'}
          </span>
        </div>
      </header>

      <div class="progress-summary">
        <div>
          <span class="metric-value">{completion()}%</span>
          <span class="metric-label">accounted</span>
        </div>
        <div>
          <span class="metric-value">{props.progress.committedPartitions}</span>
          <span class="metric-label">committed</span>
        </div>
        <div>
          <span class="metric-value">{props.progress.failedPartitions}</span>
          <span class="metric-label">failed</span>
        </div>
        <div>
          <span class="metric-value">{props.progress.recoveryCount}</span>
          <span class="metric-label">recoveries</span>
        </div>
      </div>
      <progress
        class="progress progress-primary h-1.5 w-full"
        value={completion()}
        max="100"
        aria-label={`${completion()} percent of partitions accounted for`}
      />

      <Show when={props.reconnecting}>
        <div role="status" class="inline-notice">
          Connection interrupted. Replaying committed updates from the last cursor…
        </div>
      </Show>
      <Show when={props.cancelError}>
        {(message) => <div role="alert" class="inline-notice danger">{message()}</div>}
      </Show>

      <div class="timeline-list" aria-label="Partition progress">
        <For
          each={props.progress.partitions}
          fallback={(
            <div class="empty-state">
              <span class="empty-orbit" aria-hidden="true" />
              <p>No partitions have committed progress yet.</p>
            </div>
          )}
        >
          {(partition) => (
            <details class="partition-row">
              <summary>
                <span class={`timeline-dot ${statusTone(partition.status)}`} />
                <span class="partition-name">
                  Partition {partition.ordinal + 1}
                  <small>{partition.batches.length} {partition.batches.length === 1 ? 'batch' : 'batches'}</small>
                </span>
                <span class={`state-chip ${statusTone(partition.status)}`}>
                  {partition.status}
                </span>
                <time>{formatTime(partition.updatedAt)}</time>
              </summary>
              <div class="partition-detail">
                <dl>
                  <div><dt>Attempt</dt><dd>{partition.attempt}</dd></div>
                  <div><dt>Started</dt><dd>{formatTime(partition.startedAt)}</dd></div>
                  <div><dt>Node</dt><dd class="identity">{partition.nodeId}</dd></div>
                </dl>
                <Show when={partition.failureTag}>
                  {(failure) => (
                    <p role="alert" class="inline-notice danger">
                      Failed with {failure()}
                    </p>
                  )}
                </Show>
                <ol class="batch-list">
                  <For each={partition.batches}>
                    {(batch) => (
                      <li>
                        <span class={`timeline-dot ${statusTone(batch.status)}`} />
                        <span>
                          Batch <code>{batch.id.slice(-10)}</code>
                          <small>
                            {batch.evidenceIds.length} evidence references · attempt {batch.attempt}
                          </small>
                        </span>
                        <span class={`state-chip ${statusTone(batch.status)}`}>
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

      <footer class="panel-actions">
        <span class="identity">Request {props.progress.requestId.slice(-12)}</span>
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
