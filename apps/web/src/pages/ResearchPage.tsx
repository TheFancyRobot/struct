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
    <ResearchStream
      projectId={ProjectId.make(params.projectId ?? '')}
      threadId={ResearchThreadId.make(params.threadId ?? '')}
      runId={ResearchRunId.make(params.runId ?? '')}
    />
  )
}
