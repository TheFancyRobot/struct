/* eslint-disable no-unused-vars -- Babel's parser does not mark Solid JSX component imports as used. */
import { useParams, useSearchParams } from '@solidjs/router'
import { createMemo, type Component } from 'solid-js'
import {
  ProjectId,
  ResearchRunId,
  ResearchThreadId,
} from '@struct/domain'
import { ResearchStream } from '../components/ResearchStream'
import {
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
      class="research-page mx-auto max-w-[96rem] space-y-6"
    >
      <header class="research-title-block">
        <p class="eyebrow">Research workbench</p>
        <h1 id="document-research-title">Grounded analysis</h1>
        <p>Follow committed progress from corpus partition to exact evidence.</p>
      </header>
      <ResearchStream
        projectId={ProjectId.make(params.projectId ?? '')}
        threadId={ResearchThreadId.make(params.threadId ?? '')}
        runId={ResearchRunId.make(params.runId ?? '')}
        demoReport={demoReport()}
      />
    </section>
  )
}
