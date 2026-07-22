import { Schema } from 'effect'
import {
  CreateProjectRequest,
  ProjectId,
  ProjectListPage,
  ProjectSummary,
} from '@struct/domain'
import { apiPath, basePathFromPublicBaseUrl } from '../base-path'

const appBasePath = basePathFromPublicBaseUrl(import.meta.env.BASE_URL)

export class ProjectNameConflictError extends Error {
  constructor() {
    super('A project with this name already exists.')
  }
}

async function decodeJson<A, I>(
  response: Response,
  schema: Schema.Schema<A, I, never>,
): Promise<A> {
  return Schema.decodeUnknownPromise(schema)(await response.json())
}

export async function fetchProjects(): Promise<typeof ProjectListPage.Type> {
  const response = await fetch(
    apiPath('/projects', appBasePath),
    { signal: AbortSignal.timeout(10_000) },
  )
  if (!response.ok) {
    throw new Error('Projects could not be loaded. Try again.')
  }
  return decodeJson(response, ProjectListPage)
}

export async function fetchProject(
  projectId: typeof ProjectId.Type,
): Promise<typeof ProjectSummary.Type | null> {
  const response = await fetch(
    apiPath(`/projects/${projectId}`, appBasePath),
    { signal: AbortSignal.timeout(10_000) },
  )
  if (response.status === 404) return null
  if (!response.ok) {
    throw new Error('The project could not be loaded. Try again.')
  }
  return decodeJson(response, ProjectSummary)
}

export async function createProject(
  name: string,
  idempotencyKey: string,
): Promise<typeof ProjectSummary.Type> {
  const request = await Schema.encodePromise(CreateProjectRequest)({ name })
  const response = await fetch(apiPath('/projects', appBasePath), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Idempotency-Key': idempotencyKey,
    },
    body: JSON.stringify(request),
    signal: AbortSignal.timeout(10_000),
  })
  if (response.status === 409) {
    throw new ProjectNameConflictError()
  }
  if (!response.ok) {
    throw new Error('The project could not be created. Try again.')
  }
  return decodeJson(response, ProjectSummary)
}

export function makeProjectId(value: string): typeof ProjectId.Type {
  return ProjectId.make(value)
}
