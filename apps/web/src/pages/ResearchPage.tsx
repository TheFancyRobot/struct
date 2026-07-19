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
      class="mx-auto max-w-4xl space-y-6"
    >
      <header>
        <p class="text-sm font-medium uppercase tracking-wide text-primary">
          Document research
        </p>
        <h1 id="document-research-title" class="text-3xl font-semibold">
          Grounded answer
        </h1>
      </header>
      <ResearchStream
        projectId={ProjectId.make(params.projectId ?? '')}
        threadId={ResearchThreadId.make(params.threadId ?? '')}
        runId={ResearchRunId.make(params.runId ?? '')}
      />
    </section>
  )
}
