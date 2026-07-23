/* eslint-disable no-unused-vars -- Babel does not mark Solid JSX imports as used. */
import { useParams } from '@solidjs/router'
import { Schema } from 'effect'
import { NoteId, ProjectId } from '@struct/domain'
import type { Component } from 'solid-js'
import { NotesPanel } from '../components/NotesPanel'

export const NotesPage: Component = () => {
  const params = useParams()
  if (!Schema.is(ProjectId)(params.projectId)) {
    return <p role="alert" class="alert alert-error">This project is no longer available.</p>
  }
  const noteId = Schema.is(NoteId)(params.noteId) ? params.noteId : undefined
  return <NotesPanel projectId={params.projectId} noteId={noteId} />
}
