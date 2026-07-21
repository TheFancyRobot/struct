/** @jsxImportSource solid-js */
/* eslint-disable no-unused-vars -- Babel's parser does not mark Solid JSX component imports as used. */
import { For, Show, type Component } from 'solid-js'
import type { DirectoryStatusProjection } from '@struct/domain'

export interface DirectoryBrowserProps {
  readonly status: DirectoryStatusProjection
}

export const DirectoryBrowser: Component<DirectoryBrowserProps> = (props) => (
  <section aria-labelledby="directory-browser-title" class="card border border-base-300 bg-base-100">
    <div class="card-body gap-4 p-4 sm:p-5">
    <h2 id="directory-browser-title" class="text-xl font-semibold">
      {props.status.name}
    </h2>
    <dl class="stats stats-horizontal w-full overflow-x-auto border border-base-300">
      <div class="stat min-w-28 p-3"><dt class="stat-title text-xs">Total</dt><dd class="stat-value text-xl">{props.status.counts.total}</dd></div>
      <div class="stat min-w-28 p-3"><dt class="stat-title text-xs">Processed</dt><dd class="stat-value text-xl">{props.status.counts.processed}</dd></div>
      <div class="stat min-w-28 p-3"><dt class="stat-title text-xs">Succeeded</dt><dd class="stat-value text-xl">{props.status.counts.succeeded}</dd></div>
      <div class="stat min-w-28 p-3"><dt class="stat-title text-xs">Failed</dt><dd class="stat-value text-xl">{props.status.counts.failed}</dd></div>
      <div class="stat min-w-28 p-3"><dt class="stat-title text-xs">Unsupported</dt><dd class="stat-value text-xl">{props.status.counts.unsupported}</dd></div>
      <div class="stat min-w-28 p-3"><dt class="stat-title text-xs">Pending</dt><dd class="stat-value text-xl">{props.status.counts.pending}</dd></div>
    </dl>
    <Show when={props.status.failures.length > 0}>
      <div role="alert" class="alert alert-warning">
        <div>
          <h3 class="font-semibold">Entry failures</h3>
          <ul class="mt-1 list-disc pl-5 text-sm">
            <For each={props.status.failures}>
              {(failure) => (
                <li>
                  <code>{failure.relativePath}</code>: {failure.errorTag}
                </li>
              )}
            </For>
          </ul>
        </div>
      </div>
    </Show>
    </div>
  </section>
)
