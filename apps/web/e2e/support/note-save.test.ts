import { expect, it } from 'bun:test'
import {
  isExpectedRequestAbort,
  isProjectNotesCollectionRequest,
  waitForNoteSaveAndRefresh,
  type ResponseLike,
  type ResponseWaitPage,
} from './note-save'

function createFakeResponse(method: string, url: string, ok = true): ResponseLike {
  return {
    ok: () => ok,
    url: () => url,
    request: () => ({ method: () => method }),
  }
}

function createFakePage(): ResponseWaitPage<ResponseLike> & { emit: (response: ResponseLike) => void } {
  const listeners: Array<{
    predicate: (response: ResponseLike) => boolean
    resolve: (response: ResponseLike) => void
  }> = []

  return {
    waitForResponse(predicate) {
      return new Promise<ResponseLike>((resolve) => {
        listeners.push({ predicate, resolve })
      })
    },
    emit(response) {
      const pending = [...listeners]
      listeners.length = 0
      for (const listener of pending) {
        if (listener.predicate(response)) {
          listener.resolve(response)
        } else {
          listeners.push(listener)
        }
      }
    },
  }
}

it('accepts only intentional request aborts', () => {
  const projectId = '11111111-1111-1111-1111-111111111111'
  const noteId = '22222222-2222-2222-2222-222222222222'

  expect(isExpectedRequestAbort(
    'net::ERR_ABORTED',
    'GET',
    `http://127.0.0.1:4187/struct/api/projects/${projectId}/source-activity?cursor=1`,
  )).toBe(true)
  expect(isExpectedRequestAbort(
    'net::ERR_ABORTED',
    'GET',
    `http://127.0.0.1:4187/struct/api/projects/${projectId}/runs/${noteId}/events`,
  )).toBe(true)
  expect(isExpectedRequestAbort(
    'net::ERR_ABORTED',
    'PATCH',
    `http://127.0.0.1:4187/struct/api/projects/${projectId}/notes/${noteId}`,
  )).toBe(false)
  expect(isExpectedRequestAbort(
    'net::ERR_ABORTED',
    'GET',
    'http://127.0.0.1:4187/struct/api/events',
  )).toBe(false)
  expect(isExpectedRequestAbort(
    'net::ERR_ABORTED',
    'GET',
    `http://127.0.0.1:4187/struct/api/projects/${projectId}/notes/events`,
  )).toBe(false)
})

it('identifies project note collection refreshes across deployments', () => {
  const projectId = '11111111-1111-1111-1111-111111111111'
  const noteId = '22222222-2222-2222-2222-222222222222'

  expect(isProjectNotesCollectionRequest(
    'GET',
    `http://127.0.0.1:4183/api/projects/${projectId}/notes`,
    projectId,
  )).toBe(true)
  expect(isProjectNotesCollectionRequest(
    'GET',
    `http://127.0.0.1:4187/struct/api/projects/${projectId}/notes`,
    projectId,
  )).toBe(true)
  expect(isProjectNotesCollectionRequest(
    'GET',
    `http://127.0.0.1:4187/struct/api/projects/${projectId}/notes/${noteId}`,
    projectId,
  )).toBe(false)
})

it('waits for the notes refresh that follows a successful note save', async () => {
  const projectId = '11111111-1111-1111-1111-111111111111'
  const noteId = '22222222-2222-2222-2222-222222222222'
  const page = createFakePage()
  const { noteUpdate, notesRefresh } = waitForNoteSaveAndRefresh(page, projectId, noteId)
  let refreshResolved = false
  void notesRefresh.then(() => {
    refreshResolved = true
  })

  page.emit(createFakeResponse('GET', `http://127.0.0.1:4187/struct/api/projects/${projectId}/notes`))
  await Bun.sleep(0)
  expect(refreshResolved).toBe(false)

  const notePatch = createFakeResponse('PATCH', `http://127.0.0.1:4187/struct/api/projects/${projectId}/notes/${noteId}`)
  page.emit(notePatch)
  expect(await noteUpdate).toBe(notePatch)

  const refreshedNotes = createFakeResponse('GET', `http://127.0.0.1:4187/struct/api/projects/${projectId}/notes`)
  page.emit(refreshedNotes)
  expect(await notesRefresh).toBe(refreshedNotes)
})
