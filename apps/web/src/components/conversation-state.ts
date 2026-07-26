/* eslint-disable no-unused-vars -- Babel does not mark type-only imports as used. */
import type * as typeDomain from '@struct/domain'

const MAX_VISIBLE_RESEARCH_EVENTS = 500

export function reconcileSourceSelection(
  current: ReadonlyArray<typeDomain.SourceVersionId>,
  ready: ReadonlyArray<typeDomain.SourceVersionId>,
  touched: boolean,
): {
  readonly selected: ReadonlyArray<typeDomain.SourceVersionId>
  readonly removed: ReadonlyArray<typeDomain.SourceVersionId>
} {
  if (!touched) return { selected: ready, removed: [] }
  return {
    selected: current.filter((id) => ready.includes(id)),
    removed: current.filter((id) => !ready.includes(id)),
  }
}

export function appendResearchEvent(
  events: ReadonlyArray<typeDomain.ResearchEvent>,
  event: typeDomain.ResearchEvent,
): ReadonlyArray<typeDomain.ResearchEvent> {
  if (events.some((existing) => existing.cursor === event.cursor)) return events
  return [...events, event].slice(-MAX_VISIBLE_RESEARCH_EVENTS)
}
