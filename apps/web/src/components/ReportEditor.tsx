/* eslint-disable no-unused-vars -- Babel does not mark Solid JSX imports as used. */
import type {
  Claim,
  ExportBundleStatus,
  Finding,
  Report,
  ReportSection,
} from '@struct/domain'
import {
  For,
  Show,
  createEffect,
  createMemo,
  createSignal,
  onCleanup,
  onMount,
  type Component,
} from 'solid-js'
import type { ReportMutation } from '../api/artifacts'
import {
  CitationRepairDialog,
  type CitationRepairChoice,
} from './CitationRepairDialog'
import { ReportCitationPanel } from './ReportCitationPanel'
import { reportCitationPath } from './citation-paths'
import { apiPath, basePathFromPublicBaseUrl } from '../base-path'

const appBasePath = basePathFromPublicBaseUrl(import.meta.env.BASE_URL)

interface ReportEditorProps {
  readonly initialReport: Report
  readonly findings: ReadonlyArray<Finding>
  readonly threadId?: string
  readonly mutate: (report: Report, mutation: ReportMutation) => Promise<Report>
  readonly loadRevision: (revision: number) => Promise<Report>
  readonly exportCurrent: (report: Report) => Promise<ExportBundleStatus>
}

function sectionContent(section: ReportSection): string {
  return section.revisions[section.currentRevision]?.content ?? ''
}

function claimContent(claim: Claim): string {
  return claim.revisions[claim.currentRevision]?.content ?? ''
}

function claimBlocker(claim: Claim): string | null {
  if (claim.support.kind === 'unsupported') {
    return `Unsupported · ${claim.support.reason}`
  }
  if (claim.support.evidence.some((evidence) => evidence.stance === 'conflicts')) {
    return 'Contradictory evidence'
  }
  return claim.citation.state === 'publishable'
    ? null
    : `${claim.citation.state[0]?.toUpperCase()}${claim.citation.state.slice(1)} citation`
}

export const ReportEditor: Component<ReportEditorProps> = (props) => {
  const [report, setReport] = createSignal(props.initialReport)
  const [historyView, setHistoryView] = createSignal<Report | null>(null)
  const [selectedSection, setSelectedSection] = createSignal(
    props.initialReport.sections[0]?.id ?? '',
  )
  const [draft, setDraft] = createSignal(
    props.initialReport.sections[0] === undefined
      ? ''
      : sectionContent(props.initialReport.sections[0]),
  )
  const [evidenceClaim, setEvidenceClaim] = createSignal<Claim | null>(null)
  const [repairClaim, setRepairClaim] = createSignal<Claim | null>(null)
  const [busy, setBusy] = createSignal('')
  const [message, setMessage] = createSignal('')
  const [error, setError] = createSignal('')
  const [offline, setOffline] = createSignal(false)
  let operation = 0
  let statusMessage: HTMLDivElement | undefined

  const visibleReport = () => historyView() ?? report()
  const activeSection = createMemo(() => report().sections.find(
    (section) => section.id === selectedSection(),
  ) ?? report().sections[0])
  const repairSection = createMemo(() => {
    const claim = repairClaim()
    return claim === null
      ? undefined
      : report().sections.find((section) => section.claimIds.includes(claim.id))
  })
  const sectionClaims = (section: ReportSection) =>
    visibleReport().claims.filter((claim) => section.claimIds.includes(claim.id))
  const blockers = createMemo(() => report().claims.flatMap((claim) => {
    const reason = claimBlocker(claim)
    return reason === null ? [] : [{ claim, reason }]
  }))
  const visibleBlockers = createMemo(() => visibleReport().claims.flatMap((claim) => {
    const reason = claimBlocker(claim)
    return reason === null ? [] : [{ claim, reason }]
  }))

  createEffect(() => {
    const section = activeSection()
    if (section !== undefined) setDraft(sectionContent(section))
  })
  createEffect(() => {
    if (message() !== '') queueMicrotask(() => statusMessage?.focus())
  })
  onMount(() => {
    const sync = () => setOffline(!navigator.onLine)
    sync()
    window.addEventListener('online', sync)
    window.addEventListener('offline', sync)
    onCleanup(() => {
      window.removeEventListener('online', sync)
      window.removeEventListener('offline', sync)
    })
  })

  const runMutation = async (
    label: string,
    mutation: ReportMutation,
  ): Promise<Report | null> => {
    if (busy() !== '' || offline()) return null
    const ticket = ++operation
    setBusy(label)
    setError('')
    setMessage('')
    try {
      const next = await props.mutate(report(), mutation)
      if (ticket !== operation) return null
      setReport(next)
      setHistoryView(null)
      setMessage(`Saved revision ${next.revision}`)
      return next
    } catch (cause) {
      if (ticket !== operation) return null
      setError(cause instanceof Error ? cause.message : 'Report operation failed.')
      return null
    } finally {
      if (ticket === operation) setBusy('')
    }
  }

  const reorder = (section: ReportSection, direction: -1 | 1) => {
    const sections = report().sections
    const index = sections.findIndex((item) => item.id === section.id)
    const target = index + direction
    if (target < 0 || target >= sections.length) return
    const ordered = [...sections]
    const other = ordered[target]
    if (other === undefined) return
    ordered[index] = other
    ordered[target] = section
    void runMutation('Reordering…', {
      kind: 'reorder',
      orderedSectionIds: ordered.map((item) => item.id),
    })
  }
  const chooseRepair = (choice: CitationRepairChoice) => {
    const claim = repairClaim()
    const section = report().sections.find((item) =>
      claim !== null && item.claimIds.includes(claim.id))
    setRepairClaim(null)
    if (claim === null || section === undefined) return
    if (choice.kind === 'remove-claim') {
      void runMutation('Removing claim…', {
        kind: 'remove-claim',
        claimId: claim.id,
      })
    } else if (choice.kind === 'replace-claim') {
      void runMutation('Replacing claim…', {
        kind: 'replace-claim',
        claimId: claim.id,
        replacementFindingId: choice.finding.id,
        replacementClaimId: choice.claim.id,
      })
    } else {
      void runMutation('Regenerating section…', {
        kind: 'regenerate',
        sectionId: section.id,
      })
    }
  }
  const publish = async () => {
    const prepared = report().publicationState === 'publishable'
      ? report()
      : await runMutation('Checking publication…', {
        kind: 'prepare-publication',
      })
    if (prepared !== null && prepared.publicationState === 'publishable') {
      await runMutation('Publishing…', { kind: 'publish' })
    }
  }
  const exportBundle = async () => {
    if (busy() !== '' || offline()) return
    const prepared = report().publicationState === 'draft'
      ? await runMutation('Preparing export…', {
        kind: 'prepare-publication',
      })
      : report()
    if (
      prepared === null
      || !['publishable', 'published'].includes(prepared.publicationState)
    ) return
    const ticket = ++operation
    setBusy('Exporting…')
    setError('')
    try {
      const exported = await props.exportCurrent(prepared)
      if (ticket === operation) {
        const query = new URLSearchParams({
          workspaceId: report().workspaceId,
          reportRevision: String(prepared.revision),
          download: '1',
        })
        const anchor = document.createElement('a')
        anchor.href = apiPath(`/projects/${report().projectId}/reports/${report().id}`, appBasePath)
          + `/exports/${encodeURIComponent(exported.digest)}?${query}`
        anchor.download = `report-${report().id}.struct-export.json`
        anchor.click()
        setMessage(`Export ready · ${exported.byteLength.toLocaleString()} bytes · ${exported.digest.slice(0, 18)}…`)
      }
    } catch (cause) {
      if (ticket === operation) {
        setError(cause instanceof Error ? cause.message : 'Report export failed.')
      }
    } finally {
      if (ticket === operation) setBusy('')
    }
  }
  const openRevision = async (revision: number) => {
    if (busy() !== '') return
    if (revision === report().revision) {
      setHistoryView(null)
      return
    }
    const ticket = ++operation
    setBusy('Loading revision…')
    setError('')
    try {
      const loaded = await props.loadRevision(revision)
      if (ticket === operation) setHistoryView(loaded)
    } catch (cause) {
      if (ticket === operation) {
        setError(cause instanceof Error ? cause.message : 'Revision unavailable.')
      }
    } finally {
      if (ticket === operation) setBusy('')
    }
  }

  return (
    <section class="report-workspace overflow-hidden rounded-box border border-base-300 bg-base-100" aria-labelledby="report-workspace-title">
      <header class="report-workspace-header flex flex-col gap-4 border-b border-base-300 p-4 sm:flex-row sm:items-start sm:justify-between sm:p-5">
        <div>
          <p class="text-sm font-semibold text-primary">Report workspace</p>
          <h1 id="report-workspace-title" class="mt-1 text-2xl font-semibold tracking-[-0.025em] sm:text-3xl">
            {visibleReport().titleRevisions[visibleReport().currentTitleRevision]?.content}
          </h1>
          <p class="mt-1 text-sm text-base-content/55">
            Revision {visibleReport().revision} · {visibleReport().publicationState}
            <Show when={historyView() !== null}> · read-only history</Show>
          </p>
        </div>
        <div class="report-primary-actions join self-stretch sm:self-auto">
          <button
            type="button"
            class="btn join-item flex-1 sm:flex-none"
            onClick={exportBundle}
            disabled={busy() !== ''
              || offline()
              || blockers().length > 0
              || historyView() !== null}
          >
            Export
          </button>
          <button
            type="button"
            class="report-publish btn btn-primary join-item flex-1 sm:flex-none"
            onClick={publish}
            disabled={busy() !== ''
              || offline()
              || blockers().length > 0
              || report().publicationState === 'published'
              || historyView() !== null}
          >
            {report().publicationState === 'published' ? 'Published' : 'Publish'}
          </button>
        </div>
      </header>

      <Show when={offline()}>
        <div class="report-banner error alert alert-error rounded-none" role="alert">
          Offline. Editing, repair, publish, and export are paused.
        </div>
      </Show>
      <Show when={busy() !== ''}>
        <div class="report-banner alert alert-info rounded-none" role="status" aria-live="polite">
          <span class="loading loading-spinner loading-sm" aria-hidden="true" />
          <span>{busy()}</span>
        </div>
      </Show>
      <Show when={message() !== ''}>
        <div
          ref={statusMessage}
          class="report-banner success alert alert-success rounded-none"
          role="status"
          tabindex="-1"
        >{message()}</div>
      </Show>
      <Show when={error() !== ''}>
        <div class="report-banner error alert alert-error rounded-none" role="alert">
          <span>{error()}</span>
          <button class="btn btn-sm" type="button" onClick={() => setError('')}>Dismiss</button>
        </div>
      </Show>

      <div class="report-workspace-layout grid lg:grid-cols-[14rem_minmax(0,1fr)] xl:grid-cols-[14rem_minmax(0,1fr)_16rem]">
        <aside class="report-outline min-w-0 border-b border-base-300 p-4 lg:border-b-0 lg:border-r" aria-labelledby="report-outline-title">
          <header class="flex items-center justify-between gap-3">
            <h2 id="report-outline-title" class="font-semibold">Outline</h2>
            <span class="badge badge-ghost badge-sm">{visibleReport().sections.length} sections</span>
          </header>
          <ol class="menu menu-horizontal mt-3 w-full flex-nowrap gap-2 overflow-x-auto p-0 lg:menu-vertical lg:overflow-visible">
            <For each={visibleReport().sections}>
              {(section) => (
                <li
                  class="min-w-44 lg:min-w-0"
                  classList={{ active: selectedSection() === section.id }}
                >
                  <button
                    type="button"
                    classList={{ 'menu-active': selectedSection() === section.id }}
                    onClick={() => {
                      setSelectedSection(section.id)
                      setDraft(sectionContent(section))
                    }}
                  >
                    <span class="text-xs opacity-50">{String(section.ordinal + 1).padStart(2, '0')}</span>
                    <strong>{section.heading}</strong>
                  </button>
                  <Show when={historyView() === null}>
                    <div class="outline-reorder join mt-1 px-1" aria-label={`Reorder ${section.heading}`}>
                      <button
                        type="button"
                        class="btn btn-square btn-ghost btn-xs join-item"
                        aria-label={`Move ${section.heading} up`}
                        disabled={busy() !== '' || offline() || section.ordinal === 0}
                        onClick={() => reorder(section, -1)}
                      >↑</button>
                      <button
                        type="button"
                        class="btn btn-square btn-ghost btn-xs join-item"
                        aria-label={`Move ${section.heading} down`}
                        disabled={busy() !== ''
                          || offline()
                          || section.ordinal === report().sections.length - 1}
                        onClick={() => reorder(section, 1)}
                      >↓</button>
                    </div>
                  </Show>
                </li>
              )}
            </For>
          </ol>
          <div class="revision-history mt-5 border-t border-base-300 pt-4">
            <h3 class="text-sm font-semibold">Revision history</h3>
            <div class="mt-2 flex gap-2 overflow-x-auto lg:flex-col">
              <For each={Array.from({ length: report().revision + 1 }, (_, revision) => revision).reverse()}>
                {(revision) => (
                  <button
                    type="button"
                    class="btn h-auto min-w-36 flex-col items-start gap-0 border-base-300 bg-base-100 p-2 text-left lg:w-full"
                    classList={{ 'btn-active': visibleReport().revision === revision }}
                    aria-current={visibleReport().revision === revision ? 'true' : undefined}
                    disabled={busy() !== ''}
                    onClick={() => void openRevision(revision)}
                  >
                    <span>Revision {revision}</span>
                    <small class="text-xs font-normal opacity-55">{revision === report().revision ? 'Current' : 'Immutable snapshot'}</small>
                  </button>
                )}
              </For>
            </div>
          </div>
        </aside>

        <section class="report-editor-canvas min-w-0 space-y-4 bg-base-200 p-3 sm:p-5" aria-label="Report sections">
          <Show when={historyView() !== null}>
            <button class="return-current btn btn-ghost btn-sm" type="button" onClick={() => setHistoryView(null)}>
              ← Return to current report
            </button>
          </Show>
          <For each={visibleReport().sections}>
            {(section) => (
              <article
                class="editable-report-section card border bg-base-100"
                classList={{
                  'border-primary ring-1 ring-primary/20': selectedSection() === section.id,
                  'border-base-300': selectedSection() !== section.id,
                }}
                onClick={() => setSelectedSection(section.id)}
              >
                <div class="card-body gap-4 p-4 sm:p-5">
                <header class="flex items-start gap-3">
                  <span class="badge badge-ghost badge-sm mt-1">{String(section.ordinal + 1).padStart(2, '0')}</span>
                  <div>
                    <h2 class="text-xl font-semibold">{section.heading}</h2>
                    <small class="text-xs text-base-content/50">
                      {section.revisions[section.currentRevision]?.authorship.kind}
                      {' '}revision {section.currentRevision}
                    </small>
                  </div>
                </header>
                <Show
                  when={historyView() === null && selectedSection() === section.id}
                  fallback={<p class="synthesis-copy whitespace-pre-wrap text-lg leading-relaxed text-base-content/80">{sectionContent(section)}</p>}
                >
                  <label class="form-control">
                    <span class="sr-only">Edit {section.heading}</span>
                    <textarea
                      class="textarea textarea-bordered min-h-36 w-full bg-base-100 text-base leading-relaxed"
                      value={draft()}
                      onInput={(event) => setDraft(event.currentTarget.value)}
                    />
                  </label>
                  <div class="section-edit-actions mt-3 flex justify-end">
                    <button
                      type="button"
                      class="btn btn-primary btn-sm"
                      disabled={busy() !== ''
                        || offline()
                        || draft().trim() === ''
                        || draft() === sectionContent(section)}
                      onClick={() => void runMutation('Saving…', {
                        kind: 'edit',
                        sectionId: section.id,
                        content: draft(),
                        actorId: report().workspaceId,
                      })}
                    >
                      Save user revision
                    </button>
                  </div>
                </Show>
                <div class="report-claims space-y-2 border-t border-base-300 pt-4">
                  <For each={sectionClaims(section)}>
                    {(claim) => {
                      const blocker = claimBlocker(claim)
                      return (
                        <div class="report-claim flex flex-col items-start gap-2 rounded-field bg-base-200 p-3" data-claim-state={claim.citation.state}>
                          <p class="min-w-0 flex-1 text-sm">{claimContent(claim)}</p>
                          <div class="flex w-full flex-wrap gap-2">
                            <button class="btn btn-outline btn-sm" type="button" onClick={() => setEvidenceClaim(claim)}>
                              {claim.support.kind === 'supported'
                                ? claim.support.mode
                                : 'No evidence'}
                              {' · '}{claim.citation.state}
                            </button>
                            <Show when={blocker !== null && historyView() === null}>
                              <button
                                class="repair-trigger btn btn-warning btn-sm"
                                type="button"
                                disabled={busy() !== '' || offline()}
                                onClick={() => setRepairClaim(claim)}
                              >
                                Repair
                              </button>
                            </Show>
                          </div>
                        </div>
                      )
                    }}
                  </For>
                </div>
                </div>
              </article>
            )}
          </For>
        </section>

        <aside class="report-inspector min-w-0 border-t border-base-300 p-4 lg:col-span-2 xl:col-span-1 xl:border-l xl:border-t-0" aria-labelledby="report-inspector-title">
          <header class="flex items-center justify-between gap-3">
            <h2 id="report-inspector-title" class="font-semibold">Publish check</h2>
            <span class={`badge badge-sm ${visibleBlockers().length === 0 ? 'badge-success' : 'badge-warning'}`}>{visibleBlockers().length === 0
              ? 'Ready'
              : `${visibleBlockers().length} blocked`}</span>
          </header>
          <Show
            when={visibleBlockers().length > 0}
            fallback={
              <div class="publish-ready alert alert-success mt-3 items-start">
                <span aria-hidden="true">✓</span>
                <div>
                <strong>All claims are publishable</strong>
                <p class="text-sm">Immutable evidence and citation states passed the report gate.</p>
                </div>
              </div>
            }
          >
            <ul class="publish-blockers mt-3 space-y-2">
              <For each={visibleBlockers()}>
                {(blocker) => (
                  <li>
                    <button class="btn h-auto w-full flex-col items-start whitespace-normal border-warning/40 bg-warning/8 p-3 text-left" type="button" onClick={() => setEvidenceClaim(blocker.claim)}>
                      <strong class="text-warning">{blocker.reason}</strong>
                      <span class="text-sm font-normal text-base-content/65">{claimContent(blocker.claim)}</span>
                    </button>
                  </li>
                )}
              </For>
            </ul>
          </Show>
          <div class="report-metadata mt-5 border-t border-base-300 pt-4">
            <dl class="grid grid-cols-2 gap-px overflow-hidden rounded-field border border-base-300 bg-base-300">
              <div class="bg-base-100 p-3"><dt class="text-xs text-base-content/50">Sources</dt><dd class="text-lg font-semibold">{visibleReport().sourceVersionIds.length}</dd></div>
              <div class="bg-base-100 p-3"><dt class="text-xs text-base-content/50">Findings</dt><dd class="text-lg font-semibold">{visibleReport().findingIds.length}</dd></div>
              <div class="bg-base-100 p-3"><dt class="text-xs text-base-content/50">Claims</dt><dd class="text-lg font-semibold">{visibleReport().claims.length}</dd></div>
              <div class="bg-base-100 p-3"><dt class="text-xs text-base-content/50">Revision</dt><dd class="text-lg font-semibold">{visibleReport().revision}</dd></div>
            </dl>
          </div>
        </aside>
      </div>

      <ReportCitationPanel
        claim={evidenceClaim()}
        onClose={() => setEvidenceClaim(null)}
        citationHref={props.threadId === undefined
          ? undefined
          : (claim) =>
            reportCitationPath(
              report().projectId,
              props.threadId!,
              claim.citation.citationId,
              window.location.pathname + window.location.search,
            )}
      />
      <CitationRepairDialog
        open={repairClaim() !== null}
        disabled={busy() !== '' || offline()}
        claim={repairClaim()}
        findings={props.findings}
        allowedFindingIds={new Set(repairSection()?.findingIds ?? [])}
        excludedClaimIds={new Set(report().claims.map((claim) => claim.id))}
        onChoose={chooseRepair}
        onClose={() => setRepairClaim(null)}
      />
    </section>
  )
}
