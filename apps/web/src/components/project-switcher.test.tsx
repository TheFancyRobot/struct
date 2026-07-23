/** @jsxImportSource solid-js */
import { describe, expect, it } from 'bun:test'
import { renderToString } from 'solid-js/web'
import { ProjectId } from '@struct/domain'
import { ProjectSwitcher } from './ProjectSwitcher'

const alphaId = ProjectId.make('5a0e8400-e29b-41d4-a716-446655440010')
const betaId = ProjectId.make('5a0e8400-e29b-41d4-a716-446655440011')

const projects = [
  { id: alphaId, name: 'Alpha', createdAt: 1n, updatedAt: 2n },
  { id: betaId, name: 'Beta', createdAt: 3n, updatedAt: 4n },
] as const

describe('project switcher', () => {
  it('renders a distinct loading state before the first project list settles', () => {
    const html = renderToString(() => ProjectSwitcher({
      mode: 'root',
      projects: [],
      currentProjectId: null,
      creating: false,
      createError: null,
      enteredName: '',
      projectListState: 'loading',
    } as never))

    expect(html).toContain('Loading projects')
    expect(html).toContain('role="status"')
    expect(html).not.toContain('Create your first project')
  })

  it('renders the first-project empty state with one labelled create affordance', () => {
    const html = renderToString(() => (
      <ProjectSwitcher
        mode="root"
        projects={[]}
        projectListState="ready"
        currentProjectId={null}
        creating={false}
        createError={null}
        enteredName=""
      />
    ))

    expect(html).toContain('Create your first project')
    expect(html).toContain('aria-label="Project name"')
    expect(html).toContain('Create project')
  })

  it('renders project selection, current-state highlighting, and duplicate feedback', () => {
    const html = renderToString(() => (
      <ProjectSwitcher
        mode="project"
        projects={projects}
        projectListState="ready"
        currentProjectId={betaId}
        creating={false}
        createError="A project with this name already exists."
        enteredName="Beta"
      />
    ))

    expect(html).toContain('Alpha')
    expect(html).toContain('Beta')
    expect(html).toContain('aria-current="page"')
    expect(html).toContain('A project with this name already exists.')
  })

  it('does not pretend an unavailable list is an empty first-project state', () => {
    const html = renderToString(() => (
      <ProjectSwitcher
        mode="root"
        projects={[]}
        projectListState="unavailable"
        currentProjectId={null}
        creating={false}
        createError={null}
        enteredName=""
      />
    ))

    expect(html).toContain('Project list unavailable.')
    expect(html).not.toContain('Create your first project')
  })
})
