/* eslint-disable no-unused-vars -- Babel's parser does not mark Solid JSX component imports as used. */
import { useParams } from '@solidjs/router'
import { type Component } from 'solid-js'
import {
  ProjectId,
  ResearchRunId,
  ResearchThreadId,
} from '@struct/domain'
import { ResearchStream } from '../components/ResearchStream'

export const ResearchPage: Component = () => {
  const params = useParams()
  return (
    <section
      aria-labelledby="document-research-title"
      class="mx-auto max-w-[90rem] space-y-6"
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
      />
    </section>
  )
}
