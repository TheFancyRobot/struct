/* eslint-disable no-unused-vars -- Babel's parser does not mark Solid JSX component imports as used. */
import { A, useSearchParams } from '@solidjs/router'
import {
  ErrorBoundary,
  For,
  Show,
  createEffect,
  createMemo,
  createResource,
  createSignal,
  type Component,
} from 'solid-js'
import { createStore } from 'solid-js/store'
import { Schema } from 'effect'
import type {
  ProjectId,
  ResearchRunId,
  ResearchThreadId,
  RecursiveRunProgress,
  WorkspaceId,
} from '@struct/domain'
import { ResearchEvent } from '@struct/domain'
import { useSSE } from '../hooks/useSSE'
import { apiPath, basePathFromPublicBaseUrl } from '../base-path'

const appBasePath = basePathFromPublicBaseUrl(import.meta.env.BASE_URL)
import {
  cancelResearchRun,
  fetchRecursiveAnalysis,
} from '../api/research'
import { saveCompletedResearchFinding } from '../api/artifacts'
import { RecursiveRunTimeline } from './RecursiveRunTimeline'
import { PartialFindingsPanel } from './PartialFindingsPanel'
import { evidenceSelection } from './evidence-selection'
import { mergeRecursiveRead } from './recursive-progress-state'
import { useWorkspaceState } from './workspace/workspace-state'
interface ResearchStreamProps {
  readonly projectId: ProjectId
  readonly threadId: ResearchThreadId
  readonly runId: ResearchRunId
  readonly workspaceId?: WorkspaceId
}

const eventLabel = (event: ResearchEvent): string => {
  switch (event.type) {
    case 'research-started': return 'Research started'
    case 'research-plan-accepted': return 'Research plan accepted'
    case 'research-planning-failed':
      return `Research planning failed (${event.data.reason})`
    case 'research-checkpointed': return 'Progress checkpoint saved'
    case 'retrieval-completed': return event.data.evidenceCount === 0
      ? 'No evidence matched the selected documents'
      : `Retrieved ${event.data.evidenceCount} evidence items`
    case 'citations-validated': return `Validated ${event.data.citationCount} citations`
    case 'research-cancelled': return 'Research cancelled'
    case 'research-completed': return 'Research completed'
    case 'research-failed': return event.data.message
    case 'recursive-run-progress-committed':
      return `Recursive analysis ${event.data.status}`
    case 'recursive-partition-progress-committed':
      return `Partition ${event.data.partition.ordinal + 1} ${event.data.partition.status}`
    case 'recursive-result-progress-committed':
      return `${event.data.result.status === 'partial' ? 'Partial' : 'Complete'} findings committed`
  }
}

const failureGuidance = (errorTag: string): string => {
  switch (errorTag) {
    case 'EvidenceInsufficientError':
      return 'The selected documents did not contain enough support for an answer. Add relevant sources or narrow the question.'
    case 'EvidenceContradictionError':
      return 'The selected documents conflict on this question. Review the evidence before drawing a conclusion.'
    case 'ResearchCitationValidationError':
      return 'The answer was withheld because its supporting citation could not be verified.'
    case 'RetrievalQueryError':
      return 'The selected document evidence could not be retrieved. Retry the run.'
    case 'UnsupportedSourceTypeError':
      return 'A selected source has a format that document research does not support.'
    default:
      return 'Research could not be completed. Retry the run or review the source selection.'
  }
}

export const ResearchStream: Component<ResearchStreamProps> = (props) => {
  const workspace = useWorkspaceState()
  const [, setSearchParams] = useSearchParams()
  const [state, setState] = createStore<{ events: ResearchEvent[] }>({ events: [] })
  const [recursiveRead, { refetch: refetchRecursive }] = createResource(
    () => [props.projectId, props.runId] as const,
    ([projectId, runId]) => fetchRecursiveAnalysis(projectId, runId),
  )
  const [recursive, setRecursive] = createSignal<RecursiveRunProgress | null>(null)
  const [cancelling, setCancelling] = createSignal(false)
  const [cancelError, setCancelError] = createSignal<string>()
  const [savingFinding, setSavingFinding] = createSignal(false)
  const [savedFindingId, setSavedFindingId] = createSignal<string>()
  const [findingSaveError, setFindingSaveError] = createSignal<string>()
  const legacyEvents = createMemo(() => state.events.filter(
    (event) => !event.type.startsWith('recursive-'),
  ))

  createEffect(() => {
    const loaded = recursiveRead()
    if (loaded !== undefined) {
      setRecursive((current) => mergeRecursiveRead(current, loaded))
    }
  })

  const applyRecursiveEvent = (event: ResearchEvent) => {
    if (event.type === 'recursive-run-progress-committed') {
      setRecursive((current) => {
        if (
          current !== null
          && (
            current.workspaceId !== event.data.workspaceId
            || current.requestId !== event.data.requestId
            || current.planId !== event.data.planId
          )
        ) return current
        return {
          runId: event.runId,
          ...event.data,
          partitions: current?.partitions ?? [],
          result: current?.result ?? null,
          updatedAt: event.createdAt,
        }
      })
      return
    }
    if (event.type === 'recursive-partition-progress-committed') {
      setRecursive((current) => {
        if (
          current === null
          || current.workspaceId !== event.data.workspaceId
          || current.requestId !== event.data.requestId
          || current.planId !== event.data.planId
        ) {
          return current
        }
        const previous = current.partitions.find(
          (partition) => partition.id === event.data.partition.id,
        )
        const batches = previous === undefined
          ? event.data.partition.batches
          : previous.batches
              .filter((batch) =>
                !event.data.partition.batches.some(
                  (next) => next.id === batch.id,
                ))
              .concat(event.data.partition.batches)
              .sort((left, right) => left.id.localeCompare(right.id))
        const mergedPartition = {
          ...event.data.partition,
          batches,
          startedAt: previous?.startedAt ?? event.data.partition.startedAt,
        }
        const partitions = current.partitions
          .filter((partition) => partition.id !== event.data.partition.id)
          .concat(mergedPartition)
          .sort((left, right) =>
            left.ordinal - right.ordinal || left.id.localeCompare(right.id))
        return { ...current, partitions, updatedAt: event.createdAt }
      })
      return
    }
    if (event.type === 'recursive-result-progress-committed') {
      setRecursive((current) =>
        current === null
          || current.workspaceId !== event.data.workspaceId
          || current.requestId !== event.data.requestId
          || current.planId !== event.data.planId
          ? current
          : {
              ...current,
              result: event.data.result,
              updatedAt: event.createdAt,
            })
    }
  }

  const connection = useSSE<ResearchEvent>(
    () => apiPath(`/projects/${props.projectId}/runs/${props.runId}/events`, appBasePath),
    Schema.decodeUnknownSync(ResearchEvent),
    (event) => {
      if (state.events.some((existing) => existing.cursor === event.cursor)) return
      setState('events', (events) => [...events, event])
      applyRecursiveEvent(event)
    },
    [
      'research-started',
      'research-plan-accepted',
      'research-planning-failed',
      'research-checkpointed',
      'retrieval-completed',
      'citations-validated',
      'research-cancelled',
      'research-completed',
      'research-failed',
      'recursive-run-progress-committed',
      'recursive-partition-progress-committed',
      'recursive-result-progress-committed',
    ],
  )

  const requestCancellation = async () => {
    const progress = recursive()
    if (progress === null) return
    setCancelling(true)
    setCancelError(undefined)
    try {
      await cancelResearchRun(
        props.projectId,
        props.runId,
        progress.workspaceId,
      )
      setRecursive((current) => current === null
        ? current
        : { ...current, cancellation: 'requested' })
    } catch (error) {
      setCancelError(error instanceof Error
        ? error.message
        : 'Cancellation could not be requested. Try again.')
    } finally {
      setCancelling(false)
    }
  }

  const saveFinding = async (
    event: Extract<ResearchEvent, { readonly type: 'research-completed' }>,
  ) => {
    if (props.workspaceId === undefined || savingFinding()) return
    setSavingFinding(true)
    setFindingSaveError(undefined)
    try {
      const finding = await saveCompletedResearchFinding({
        workspaceId: props.workspaceId,
        projectId: props.projectId,
        runId: props.runId,
        answer: event.data.answer,
        completedAt: event.createdAt,
        citations: event.data.citations,
      })
      setSavedFindingId(finding.id)
    } catch (error) {
      setFindingSaveError(error instanceof Error
        ? error.message
        : 'The completed result could not be saved.')
    } finally {
      setSavingFinding(false)
    }
  }

  const openEvidence = (
    kind: 'document' | 'dataset',
    id: string,
    trigger: HTMLButtonElement,
  ) => {
    workspace.setEvidenceTrigger(trigger)
    setSearchParams({ evidence: evidenceSelection(kind, id) })
  }

  return (
    <ErrorBoundary fallback={<div role="alert" class="alert alert-error">Progress could not be rendered.</div>}>
      <section aria-label="Research progress" class="space-y-5">
        <Show when={recursiveRead.error && legacyEvents().length === 0}>
          <div role="alert" class="inline-notice danger alert alert-error">
            <span>
              {recursiveRead.error instanceof Error
                ? recursiveRead.error.message
                : 'Recursive analysis could not be loaded.'}
            </span>
            <button type="button" class="btn btn-sm" onClick={() => void refetchRecursive()}>
              Try again
            </button>
          </div>
        </Show>
        <Show when={recursiveRead.loading && recursive() === null}>
          <div class="research-panel loading-panel flex flex-col gap-4 rounded-box border border-base-300 bg-base-100 p-5" role="status" aria-label="Loading recursive analysis">
            <span class="skeleton h-4 w-32" />
            <span class="skeleton h-10 w-2/3" />
            <span class="skeleton h-24 w-full" />
          </div>
        </Show>
        <Show when={recursive()}>
          {(progress) => (
            <div class="research-workbench grid gap-4 xl:grid-cols-[minmax(20rem,.8fr)_minmax(0,1.2fr)]">
              <RecursiveRunTimeline
                progress={progress()}
                connected={connection.connected()}
                reconnecting={connection.reconnecting()}
                cancelling={cancelling()}
                cancelError={cancelError()}
                onCancel={() => void requestCancellation()}
              />
              <Show when={progress().result}>
                {(result) => (
                  <PartialFindingsPanel
                    projectId={props.projectId}
                    threadId={props.threadId}
                    result={result()}
                  />
                )}
              </Show>
            </div>
          )}
        </Show>

        <Show when={recursive() === null || legacyEvents().length > 0}>
        <div class="legacy-progress card border border-base-300 bg-base-100">
        <div class="card-body gap-4 p-4 sm:p-5">
        <div class="flex items-center justify-between gap-4">
          <h2 id="research-progress-title" class="card-title text-xl">Research progress</h2>
          <span class={`badge ${connection.connected() ? 'badge-success' : connection.reconnecting() ? 'badge-warning' : 'badge-ghost'}`}>
            {connection.connected() ? 'Live' : connection.reconnecting() ? 'Reconnecting' : 'Connecting'}
          </span>
        </div>
        <Show when={connection.error()}>
          {(message) => <div role="alert" class="alert alert-error">{message()}</div>}
        </Show>
        <Show
          when={legacyEvents().length > 0}
          fallback={(
            <div class="flex items-center gap-3 py-6 text-base-content/60" role="status">
              <span class="loading loading-dots loading-md" aria-hidden="true" />
              <span>Waiting for persisted progress…</span>
            </div>
          )}
        >
          <ol aria-live="polite" class="timeline timeline-vertical timeline-compact">
            <For each={legacyEvents()}>
              {(event) => (
                <li>
                  <div class="timeline-middle size-3 rounded-full bg-primary" aria-hidden="true" />
                  <div class="timeline-end timeline-box mb-4 w-full border-base-300 bg-base-100">
                  <p class="font-medium">{eventLabel(event)}</p>
                  <Show when={event.type === 'retrieval-completed' && event.data.evidenceCount === 0}>
                    <p class="mt-2 text-sm text-base-content/70">
                      The run will stop unless the workflow can establish sufficient evidence.
                    </p>
                  </Show>
                  <Show when={event.type === 'research-failed' ? event : undefined}>
                    {(failed) => (
                      <div role="alert" class="alert alert-warning mt-3">
                        <span>{failureGuidance(failed().data.errorTag)}</span>
                      </div>
                    )}
                  </Show>
                  <Show when={event.type === 'research-completed' ? event : undefined}>
                    {(completed) => (
                      <div class="mt-3 space-y-3">
                        <p>{completed().data.answer}</p>
                        <For each={completed().data.citations}>
                          {(citation, index) => (
                            <button
                              type="button"
                              class="link link-primary"
                              onClick={(event) =>
                                openEvidence('document', citation.id, event.currentTarget)}
                              aria-label={`Open citation ${index() + 1} in source version`}
                            >
                              Open citation {index() + 1}
                            </button>
                          )}
                        </For>
                        <For each={completed().data.datasetCitations}>
                          {(citation, index) => (
                            <button
                              type="button"
                              class="link link-primary"
                              onClick={(event) =>
                                openEvidence('dataset', citation.id, event.currentTarget)}
                              aria-label={`Open dataset citation ${index() + 1}`}
                            >
                              Open dataset citation {index() + 1}
                            </button>
                          )}
                        </For>
                        <Show when={props.workspaceId}>
                          <button
                            type="button"
                            class="btn btn-primary btn-sm"
                            disabled={savingFinding() || savedFindingId() !== undefined}
                            onClick={() => void saveFinding(completed())}
                          >
                            {savedFindingId() !== undefined
                              ? 'Saved to notebook'
                              : savingFinding()
                                ? 'Saving finding…'
                                : 'Save finding'}
                          </button>
                        </Show>
                        <Show when={savedFindingId() && props.workspaceId}>
                          <A
                            class="link link-primary"
                            href={
                              `/projects/${props.projectId}/notebook`
                              + `?workspaceId=${props.workspaceId}`
                              + `&threadId=${props.threadId}`
                              + `&runId=${props.runId}`
                            }
                          >
                            Open project notebook
                          </A>
                        </Show>
                        <Show when={findingSaveError()}>
                          {(message) => <div class="alert alert-error" role="alert">{message()}</div>}
                        </Show>
                      </div>
                    )}
                  </Show>
                  </div>
                </li>
              )}
            </For>
          </ol>
        </Show>
        </div>
        </div>
        </Show>
      </section>
    </ErrorBoundary>
  )
}
