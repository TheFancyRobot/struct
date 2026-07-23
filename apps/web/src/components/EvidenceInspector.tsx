/* eslint-disable no-unused-vars -- Babel does not mark Solid JSX imports as used. */
import {
  For,
  Match,
  Switch,
  createResource,
  type Component,
} from 'solid-js'
import type {
  CitationDetail,
  DatasetCitationEvidence,
  ProjectId,
  ResearchRunId,
  ResearchThreadId,
} from '@struct/domain'
import { fetchEvidence, type EvidenceDetail } from '../api/research'
import type { EvidenceSelection } from './evidence-selection'

const DocumentEvidence: Component<{ readonly evidence: CitationDetail }> = (props) => (
  <article class="space-y-3">
    <h3 class="font-semibold">{props.evidence.sourceName}</h3>
    <p class="break-anywhere text-xs text-base-content/60">
      Immutable version {props.evidence.sourceVersion} · {props.evidence.sourceVersionId}
    </p>
    <code class="block break-anywhere text-xs">{props.evidence.locator}</code>
    <pre class="overflow-x-auto whitespace-pre-wrap rounded-field bg-neutral p-3 text-xs text-neutral-content">
      <code>
        <For each={props.evidence.contextLines}>
          {(line) => (
            <span class="block">
              <span class="select-none opacity-60">{line.lineNumber}: </span>
              <For each={line.segments}>
                {(segment) => (
                  <span classList={{ 'bg-warning/40 font-semibold': segment.cited }}>
                    {segment.text}
                  </span>
                )}
              </For>
            </span>
          )}
        </For>
      </code>
    </pre>
  </article>
)

const DatasetEvidence: Component<{
  readonly evidence: DatasetCitationEvidence
}> = (props) => (
  <article class="space-y-3">
    <h3 class="font-semibold">Deterministic dataset result</h3>
    <pre class="overflow-x-auto whitespace-pre-wrap rounded-field bg-neutral p-3 text-xs text-neutral-content"><code>{props.evidence.citation.canonicalSql}</code></pre>
    <div class="overflow-x-auto">
      <table class="table table-xs">
        <thead>
          <tr>
            <For each={props.evidence.columns}>
              {(column) => <th scope="col">{column.name}</th>}
            </For>
          </tr>
        </thead>
        <tbody>
          <For each={props.evidence.rows}>
            {(row) => (
              <tr>
                <For each={row}>{(value) => <td>{String(value ?? '')}</td>}</For>
              </tr>
            )}
          </For>
        </tbody>
      </table>
    </div>
    <dl class="space-y-1 break-anywhere text-xs">
      <dt class="font-semibold">Dataset snapshot</dt>
      <dd>{props.evidence.citation.datasetSnapshotId}</dd>
      <dt class="font-semibold">Schema hash</dt>
      <dd>{props.evidence.citation.schemaHash}</dd>
      <dt class="font-semibold">Result hash</dt>
      <dd>{props.evidence.citation.resultHash}</dd>
      <dt class="font-semibold">Engine</dt>
      <dd>{props.evidence.snapshot.engineVersion}</dd>
      <dt class="font-semibold">Rows</dt>
      <dd>
        {props.evidence.citation.rowStart}–{props.evidence.citation.rowEndExclusive}
        {props.evidence.snapshot.truncated ? ' · truncated' : ''}
      </dd>
    </dl>
  </article>
)

const EvidenceBody: Component<{ readonly detail: EvidenceDetail }> = (props) =>
  props.detail.kind === 'document'
    ? <DocumentEvidence evidence={props.detail.evidence} />
    : <DatasetEvidence evidence={props.detail.evidence} />

export const EvidenceInspector: Component<{
  readonly projectId: ProjectId
  readonly threadId: ResearchThreadId
  readonly runId: ResearchRunId
  readonly selection: EvidenceSelection
  readonly headingRef: (element: HTMLHeadingElement) => void
  readonly onClose: () => void
}> = (props) => {
  const [detail, { refetch }] = createResource(
    () => [
      props.projectId,
      props.threadId,
      props.runId,
      props.selection.kind,
      props.selection.id,
    ] as const,
    ([projectId, threadId, runId, kind, id]) =>
      fetchEvidence(projectId, threadId, runId, kind, id),
  )

  return (
    <div class="flex min-h-0 flex-1 flex-col">
      <header class="flex min-h-11 items-center justify-between gap-2">
        <h2
          id="evidence-heading"
          ref={props.headingRef}
          tabindex="-1"
          class="truncate px-2 text-sm font-semibold"
        >
          Evidence
        </h2>
        <button
          type="button"
          class="btn btn-ghost btn-sm"
          aria-label="Close evidence"
          onClick={props.onClose}
        >
          Close
        </button>
      </header>
      <div class="min-h-0 flex-1 overflow-y-auto p-2">
        <Switch>
          <Match when={detail.error}>
            <div role="alert" class="alert alert-error items-start">
              <span>{detail.error instanceof Error
                ? detail.error.message
                : 'Evidence could not be loaded.'}</span>
              <button type="button" class="btn btn-sm" onClick={() => void refetch()}>
                Try again
              </button>
            </div>
          </Match>
          <Match when={detail.loading}>
            <p class="p-4 text-sm text-base-content/65" role="status">
              Loading exact evidence…
            </p>
          </Match>
          <Match when={detail()}>
            {(loaded) => <EvidenceBody detail={loaded()} />}
          </Match>
        </Switch>
      </div>
    </div>
  )
}
