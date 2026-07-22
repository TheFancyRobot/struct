/* eslint-disable no-unused-vars -- Babel does not mark Solid JSX imports as used. */
import { useNavigate, useParams } from '@solidjs/router'
import {
  Match,
  Show,
  Switch,
  createEffect,
  createMemo,
  createResource,
  createSignal,
  onMount,
  type Component,
} from 'solid-js'
import { ProjectId, normalizeProjectName } from '@struct/domain'
import { ProjectNameConflictError, createProject, fetchProject, fetchProjects } from '../api/projects'
import { ProjectSwitcher } from '../components/ProjectSwitcher'
import {
  clearPendingProjectCreate,
  readPendingProjectCreateState,
  rememberPendingProjectCreate,
} from './project-create-state'

const LAST_PROJECT_ID_KEY = 'struct:last-project-id'

function isProjectNameCandidateValid(value: string): boolean {
  const normalized = normalizeProjectName(value)
  return normalized.length > 0
    && normalized.length <= 120
    && !Array.from(normalized).some((character) => {
      const codePoint = character.codePointAt(0)
      return codePoint !== undefined
        && (codePoint <= 31 || (codePoint >= 127 && codePoint <= 159))
    })
}

function pendingProjectCreateStorage(): Storage {
  return window.sessionStorage
}

async function createAndNavigate(
  name: string,
  navigate: ReturnType<typeof useNavigate>,
  setError: (value: string | null) => void,
  setCreating: (value: boolean) => void,
  creating: () => boolean,
) {
  const normalized = normalizeProjectName(name)
  if (!isProjectNameCandidateValid(normalized)) {
    setError('Enter a project name using 1-120 visible characters.')
    return
  }
  if (creating()) return

  const idempotencyKey = rememberPendingProjectCreate(
    pendingProjectCreateStorage(),
    normalized,
    () => `project:create:${crypto.randomUUID()}`,
  )

  setCreating(true)
  setError(null)
  try {
    const created = await createProject(normalized, idempotencyKey)
    clearPendingProjectCreate(pendingProjectCreateStorage())
    window.localStorage.setItem(LAST_PROJECT_ID_KEY, created.id)
    navigate(`/projects/${created.id}`)
  } catch (error) {
    if (error instanceof ProjectNameConflictError) {
      clearPendingProjectCreate(pendingProjectCreateStorage())
      setError(error.message)
      return
    }
    setError('The project could not be created. Try again.')
  } finally {
    setCreating(false)
  }
}

export const HomePage: Component = () => {
  const navigate = useNavigate()
  const [enteredName, setEnteredName] = createSignal('')
  const [creating, setCreating] = createSignal(false)
  const [createError, setCreateError] = createSignal<string | null>(null)
  const [checkingCache, setCheckingCache] = createSignal(true)
  const [cachedProjectId, setCachedProjectId] = createSignal<string | null>(null)
  const [cachedProjectError, setCachedProjectError] = createSignal<string | null>(null)
  const [projects, { refetch: refetchProjects }] = createResource(fetchProjects)

  const reopenCachedProject = async (candidate = cachedProjectId()) => {
    if (candidate === null) {
      setCheckingCache(false)
      return
    }

    setCheckingCache(true)
    setCachedProjectError(null)
    try {
      const reopened = await fetchProject(ProjectId.make(candidate))
      if (reopened !== null) {
        window.localStorage.setItem(LAST_PROJECT_ID_KEY, reopened.id)
        navigate(`/projects/${reopened.id}`, { replace: true })
        return
      }
      window.localStorage.removeItem(LAST_PROJECT_ID_KEY)
      setCachedProjectId(null)
    } catch {
      setCachedProjectError('Your last project is temporarily unavailable. Try again.')
    } finally {
      setCheckingCache(false)
    }
  }

  onMount(() => {
    const pendingCreate = readPendingProjectCreateState(pendingProjectCreateStorage())
    if (pendingCreate !== null) {
      setEnteredName(pendingCreate.name)
    }

    const currentCachedProjectId = window.localStorage.getItem(LAST_PROJECT_ID_KEY)
    if (currentCachedProjectId === null) {
      setCheckingCache(false)
      return
    }

    setCachedProjectId(currentCachedProjectId)
    void reopenCachedProject(currentCachedProjectId)
  })

  return (
    <section class="space-y-4">
      <Show when={!checkingCache()} fallback={<section class="rounded-box border border-base-300 bg-base-100 p-6" role="status">Opening your last project…</section>}>
        <Show when={cachedProjectError() !== null}>
          <section class="alert alert-error gap-3" role="alert">
            <span>{cachedProjectError()}</span>
            <button type="button" class="btn btn-sm" onClick={() => void reopenCachedProject()}>
              Retry opening last project
            </button>
          </section>
        </Show>
        <Show when={projects.error !== undefined}>
          <section class="alert alert-error gap-3" role="alert">
            <span>Projects could not be loaded. Try again.</span>
            <button type="button" class="btn btn-sm" onClick={() => void refetchProjects()}>
              Retry loading projects
            </button>
          </section>
        </Show>
        <ProjectSwitcher
          mode="root"
          projects={projects()?.items ?? []}
          projectsUnavailable={projects.error !== undefined}
          currentProjectId={null}
          currentProjectName={null}
          creating={creating()}
          createError={createError()}
          enteredName={enteredName()}
          onNameInput={(event) => setEnteredName(event.currentTarget.value)}
          onSubmit={(event) => {
            event.preventDefault()
            void createAndNavigate(
              enteredName(),
              navigate,
              setCreateError,
              setCreating,
              creating,
            )
          }}
        />
      </Show>
    </section>
  )
}

export const ProjectPage: Component = () => {
  const params = useParams()
  const navigate = useNavigate()
  const [enteredName, setEnteredName] = createSignal('')
  const [creating, setCreating] = createSignal(false)
  const [createError, setCreateError] = createSignal<string | null>(null)
  const projectId = createMemo(() => ProjectId.make(params.projectId ?? ''))
  const [projects, { refetch: refetchProjects }] = createResource(fetchProjects)
  const [project, { refetch: refetchProject }] = createResource(projectId, fetchProject)

  const activeProject = createMemo(() =>
    project.error === undefined
      ? project()
      : undefined)

  createEffect(() => {
    const current = params.projectId
    const loadedProjectId = activeProject()?.id
    if (current !== undefined && loadedProjectId === current) {
      window.localStorage.setItem(LAST_PROJECT_ID_KEY, loadedProjectId)
    }
  })
  const currentProjectName = createMemo(() =>
    activeProject()?.name
    ?? projects()?.items.find((item) => item.id === projectId())?.name
    ?? null)
  const notFound = createMemo(() =>
    project.state === 'ready'
      && project.error === undefined
      && activeProject() === null)
  const projectUnavailable = createMemo(() => project.error !== undefined)

  createEffect(() => {
    if (notFound()) {
      window.localStorage.removeItem(LAST_PROJECT_ID_KEY)
    }
  })

  return (
    <section class="space-y-4">
      <Switch>
        <Match when={projectUnavailable()}>
          <section class="alert alert-error gap-3" role="alert">
            <span>The project could not be loaded. Try again.</span>
            <button type="button" class="btn btn-sm" onClick={() => void refetchProject()}>
              Retry opening project
            </button>
          </section>
        </Match>
        <Match when={project.loading}>
          <section class="rounded-box border border-base-300 bg-base-100 p-6" role="status">Opening project…</section>
        </Match>
        <Match when={notFound()}>
          <p class="alert alert-error" role="alert">This project is no longer available.</p>
        </Match>
      </Switch>
      <Show when={projects.error !== undefined}>
        <section class="alert alert-error gap-3" role="alert">
          <span>Projects could not be loaded. Try again.</span>
          <button type="button" class="btn btn-sm" onClick={() => void refetchProjects()}>
            Retry loading projects
          </button>
        </section>
      </Show>
      <ProjectSwitcher
        mode="project"
        projects={projects()?.items ?? []}
        projectsUnavailable={projects.error !== undefined}
        currentProjectId={activeProject()?.id ?? projectId()}
        currentProjectName={currentProjectName()}
        creating={creating()}
        createError={createError()}
        enteredName={enteredName()}
        onNameInput={(event) => setEnteredName(event.currentTarget.value)}
        onSubmit={(event) => {
          event.preventDefault()
          void createAndNavigate(
            enteredName(),
            navigate,
            setCreateError,
            setCreating,
            creating,
          )
        }}
      />
      <Show when={activeProject() ?? undefined}>
        {(activeProject) => (
          <section class="rounded-box border border-base-300 bg-base-100 p-6">
            <h2 class="text-lg font-semibold">{activeProject().name}</h2>
            <p class="mt-2 text-sm text-base-content/70">
              Project lifecycle is now browser-backed. Later BUG-0013 units will add sources,
              conversation, evidence, and notes to this route.
            </p>
          </section>
        )}
      </Show>
    </section>
  )
}
