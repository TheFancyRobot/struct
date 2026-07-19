/** @jsxImportSource solid-js */
/* eslint-disable no-unused-vars -- Babel's parser does not mark Solid JSX component imports as used. */
import { For, type Component } from 'solid-js'
import type {
  DirectoryControlCommand,
  DirectoryStatusProjection,
} from '@struct/domain'

const commands: ReadonlyArray<DirectoryControlCommand> = [
  'pause',
  'resume',
  'retry',
  'cancel',
]

export function availableDirectoryControls(
  status: DirectoryStatusProjection,
): ReadonlySet<DirectoryControlCommand> {
  switch (status.status) {
    case 'ready': return new Set(['cancel'])
    case 'running': return new Set(['pause', 'cancel'])
    case 'paused': return new Set(['resume', 'cancel'])
    case 'cancelled':
    case 'exhausted':
      return status.attempts < status.maxAttempts
        ? new Set(['retry'])
        : new Set()
    case 'completed': return new Set()
  }
}

export interface SourceControlsProps {
  readonly status: DirectoryStatusProjection
  readonly busy?: boolean
  readonly onCommand: (command: DirectoryControlCommand) => void
}

export const SourceControls: Component<SourceControlsProps> = (props) => {
  const enabled = () => availableDirectoryControls(props.status)
  return (
    <div aria-label="Directory controls" class="flex flex-wrap gap-2">
      <For each={commands}>
        {(command) => (
          <button
            type="button"
            class="btn btn-sm"
            disabled={props.busy === true || !enabled().has(command)}
            onClick={() => props.onCommand(command)}
          >
            {command[0]?.toUpperCase()}{command.slice(1)}
          </button>
        )}
      </For>
    </div>
  )
}
