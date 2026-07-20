/* eslint-disable no-unused-vars -- Babel's parser does not mark Solid JSX component imports as used. */
import { useParams, useSearchParams } from '@solidjs/router'
import { type Component } from 'solid-js'
import {
  CitationId,
  ProjectId,
  ResearchThreadId,
} from '@struct/domain'
import { CitationViewer } from '../components/CitationViewer'
import { reportReturnPath } from './citation-return'

export const CitationPage: Component = () => {
  const params = useParams()
  const [search] = useSearchParams()
  const rawReturnTo = typeof search.returnTo === 'string'
    ? search.returnTo
    : undefined
  const returnTo = reportReturnPath(params.projectId ?? '', rawReturnTo)
  return (
    <CitationViewer
      projectId={ProjectId.make(params.projectId ?? '')}
      threadId={ResearchThreadId.make(params.threadId ?? '')}
      citationId={CitationId.make(params.citationId ?? '')}
      returnTo={returnTo}
    />
  )
}
