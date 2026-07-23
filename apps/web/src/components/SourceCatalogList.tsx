/* eslint-disable no-unused-vars -- Babel does not mark Solid JSX imports as used. */
import { For, Show, type Component } from 'solid-js'
import type { SourceCatalogItem } from '@struct/domain'

export const SourceCatalogList: Component<{
  readonly items: ReadonlyArray<SourceCatalogItem>
}> = (props) => (
  <section class="rounded-box border border-base-300 bg-base-100 p-4" aria-labelledby="source-catalog-heading">
    <h2 id="source-catalog-heading" class="font-semibold">Sources</h2>
    <Show when={props.items.length > 0} fallback={<p class="mt-3 text-sm text-base-content/60">No sources yet.</p>}>
      <ul class="mt-3 divide-y divide-base-300">
        <For each={props.items}>
          {(item) => (
            <li class="flex flex-wrap items-center gap-3 py-3">
              <div class="min-w-0 flex-1">
                <p class="truncate font-medium">{item.name}</p>
                <p class="text-xs text-base-content/60">
                  {item.kind}{item.mediaType === null ? '' : ` · ${item.mediaType}`}
                </p>
              </div>
              <span class="badge badge-outline">{item.readiness}</span>
              <Show when={item.latestVersionId !== null}>
                <span class="font-mono text-xs text-base-content/60">
                  v{item.latestVersion}
                </span>
              </Show>
            </li>
          )}
        </For>
      </ul>
    </Show>
  </section>
)
