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
      <div class="repair-backdrop modal modal-open" onClick={close}>
        <section
          ref={dialog}
          class="repair-dialog modal-box max-w-2xl border border-base-300 p-0"
          role="dialog"
          aria-modal="true"
          aria-labelledby="repair-title"
          onClick={(event) => event.stopPropagation()}
          onKeyDown={trapFocus}
        >
          <header class="flex items-start justify-between gap-4 border-b border-base-300 p-5">
            <div>
              <p class="text-sm font-semibold text-primary">Explicit repair</p>
              <h2 id="repair-title" class="mt-1 text-2xl font-semibold">Resolve this claim</h2>
            </div>
            <button autofocus class="btn btn-circle btn-ghost btn-sm" type="button" onClick={close} aria-label="Close repair dialog">
              ×
            </button>
          </header>
          <p class="px-5 pt-5 text-sm text-base-content/65">
            Repairs create a new report revision. Prior text, claims, and citations
            remain immutable and available in history.
          </p>
          <div class="repair-actions grid gap-3 p-5 sm:grid-cols-2">
            <button
              type="button"
              class="btn h-auto min-h-20 flex-col items-start border-base-300 bg-base-100 p-4 text-left"
              disabled={props.disabled}
              onClick={() => choose({ kind: 'remove-claim' })}
            >
              <strong>Remove claim</strong>
              <span class="text-xs font-normal text-base-content/55">Leave its prior revision intact.</span>
            </button>
            <button
              type="button"
              class="btn h-auto min-h-20 flex-col items-start border-base-300 bg-base-100 p-4 text-left"
              disabled={props.disabled}
              onClick={() => choose({ kind: 'regenerate-section' })}
            >
              <strong>Regenerate this section</strong>
              <span class="text-xs font-normal text-base-content/55">Rebuild only from its immutable claims.</span>
            </button>
          </div>
          <div class="replacement-list border-t border-base-300 p-5">
            <h3 class="text-sm font-semibold">Newly validated evidence</h3>
            <Show
              when={replacements().length > 0}
              fallback={<p class="mt-2 text-sm text-base-content/55">No newly validated replacement is available.</p>}
            >
              <div class="mt-3 space-y-2">
              <For each={replacements()}>
                {(replacement) => (
                  <button
                    type="button"
                    class="btn h-auto w-full justify-start whitespace-normal border-base-300 bg-base-100 p-3 text-left"
                    disabled={props.disabled}
                    onClick={() => choose({
                      kind: 'replace-claim',
                      ...replacement,
                    })}
                  >
                    <span class="flex-1">{replacement.claim.revisions[replacement.claim.currentRevision]?.content}</span>
                    <small class="badge badge-success badge-sm">Validated · {replacement.claim.support.kind === 'supported'
                      ? replacement.claim.support.mode
                      : ''}</small>
                  </button>
                )}
              </For>
              </div>
            </Show>
          </div>
        </section>
      </div>
    </Show>
  )
}
