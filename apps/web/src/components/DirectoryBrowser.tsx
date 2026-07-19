/** @jsxImportSource solid-js */
/* eslint-disable no-unused-vars -- Babel's parser does not mark Solid JSX component imports as used. */
import { For, Show, type Component } from 'solid-js'
import type { DirectoryStatusProjection } from '@struct/domain'

export interface DirectoryBrowserProps {
  readonly status: DirectoryStatusProjection
}

export const DirectoryBrowser: Component<DirectoryBrowserProps> = (props) => (
  <section aria-labelledby="directory-browser-title" class="space-y-3">
    <h2 id="directory-browser-title" class="text-xl font-semibold">
      {props.status.name}
    </h2>
    <dl class="grid grid-cols-2 gap-2 sm:grid-cols-3">
      <div><dt>Total</dt><dd>{props.status.counts.total}</dd></div>
      <div><dt>Processed</dt><dd>{props.status.counts.processed}</dd></div>
      <div><dt>Succeeded</dt><dd>{props.status.counts.succeeded}</dd></div>
      <div><dt>Failed</dt><dd>{props.status.counts.failed}</dd></div>
      <div><dt>Unsupported</dt><dd>{props.status.counts.unsupported}</dd></div>
      <div><dt>Pending</dt><dd>{props.status.counts.pending}</dd></div>
    </dl>
    <Show when={props.status.failures.length > 0}>
      <div role="alert" class="alert alert-warning">
        <div>
          <h3 class="font-semibold">Entry failures</h3>
          <ul>
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
  </section>
)
