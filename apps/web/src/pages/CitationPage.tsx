/* eslint-disable no-unused-vars -- Babel's parser does not mark Solid JSX component imports as used. */
import { useParams } from '@solidjs/router'
import { type Component } from 'solid-js'
import {
  CitationId,
  ProjectId,
  ResearchThreadId,
} from '@struct/domain'
import { CitationViewer } from '../components/CitationViewer'

export const CitationPage: Component = () => {
  const params = useParams()
  return (
    <CitationViewer
      projectId={ProjectId.make(params.projectId ?? '')}
      threadId={ResearchThreadId.make(params.threadId ?? '')}
      citationId={CitationId.make(params.citationId ?? '')}
    />
  )
}
