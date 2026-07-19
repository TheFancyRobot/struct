import { Effect } from 'effect'
import { createHash } from 'node:crypto'
import type { ArtifactRef, ArtifactStoreShape, StagedArtifactRef } from '@struct/source-storage'
import { IngestionFailureError } from '@struct/domain'
import { classifyTextSource } from './file-classifier.js'
import { parseHtml, parseMarkdown, parsePdf, parseText, type DocumentLocator } from '@struct/document-processing'

export { IngestionFailureError }

export interface NormalizedText {
  readonly bytes: Uint8Array
  readonly contentHash: `sha256:${string}`
}

export interface IngestTextSourceInput {
  readonly store: ArtifactStoreShape
  readonly stagedRef: StagedArtifactRef
  readonly name: string
  readonly mediaType: string
  readonly maxBytes?: number
}

export interface TextSourceManifest {
  readonly kind: 'text-source-manifest'
  readonly version: 2
  readonly originalName: string
  readonly mediaType: string
  readonly rawRef: ArtifactRef
  readonly normalizedRef: ArtifactRef
  readonly contentHash: `sha256:${string}`
  readonly byteLength: number
  readonly normalizedByteLength: number
  readonly format: 'pdf' | 'html' | 'markdown' | 'text'
  readonly fragments: ReadonlyArray<DocumentLocator>
}

export interface IngestTextSourceResult {
  readonly rawRef: ArtifactRef
  readonly normalizedRef: ArtifactRef
  readonly manifestRef: ArtifactRef
  readonly contentHash: `sha256:${string}`
  readonly byteLength: number
  readonly normalizedText: string
}

const textDecoder = new TextDecoder('utf-8', { fatal: true })
const textEncoder = new TextEncoder()

const hashBytes = (bytes: Uint8Array): `sha256:${string}` =>
  `sha256:${createHash('sha256').update(bytes).digest('hex')}`

export const normalizeTextBytes = (bytes: Uint8Array): Effect.Effect<NormalizedText, IngestionFailureError, never> =>
  Effect.try({
    try: () => {
      const decoded = textDecoder.decode(bytes)
      const withoutBom = decoded.startsWith('\uFEFF') ? decoded.slice(1) : decoded
      const normalized = withoutBom.replace(/\r\n/g, '\n').replace(/\r/g, '\n')
      const normalizedBytes = textEncoder.encode(normalized)
      return { bytes: normalizedBytes, contentHash: hashBytes(normalizedBytes) }
    },
    catch: () => new IngestionFailureError({ reason: 'invalid-utf8', message: 'Text source is not valid UTF-8' }),
  })

const manifestBytes = (manifest: TextSourceManifest): Uint8Array =>
  textEncoder.encode(`${JSON.stringify(manifest)}\n`)

export const ingestTextSource = (input: IngestTextSourceInput) =>
  Effect.gen(function* () {
    const staged = yield* input.store.readStagedObject(input.stagedRef).pipe(
      Effect.mapError((error) => new IngestionFailureError({ reason: error._tag, message: 'Staged artifact could not be read' })),
    )
    const classification = yield* classifyTextSource({
      name: input.name,
      mediaType: input.mediaType,
      byteLength: staged.byteLength,
      maxBytes: input.maxBytes,
    })
    const document = yield* (classification.extension === '.pdf'
      ? parsePdf(staged.bytes)
      : classification.extension === '.html' || classification.extension === '.htm'
        ? parseHtml(staged.bytes)
        : classification.extension === '.md'
          ? parseMarkdown(staged.bytes)
          : parseText(staged.bytes)).pipe(
      Effect.mapError((error) => new IngestionFailureError({ reason: error.reason, message: error.message })),
    )
    const normalizedBytes = textEncoder.encode(document.text)
    const normalized: NormalizedText = { bytes: normalizedBytes, contentHash: hashBytes(normalizedBytes) }
    const raw = yield* input.store.writeObject(staged.bytes, { mediaType: input.mediaType }).pipe(
      Effect.mapError((error) => new IngestionFailureError({ reason: error._tag, message: 'Raw artifact could not be stored' })),
    )
    const normalizedObject = yield* input.store.writeObject(normalized.bytes, { mediaType: 'text/plain' }).pipe(
      Effect.mapError((error) => new IngestionFailureError({ reason: error._tag, message: 'Normalized artifact could not be stored' })),
    )
    const manifest: TextSourceManifest = {
      kind: 'text-source-manifest',
      version: 2,
      originalName: input.name,
      mediaType: input.mediaType,
      rawRef: raw.ref,
      normalizedRef: normalizedObject.ref,
      contentHash: normalized.contentHash,
      byteLength: staged.byteLength,
      normalizedByteLength: normalized.bytes.byteLength,
      format: document.format,
      fragments: document.fragments.map(({ text: _text, ...locator }) => locator),
    }
    const manifestObject = yield* input.store.writeObject(manifestBytes(manifest), { mediaType: 'application/json' }).pipe(
      Effect.mapError((error) => new IngestionFailureError({ reason: error._tag, message: 'Manifest artifact could not be stored' })),
    )

    return {
      rawRef: raw.ref,
      normalizedRef: normalizedObject.ref,
      manifestRef: manifestObject.ref,
      contentHash: normalized.contentHash,
      byteLength: staged.byteLength,
      normalizedText: textDecoder.decode(normalized.bytes),
    }
  })
