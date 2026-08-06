import { Effect } from 'effect'
import {
  inferenceProviderModelsUrl,
  resolveInferenceProviderCredential,
} from '@struct/workflows'

export const testInferenceProviderConnection = (input: {
  readonly endpoint: string | null
  readonly credentialReference: string
}, fetcher: (input: URL, init: RequestInit) => Promise<Response> = (url, init) => fetch(url, init)): Effect.Effect<{ readonly ok: boolean, readonly message: string }, never> =>
  resolveInferenceProviderCredential(input.credentialReference).pipe(
    Effect.flatMap(({ secret }) => Effect.tryPromise({
      try: async (signal) => {
        const response = await fetcher(inferenceProviderModelsUrl(input.endpoint), {
          method: 'GET',
          headers: { Authorization: `Bearer ${secret}` },
          signal,
        })
        try {
          return response.ok
        } finally {
          await response.body?.cancel().catch(() => undefined)
        }
      },
      catch: () => null,
    })),
    Effect.map((result) => result === true
      ? { ok: true, message: 'Connection succeeded.' }
      : { ok: false, message: 'Connection failed.' }),
    Effect.timeoutTo({ duration: '5 seconds', onSuccess: (result) => result, onTimeout: () => ({ ok: false, message: 'Connection timed out.' }) }),
    Effect.catchAll(() => Effect.succeed({ ok: false, message: 'Connection failed.' })),
  )
