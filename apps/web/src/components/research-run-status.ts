import type { ResearchEvent } from '@struct/domain'

export function terminalResearchStatus(events: readonly ResearchEvent[]): {
  readonly label: string
  readonly badgeClass: string
} | undefined {
  for (let index = events.length - 1; index >= 0; index -= 1) {
    switch (events[index]?.type) {
      case 'research-completed': return { label: 'Completed', badgeClass: 'badge-success' }
      case 'research-cancelled': return { label: 'Cancelled', badgeClass: 'badge-ghost' }
      case 'research-failed': return { label: 'Failed', badgeClass: 'badge-error' }
    }
  }
  return undefined
}
