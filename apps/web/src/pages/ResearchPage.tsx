/* eslint-disable no-unused-vars -- Babel's parser does not mark Solid JSX component imports as used. */
import { useParams, useSearchParams } from '@solidjs/router'
import { Show, createMemo, type Component } from 'solid-js'
import { Schema } from 'effect'
import {
  ProjectId,
  ResearchRunId,
  ResearchThreadId,
} from '@struct/domain'
import { ConversationPanel } from '../components/ConversationPanel'
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
  const scope = createMemo(() => {
    if (
      !Schema.is(ProjectId)(params.projectId)
      || !Schema.is(ResearchThreadId)(params.threadId)
    ) return null
    return {
      projectId: params.projectId,
      threadId: params.threadId,
      runId: Schema.is(ResearchRunId)(params.runId) ? params.runId : undefined,
    }
  })
  return (
    <section class="min-w-0">
      <Show
        when={demoReport()}
        fallback={(
          <Show when={scope()} fallback={<p class="alert alert-error">This conversation is no longer available.</p>}>
            {(loaded) => (
              <ConversationPanel
                projectId={loaded().projectId}
                threadId={loaded().threadId}
                runId={loaded().runId}
              />
            )}
          </Show>
        )}
      >
        {(report) => <MixedSourceReport report={report()} />}
      </Show>
    </section>
  )
}
