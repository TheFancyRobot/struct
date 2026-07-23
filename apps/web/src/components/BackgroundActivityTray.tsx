/* eslint-disable no-unused-vars -- Babel does not mark Solid JSX imports as used. */
import {
  For,
  Show,
  createEffect,
  createMemo,
  createSignal,
  onCleanup,
  type Component,
} from 'solid-js'
import type { SourceCatalogItem } from '@struct/domain'

export const BackgroundActivityTray: Component<{
  readonly items: ReadonlyArray<SourceCatalogItem>
  readonly onCommand: (item: SourceCatalogItem, command: 'cancel' | 'retry') => void
}> = (props) => {
  const [dismissed, setDismissed] = createSignal<ReadonlySet<string>>(new Set())
  const [showCompleted, setShowCompleted] = createSignal(false)
  let collapseTimer: number | undefined
  const activities = createMemo(() => props.items.filter((item) =>
    item.job !== null
    && item.job.status !== 'completed'
    && !dismissed().has(item.job.id)))
  const hasCompleted = createMemo(() => props.items.some((item) => item.job?.status === 'completed'))

  createEffect(() => {
    if (activities().length > 0 || !hasCompleted()) {
      setShowCompleted(false)
      return
    }
    setShowCompleted(true)
    if (collapseTimer !== undefined) window.clearTimeout(collapseTimer)
    collapseTimer = window.setTimeout(() => setShowCompleted(false), 4_000)
  })
  onCleanup(() => {
    if (collapseTimer !== undefined) window.clearTimeout(collapseTimer)
  })

  return (
    <Show when={activities().length > 0 || showCompleted()}>
      <section class="rounded-box border border-base-300 bg-base-100 p-3" aria-live="polite" aria-label="Background source activity">
        <h2 class="text-sm font-semibold">Background activity</h2>
        <Show when={activities().length > 0} fallback={<p class="mt-2 text-sm text-success">All imports complete.</p>}>
          <ul class="mt-2 space-y-2">
            <For each={activities()}>
              {(item) => (
                <li class="rounded border border-base-300 p-2 text-sm">
                  <div class="flex items-center justify-between gap-2">
                    <span class="truncate font-medium">{item.name}</span>
                    <span class="badge badge-sm">{item.job?.status}</span>
                  </div>
                  <div class="mt-2 flex flex-wrap gap-2">
                    <Show when={item.job?.status === 'pending' || item.job?.status === 'in-progress'}>
                      <button type="button" class="btn btn-ghost btn-xs" onClick={() => props.onCommand(item, 'cancel')}>Cancel</button>
                    </Show>
                    <Show when={(item.job?.status === 'failed' || item.job?.status === 'cancelled') && (item.job?.attempts ?? 0) < (item.job?.maxAttempts ?? 0)}>
                      <button type="button" class="btn btn-ghost btn-xs" onClick={() => props.onCommand(item, 'retry')}>Retry</button>
                    </Show>
                    <Show when={item.job?.status === 'failed' || item.job?.status === 'cancelled'}>
                      <button
                        type="button"
                        class="btn btn-ghost btn-xs"
                        onClick={() => setDismissed(new Set([...dismissed(), item.job!.id]))}
                      >
                        Remove
                      </button>
                    </Show>
                  </div>
                </li>
              )}
            </For>
          </ul>
        </Show>
      </section>
    </Show>
  )
}
