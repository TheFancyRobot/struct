import { Effect } from 'effect'
import {
  inferenceProviderModelsUrl,
  isApprovedInferenceProviderUrl,
  resolveInferenceProviderCredential,
} from '@struct/workflows'

export const testInferenceProviderConnection = (input: {
  readonly endpoint: string | null
  readonly credentialReference: string
}, fetcher: (input: URL, init: RequestInit) => Promise<Response> = (url, init) => fetch(url, init)): Effect.Effect<{ readonly ok: boolean, readonly message: string }, never> =>
  Effect.try({
    try: () => inferenceProviderModelsUrl(input.endpoint),
    catch: () => null,
  }).pipe(
    Effect.flatMap((url) => isApprovedInferenceProviderUrl(url)
      ? resolveInferenceProviderCredential(input.credentialReference).pipe(
          Effect.map((credential) => ({ url, credential })),
        )
      : Effect.fail(null),
    ),
    Effect.flatMap(({ url, credential }) => Effect.tryPromise({
      try: async (signal) => {
        const response = await fetcher(url, {
          method: 'GET',
          headers: { Authorization: `Bearer ${credential.secret}` },
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
