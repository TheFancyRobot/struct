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
      try: async (signal) => fetcher(inferenceProviderModelsUrl(input.endpoint), {
        method: 'GET',
        headers: { Authorization: `Bearer ${secret}` },
        signal,
      }),
      catch: () => null,
    })),
    Effect.map((result) => result?.ok === true
      ? { ok: true, message: 'Connection succeeded.' }
      : { ok: false, message: 'Connection failed.' }),
    Effect.timeoutTo({ duration: '5 seconds', onSuccess: (result) => result, onTimeout: () => ({ ok: false, message: 'Connection timed out.' }) }),
    Effect.catchAll(() => Effect.succeed({ ok: false, message: 'Connection failed.' })),
  )
