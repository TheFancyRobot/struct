/* eslint-disable no-unused-vars -- Babel does not mark Solid JSX imports as used. */
import type { Claim, Finding } from '@struct/domain'
import {
  For,
  Show,
  createEffect,
  createMemo,
  onCleanup,
  type Component,
} from 'solid-js'

export type CitationRepairChoice =
  | { readonly kind: 'remove-claim' }
  | {
    readonly kind: 'replace-claim'
    readonly finding: Finding
    readonly claim: Claim
  }
  | { readonly kind: 'regenerate-section' }

interface CitationRepairDialogProps {
  readonly open: boolean
  readonly disabled: boolean
  readonly claim: Claim | null
  readonly findings: ReadonlyArray<Finding>
  readonly allowedFindingIds: ReadonlySet<string>
  readonly excludedClaimIds: ReadonlySet<string>
  readonly onChoose: (choice: CitationRepairChoice) => void
  readonly onClose: () => void
}

export const CitationRepairDialog: Component<CitationRepairDialogProps> = (props) => {
  const replacements = createMemo(() => props.findings.flatMap((finding) =>
    props.allowedFindingIds.has(finding.id) ? finding.claims
      .filter((claim) =>
        claim.id !== props.claim?.id
        && !props.excludedClaimIds.has(claim.id)
        && claim.support.kind === 'supported'
        && claim.citation.state === 'publishable')
      .map((claim) => ({ finding, claim })) : []))
  let dialog: HTMLElement | undefined
  let restoreFocus: HTMLElement | null = null
  createEffect(() => {
    if (!props.open) return
    restoreFocus = document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null
    queueMicrotask(() => dialog?.querySelector<HTMLElement>(
      'button:not([disabled]), [href], textarea, input, select, [tabindex]:not([tabindex="-1"])',
    )?.focus())
  })
  onCleanup(() => restoreFocus?.focus())
  const close = () => {
    props.onClose()
    queueMicrotask(() => restoreFocus?.focus())
  }
  const choose = (choice: CitationRepairChoice) => {
    props.onChoose(choice)
    queueMicrotask(() => restoreFocus?.focus())
  }

  const trapFocus = (event: KeyboardEvent) => {
    if (event.key === 'Escape') {
      event.preventDefault()
      close()
      return
    }
    if (event.key !== 'Tab' || dialog === undefined) return
    const focusable = [...dialog.querySelectorAll<HTMLElement>(
      'button:not([disabled]), [href], textarea, input, select, [tabindex]:not([tabindex="-1"])',
    )]
    const first = focusable[0]
    const last = focusable[focusable.length - 1]
    if (first === undefined || last === undefined) return
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault()
      last.focus()
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault()
      first.focus()
    }
  }

  return (
    <Show when={props.open}>
      <div class="repair-backdrop" onClick={close}>
        <section
          ref={dialog}
          class="repair-dialog"
          role="dialog"
          aria-modal="true"
          aria-labelledby="repair-title"
          onClick={(event) => event.stopPropagation()}
          onKeyDown={trapFocus}
        >
          <header>
            <div>
              <p class="eyebrow">Explicit repair</p>
              <h2 id="repair-title">Resolve this claim</h2>
            </div>
            <button autofocus type="button" onClick={close} aria-label="Close repair dialog">
              ×
            </button>
          </header>
          <p>
            Repairs create a new report revision. Prior text, claims, and citations
            remain immutable and available in history.
          </p>
          <div class="repair-actions">
            <button
              type="button"
              disabled={props.disabled}
              onClick={() => choose({ kind: 'remove-claim' })}
            >
              <strong>Remove claim</strong>
              <span>Leave its prior revision intact.</span>
            </button>
            <button
              type="button"
              disabled={props.disabled}
              onClick={() => choose({ kind: 'regenerate-section' })}
            >
              <strong>Regenerate this section</strong>
              <span>Rebuild only from its immutable claims.</span>
            </button>
          </div>
          <div class="replacement-list">
            <h3>Newly validated evidence</h3>
            <Show
              when={replacements().length > 0}
              fallback={<p>No newly validated replacement is available.</p>}
            >
              <For each={replacements()}>
                {(replacement) => (
                  <button
                    type="button"
                    disabled={props.disabled}
                    onClick={() => choose({
                      kind: 'replace-claim',
                      ...replacement,
                    })}
                  >
                    <span>{replacement.claim.revisions[replacement.claim.currentRevision]?.content}</span>
                    <small>Validated · {replacement.claim.support.kind === 'supported'
                      ? replacement.claim.support.mode
                      : ''}</small>
                  </button>
                )}
              </For>
            </Show>
          </div>
        </section>
      </div>
    </Show>
  )
}
