import { Schema } from 'effect'
import { CitationId, DatasetCitationId } from '@struct/domain'

export type EvidenceSelection =
  | { readonly kind: 'document'; readonly id: typeof CitationId.Type }
  | { readonly kind: 'dataset'; readonly id: typeof DatasetCitationId.Type }

export function evidenceSelection(
  kind: EvidenceSelection['kind'],
  id: string,
): string {
  return `${kind}:${id}`
}

export function parseEvidenceSelection(
  value: string | undefined,
): EvidenceSelection | null {
  const separator = value?.indexOf(':') ?? -1
  if (separator < 1) return null
  const kind = value?.slice(0, separator)
  const id = value?.slice(separator + 1) ?? ''
  return kind === 'document' && Schema.is(CitationId)(id)
    ? { kind, id }
    : kind === 'dataset' && Schema.is(DatasetCitationId)(id)
      ? { kind, id }
      : null
}
