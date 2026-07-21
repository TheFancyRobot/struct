/* eslint-disable no-unused-vars -- Babel's parser does not mark Solid JSX component imports as used. */
import { useParams, useSearchParams } from '@solidjs/router'
import { Show, createMemo, type Component } from 'solid-js'
import {
  ProjectId,
  ResearchRunId,
  ResearchThreadId,
  WorkspaceId,
} from '@struct/domain'
import { ResearchStream } from '../components/ResearchStream'
import {
  MixedSourceReport,
  mixedSourceDemoFixture,
  type MixedSourceReportStatus,
} from '../components/MixedSourceReport'

const demoStates = new Set<MixedSourceReportStatus>([
  'loading',
  'live',
  'reconnecting',
  'complete',
  'cancelled',
  'empty',
  'error',
])

export const ResearchPage: Component = () => {
  const params = useParams()
  const [searchParams] = useSearchParams()
  const demoReport = createMemo(() => {
    if (searchParams.demo !== 'mixed-source') return undefined
    const requested = searchParams.state
    const state = typeof requested === 'string' && demoStates.has(
      requested as MixedSourceReportStatus,
    )
      ? requested as MixedSourceReportStatus
      : 'complete'
    return mixedSourceDemoFixture(state)
  })
  return (
    <section
      aria-labelledby="document-research-title"
      class="research-page space-y-5"
    >
      <header class="research-title-block px-1 py-2 sm:py-3">
        <p class="text-sm font-semibold text-primary">Research workbench</p>
        <h1 id="document-research-title" class="mt-1 text-3xl font-semibold tracking-[-0.035em] sm:text-4xl">Grounded analysis</h1>
        <p class="mt-1 text-base text-base-content/65">Follow committed progress from corpus partition to exact evidence.</p>
      </header>
      <Show
        when={demoReport()}
        fallback={(
          <ResearchStream
            projectId={ProjectId.make(params.projectId ?? '')}
            threadId={ResearchThreadId.make(params.threadId ?? '')}
            runId={ResearchRunId.make(params.runId ?? '')}
            workspaceId={
              typeof searchParams.workspaceId === 'string'
                && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
                  .test(searchParams.workspaceId)
                ? WorkspaceId.make(searchParams.workspaceId)
                : undefined
            }
          />
        )}
      >
        {(report) => <MixedSourceReport report={report()} />}
      </Show>
    </section>
  )
}
