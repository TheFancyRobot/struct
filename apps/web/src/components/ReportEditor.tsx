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
        anchor.href = `/api/projects/${report().projectId}/reports/${report().id}`
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
    <section class="report-workspace" aria-labelledby="report-workspace-title">
      <header class="report-workspace-header">
        <div>
          <p class="eyebrow">Report workspace</p>
          <h1 id="report-workspace-title">
            {visibleReport().titleRevisions[visibleReport().currentTitleRevision]?.content}
          </h1>
          <p>
            Revision {visibleReport().revision} · {visibleReport().publicationState}
            <Show when={historyView() !== null}> · read-only history</Show>
          </p>
        </div>
        <div class="report-primary-actions">
          <button
            type="button"
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
            class="report-publish"
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
        <div class="report-banner error" role="alert">
          Offline. Editing, repair, publish, and export are paused.
        </div>
      </Show>
      <Show when={busy() !== ''}>
        <div class="report-banner" role="status" aria-live="polite">
          <span>{busy()}</span>
        </div>
      </Show>
      <Show when={message() !== ''}>
        <div
          ref={statusMessage}
          class="report-banner success"
          role="status"
          tabindex="-1"
        >{message()}</div>
      </Show>
      <Show when={error() !== ''}>
        <div class="report-banner error" role="alert">
          <span>{error()}</span>
          <button type="button" onClick={() => setError('')}>Dismiss</button>
        </div>
      </Show>

      <div class="report-workspace-layout">
        <aside class="report-outline" aria-labelledby="report-outline-title">
          <header>
            <h2 id="report-outline-title">Outline</h2>
            <span>{visibleReport().sections.length} sections</span>
          </header>
          <ol>
            <For each={visibleReport().sections}>
              {(section) => (
                <li classList={{ active: selectedSection() === section.id }}>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedSection(section.id)
                      setDraft(sectionContent(section))
                    }}
                  >
                    <span>{String(section.ordinal + 1).padStart(2, '0')}</span>
                    <strong>{section.heading}</strong>
                  </button>
                  <Show when={historyView() === null}>
                    <div class="outline-reorder" aria-label={`Reorder ${section.heading}`}>
                      <button
                        type="button"
                        aria-label={`Move ${section.heading} up`}
                        disabled={busy() !== '' || offline() || section.ordinal === 0}
                        onClick={() => reorder(section, -1)}
                      >↑</button>
                      <button
                        type="button"
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
          <div class="revision-history">
            <h3>Revision history</h3>
            <div>
              <For each={Array.from({ length: report().revision + 1 }, (_, revision) => revision).reverse()}>
                {(revision) => (
                  <button
                    type="button"
                    aria-current={visibleReport().revision === revision ? 'true' : undefined}
                    disabled={busy() !== ''}
                    onClick={() => void openRevision(revision)}
                  >
                    <span>Revision {revision}</span>
                    <small>{revision === report().revision ? 'Current' : 'Immutable snapshot'}</small>
                  </button>
                )}
              </For>
            </div>
          </div>
        </aside>

        <section class="report-editor-canvas" aria-label="Report sections">
          <Show when={historyView() !== null}>
            <button class="return-current" type="button" onClick={() => setHistoryView(null)}>
              ← Return to current report
            </button>
          </Show>
          <For each={visibleReport().sections}>
            {(section) => (
              <article
                class="editable-report-section"
                classList={{ selected: selectedSection() === section.id }}
                onClick={() => setSelectedSection(section.id)}
              >
                <header>
                  <span>{String(section.ordinal + 1).padStart(2, '0')}</span>
                  <div>
                    <h2>{section.heading}</h2>
                    <small>
                      {section.revisions[section.currentRevision]?.authorship.kind}
                      {' '}revision {section.currentRevision}
                    </small>
                  </div>
                </header>
                <Show
                  when={historyView() === null && selectedSection() === section.id}
                  fallback={<p>{sectionContent(section)}</p>}
                >
                  <label>
                    <span class="sr-only">Edit {section.heading}</span>
                    <textarea
                      value={draft()}
                      onInput={(event) => setDraft(event.currentTarget.value)}
                    />
                  </label>
                  <div class="section-edit-actions">
                    <button
                      type="button"
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
                <div class="report-claims">
                  <For each={sectionClaims(section)}>
                    {(claim) => {
                      const blocker = claimBlocker(claim)
                      return (
                        <div class="report-claim" data-claim-state={claim.citation.state}>
                          <p>{claimContent(claim)}</p>
                          <div>
                            <button type="button" onClick={() => setEvidenceClaim(claim)}>
                              {claim.support.kind === 'supported'
                                ? claim.support.mode
                                : 'No evidence'}
                              {' · '}{claim.citation.state}
                            </button>
                            <Show when={blocker !== null && historyView() === null}>
                              <button
                                class="repair-trigger"
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
              </article>
            )}
          </For>
        </section>

        <aside class="report-inspector" aria-labelledby="report-inspector-title">
          <header>
            <h2 id="report-inspector-title">Publish check</h2>
            <span>{visibleBlockers().length === 0
              ? 'Ready'
              : `${visibleBlockers().length} blocked`}</span>
          </header>
          <Show
            when={visibleBlockers().length > 0}
            fallback={
              <div class="publish-ready">
                <strong>All claims are publishable</strong>
                <p>Immutable evidence and citation states passed the report gate.</p>
              </div>
            }
          >
            <ul class="publish-blockers">
              <For each={visibleBlockers()}>
                {(blocker) => (
                  <li>
                    <button type="button" onClick={() => setEvidenceClaim(blocker.claim)}>
                      <strong>{blocker.reason}</strong>
                      <span>{claimContent(blocker.claim)}</span>
                    </button>
                  </li>
                )}
              </For>
            </ul>
          </Show>
          <div class="report-metadata">
            <dl>
              <div><dt>Sources</dt><dd>{visibleReport().sourceVersionIds.length}</dd></div>
              <div><dt>Findings</dt><dd>{visibleReport().findingIds.length}</dd></div>
              <div><dt>Claims</dt><dd>{visibleReport().claims.length}</dd></div>
              <div><dt>Revision</dt><dd>{visibleReport().revision}</dd></div>
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
            `/projects/${report().projectId}/research/${props.threadId}`
            + `/citation/${claim.citation.citationId}`
            + `?returnTo=${encodeURIComponent(window.location.pathname + window.location.search)}`}
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
