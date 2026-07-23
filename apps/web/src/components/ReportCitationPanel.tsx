/* eslint-disable no-unused-vars -- Babel does not mark Solid JSX imports as used. */
import type { Claim } from '@struct/domain'
import { For, Show, type Component } from 'solid-js'

interface ReportCitationPanelProps {
  readonly claim: Claim | null
  readonly onClose: () => void
  readonly citationHref?: (claim: Claim) => string
}

function evidenceLabel(claim: Claim): string {
  return claim.support.kind === 'supported'
    ? claim.support.mode === 'hybrid' ? 'Mixed evidence' : `${claim.support.mode} evidence`
    : 'Unsupported'
}

function supportedEvidence(claim: Claim) {
  return claim.support.kind === 'supported' ? claim.support.evidence : []
}

function unsupportedReason(claim: Claim): string {
  return claim.support.kind === 'unsupported'
    ? claim.support.reason
    : 'This claim requires explicit repair.'
}

export const ReportCitationPanel: Component<ReportCitationPanelProps> = (props) => (
  <Show when={props.claim}>
    {(visibleClaim) => (
      <aside
        class="report-evidence-drawer open fixed inset-y-0 right-0 z-50 w-full overflow-y-auto border-l border-base-300 bg-base-100 p-4 sm:w-[26rem] sm:p-5"
        aria-labelledby="report-evidence-title"
      >
    <header class="flex items-start justify-between gap-4">
      <div>
        <p class="text-sm font-semibold text-primary">Claim evidence</p>
        <h2 id="report-evidence-title" class="mt-1 text-2xl font-semibold">
          {props.claim === null ? 'Evidence' : evidenceLabel(props.claim)}
        </h2>
      </div>
      <button class="btn btn-circle btn-ghost btn-sm" type="button" onClick={props.onClose} aria-label="Close evidence">
        ×
      </button>
    </header>
          <div class={`claim-state claim-state-${visibleClaim().citation.state} mt-5 flex items-center justify-between gap-3 rounded-field bg-base-200 p-3`}>
            <span class="badge badge-outline">{visibleClaim().citation.state}</span>
            <small class="text-xs text-base-content/55">Immutable citation · revision {visibleClaim().citation.revision}</small>
          </div>
          <blockquote class="my-5 border-l-2 border-primary/30 pl-4 text-xl leading-relaxed">
            {visibleClaim().revisions[visibleClaim().currentRevision]?.content}
          </blockquote>
          <Show
            when={visibleClaim().support.kind === 'supported'}
            fallback={
              <div class="evidence-invalid alert alert-error items-start" role="alert">
                <span aria-hidden="true">!</span>
                <div>
                <strong>Evidence is not publishable</strong>
                <p>
                  {unsupportedReason(visibleClaim())}
                </p>
                </div>
              </div>
            }
          >
            <div class="report-evidence-list space-y-3">
                <For each={supportedEvidence(visibleClaim())}>
                  {(evidence, index) => (
                    <article class="report-evidence-card card border border-base-300 bg-base-100">
                      <div class="card-body gap-3 p-4">
                      <header class="flex items-center justify-between gap-3">
                        <span class="badge badge-ghost badge-sm">{evidence.payload.kind}</span>
                        <strong class={evidence.stance === 'supports' ? 'text-success' : 'text-warning'}>
                          {evidence.stance === 'supports' ? 'Supports' : 'Contradicts'}
                        </strong>
                      </header>
                      <Show when={evidence.payload.kind === 'document'}>
                        <p class="text-sm">{evidence.payload.kind === 'document'
                          ? evidence.payload.excerpt
                          : ''}</p>
                        <code class="break-anywhere text-xs text-base-content/55">{evidence.payload.kind === 'document'
                          ? evidence.payload.citationLocator
                          : ''}</code>
                      </Show>
                      <Show when={evidence.payload.kind === 'dataset'}>
                        <p class="text-sm">Exact immutable query result</p>
                        <code class="break-anywhere text-xs text-base-content/55">{evidence.payload.kind === 'dataset'
                          ? evidence.payload.evidence.citation.resultHash
                          : ''}</code>
                      </Show>
                      <Show when={evidence.payload.kind === 'recursive'}>
                        <p class="text-sm">{evidence.payload.kind === 'recursive'
                          ? evidence.payload.excerpt
                          : ''}</p>
                        <code class="break-anywhere text-xs text-base-content/55">{evidence.payload.kind === 'recursive'
                          ? evidence.payload.reference.artifact.digest
                          : ''}</code>
                      </Show>
                      <small class="text-xs text-base-content/50">
                        Evidence {index() + 1} · {evidence.semantics.version ?? 'fixed snapshot'}
                      </small>
                      </div>
                    </article>
                  )}
                </For>
              </div>
          </Show>
          <Show when={props.citationHref?.(visibleClaim())}>
            {(href) => (
              <a class="evidence-open-source btn btn-primary mt-4 w-full" href={href()}>
                Open source citation
              </a>
            )}
          </Show>
      </aside>
    )}
  </Show>
)
