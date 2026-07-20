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
        class="report-evidence-drawer open"
        aria-labelledby="report-evidence-title"
      >
    <header>
      <div>
        <p class="eyebrow">Claim evidence</p>
        <h2 id="report-evidence-title">
          {props.claim === null ? 'Evidence' : evidenceLabel(props.claim)}
        </h2>
      </div>
      <button type="button" onClick={props.onClose} aria-label="Close evidence">
        ×
      </button>
    </header>
          <div class={`claim-state claim-state-${visibleClaim().citation.state}`}>
            <span>{visibleClaim().citation.state}</span>
            <small>Immutable citation · revision {visibleClaim().citation.revision}</small>
          </div>
          <blockquote>
            {visibleClaim().revisions[visibleClaim().currentRevision]?.content}
          </blockquote>
          <Show
            when={visibleClaim().support.kind === 'supported'}
            fallback={
              <div class="evidence-invalid" role="alert">
                <strong>Evidence is not publishable</strong>
                <p>
                  {unsupportedReason(visibleClaim())}
                </p>
              </div>
            }
          >
            <div class="report-evidence-list">
                <For each={supportedEvidence(visibleClaim())}>
                  {(evidence, index) => (
                    <article class="report-evidence-card">
                      <header>
                        <span>{evidence.payload.kind}</span>
                        <strong>
                          {evidence.stance === 'supports' ? 'Supports' : 'Contradicts'}
                        </strong>
                      </header>
                      <Show when={evidence.payload.kind === 'document'}>
                        <p>{evidence.payload.kind === 'document'
                          ? evidence.payload.excerpt
                          : ''}</p>
                        <code>{evidence.payload.kind === 'document'
                          ? evidence.payload.citationLocator
                          : ''}</code>
                      </Show>
                      <Show when={evidence.payload.kind === 'dataset'}>
                        <p>Exact immutable query result</p>
                        <code>{evidence.payload.kind === 'dataset'
                          ? evidence.payload.evidence.citation.resultHash
                          : ''}</code>
                      </Show>
                      <Show when={evidence.payload.kind === 'recursive'}>
                        <p>{evidence.payload.kind === 'recursive'
                          ? evidence.payload.excerpt
                          : ''}</p>
                        <code>{evidence.payload.kind === 'recursive'
                          ? evidence.payload.reference.artifact.digest
                          : ''}</code>
                      </Show>
                      <small>
                        Evidence {index() + 1} · {evidence.semantics.version ?? 'fixed snapshot'}
                      </small>
                    </article>
                  )}
                </For>
              </div>
          </Show>
          <Show when={props.citationHref?.(visibleClaim())}>
            {(href) => (
              <a class="evidence-open-source" href={href()}>
                Open source citation
              </a>
            )}
          </Show>
      </aside>
    )}
  </Show>
)
