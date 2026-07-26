export interface ResponseLike {
  ok(): boolean
  url(): string
  request(): {
    method(): string
  }
}

export interface ResponseWaitPage<TResponse extends ResponseLike = ResponseLike> {
  waitForResponse(predicate: (response: TResponse) => boolean): Promise<TResponse>
}

export function isExpectedRequestAbort(
  failure: string,
  requestMethod: string,
  requestUrl: string,
): boolean {
  return failure === 'net::ERR_ABORTED'
    && requestMethod === 'GET'
    && /\/api\/projects\/[^/]+\/(?:source-activity|runs\/[^/]+\/events)$/.test(new URL(requestUrl).pathname)
}

export function isProjectNotesCollectionRequest(
  requestMethod: string,
  requestUrl: string,
  projectId: string,
): boolean {
  return requestMethod === 'GET'
    && new RegExp(`/api/projects/${projectId}/notes$`, 'i').test(new URL(requestUrl).pathname)
}

export function waitForNoteSaveAndRefresh<TResponse extends ResponseLike>(
  page: ResponseWaitPage<TResponse>,
  projectId: string,
  noteId: string,
): {
  noteUpdate: Promise<TResponse>
  notesRefresh: Promise<TResponse>
} {
  let noteUpdateCompleted = false
  const noteUpdate = page.waitForResponse((response) => {
    const matches = response.request().method() === 'PATCH'
      && new RegExp(`/api/projects/${projectId}/notes/${noteId}$`, 'i').test(new URL(response.url()).pathname)
    if (!matches || !response.ok()) return false
    noteUpdateCompleted = true
    return true
  })
  const notesRefresh = page.waitForResponse((response) =>
    noteUpdateCompleted
    && response.ok()
    && isProjectNotesCollectionRequest(response.request().method(), response.url(), projectId))

  return { noteUpdate, notesRefresh }
}
