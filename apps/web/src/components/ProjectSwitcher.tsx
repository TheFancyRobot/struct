/* eslint-disable no-unused-vars -- Babel does not mark Solid JSX imports as used. */
import { For, Show, type Component, type JSX } from 'solid-js'
import type { ProjectId, ProjectSummary } from '@struct/domain'
import { basePathFromPublicBaseUrl, withBasePath } from '../base-path'

export interface ProjectSwitcherProps {
  readonly mode: 'root' | 'project'
  readonly projects: ReadonlyArray<ProjectSummary>
  readonly projectsUnavailable?: boolean
  readonly currentProjectId: ProjectId | null
  readonly currentProjectName?: string | null
  readonly creating: boolean
  readonly createError: string | null
  readonly enteredName: string
  readonly onNameInput?: JSX.EventHandler<HTMLInputElement, InputEvent>
  readonly onSubmit?: JSX.EventHandler<HTMLFormElement, SubmitEvent>
}

const appBasePath = basePathFromPublicBaseUrl(import.meta.env.BASE_URL)

export const ProjectSwitcher: Component<ProjectSwitcherProps> = (props) => {
  const hasProjects = () => props.projects.length > 0

  return (
    <section class="space-y-6 rounded-box border border-base-300 bg-base-100 p-4 shadow-sm sm:p-6">
      <header class="space-y-2">
        <h1 class="text-2xl font-semibold tracking-[-0.02em]">
          {props.mode === 'root'
            ? 'Choose a project'
            : props.currentProjectName
              ?? props.projects.find((project) => project.id === props.currentProjectId)?.name
              ?? 'Project'}
        </h1>
        <p class="text-sm text-base-content/70">
          {props.projectsUnavailable
            ? 'Project list unavailable. Retry loading projects or create a new workspace foundation.'
            : hasProjects()
              ? 'Create a project or reopen an existing workspace foundation.'
              : 'Create your first project to establish the workspace foundation.'}
        </p>
      </header>

      <Show when={!props.projectsUnavailable && hasProjects()}>
        <nav aria-label="Projects" class="space-y-2">
          <For each={props.projects}>
            {(project) => (
              <a
                href={withBasePath(`/projects/${project.id}`, appBasePath)}
                class="btn btn-ghost justify-start"
                aria-current={project.id === props.currentProjectId ? 'page' : undefined}
              >
                {project.name}
              </a>
            )}
          </For>
        </nav>
      </Show>

      <form class="space-y-3" onSubmit={props.onSubmit}>
        <label class="form-control gap-2">
          <span class="label-text font-medium">Project name</span>
          <input
            aria-label="Project name"
            class="input input-bordered w-full"
            name="name"
            value={props.enteredName}
            onInput={props.onNameInput}
            maxlength={120}
            autocomplete="off"
            placeholder="Café roadmap"
          />
        </label>
        <Show when={props.createError !== null}>
          <p class="alert alert-error text-sm" role="alert">{props.createError}</p>
        </Show>
        <button type="submit" class="btn btn-primary" disabled={props.creating}>
          {props.creating ? 'Creating project…' : 'Create project'}
        </button>
      </form>
    </section>
  )
}
