import { describe, it, expect } from 'bun:test'
import { Effect, ConfigProvider, Layer, Exit, Redacted } from 'effect'
import { apiAuthTokenConfig, apiPortConfig, apiWorkspaceIdConfig, artifactStorageRootConfig, databaseUrlConfig, maxTextSourceBytesConfig } from './config'

describe('API Config', () => {
  it('uses default port 3001 when API_PORT not set', async () => {
    const provider = ConfigProvider.fromMap(new Map())
    const result = await Effect.runPromise(
      apiPortConfig.pipe(Effect.provide(Layer.setConfigProvider(provider))),
    )
    expect(result).toBe(3001)
  })

  it('reads API_PORT override when set', async () => {
    const provider = ConfigProvider.fromMap(new Map([['API_PORT', '4001']]))
    const result = await Effect.runPromise(
      apiPortConfig.pipe(Effect.provide(Layer.setConfigProvider(provider))),
    )
    expect(result).toBe(4001)
  })

  it('rejects invalid API_PORT value', async () => {
    const provider = ConfigProvider.fromMap(new Map([['API_PORT', 'not-a-number']]))
    const result = await Effect.runPromiseExit(
      apiPortConfig.pipe(Effect.provide(Layer.setConfigProvider(provider))),
    )
    expect(Exit.isFailure(result)).toBe(true)
  })
})

describe('API Database URL Config', () => {
  it('reads DATABASE_URL when set', async () => {
    const provider = ConfigProvider.fromMap(
      new Map([['DATABASE_URL', 'postgres://struct:struct@localhost:5432/struct']]),
    )
    const result = await Effect.runPromise(
      databaseUrlConfig.pipe(Effect.provide(Layer.setConfigProvider(provider))),
    )
    expect(Redacted.value(result)).toBe(
      'postgres://struct:struct@localhost:5432/struct',
    )
  })

  it('fails when DATABASE_URL not set', async () => {
    const provider = ConfigProvider.fromMap(new Map())
    const result = await Effect.runPromiseExit(
      databaseUrlConfig.pipe(Effect.provide(Layer.setConfigProvider(provider))),
    )
    expect(Exit.isFailure(result)).toBe(true)
  })
})

describe('API authentication token config', () => {
  it('loads a redacted token with a safe minimum length', async () => {
    const provider = ConfigProvider.fromMap(
      new Map([['API_AUTH_TOKEN', 'local-api-token-value']]),
    )
    const result = await Effect.runPromise(
      apiAuthTokenConfig.pipe(Effect.provide(Layer.setConfigProvider(provider))),
    )
    expect(Redacted.value(result)).toBe('local-api-token-value')
  })

  it('rejects missing and short tokens', async () => {
    for (const entries of [
      new Map<string, string>(),
      new Map([['API_AUTH_TOKEN', 'too-short']]),
    ]) {
      const result = await Effect.runPromiseExit(
        apiAuthTokenConfig.pipe(
          Effect.provide(Layer.setConfigProvider(ConfigProvider.fromMap(entries))),
        ),
      )
      expect(Exit.isFailure(result)).toBe(true)
    }
  })
})

describe('API identity workspace config', () => {
  it('requires a valid workspace UUID', async () => {
    const valid = await Effect.runPromise(apiWorkspaceIdConfig.pipe(
      Effect.provide(Layer.setConfigProvider(ConfigProvider.fromMap(new Map([
        ['API_WORKSPACE_ID', '910e8400-e29b-41d4-a716-446655440000'],
      ])))),
    ))
    expect(String(valid)).toBe('910e8400-e29b-41d4-a716-446655440000')

    for (const entries of [new Map<string, string>(), new Map([
      ['API_WORKSPACE_ID', 'not-a-workspace'],
    ])]) {
      const exit = await Effect.runPromiseExit(apiWorkspaceIdConfig.pipe(
        Effect.provide(Layer.setConfigProvider(ConfigProvider.fromMap(entries))),
      ))
      expect(Exit.isFailure(exit)).toBe(true)
    }
  })
})

describe('API upload staging config', () => {
  it('uses bounded text-source and artifact-root defaults', async () => {
    const provider = ConfigProvider.fromMap(new Map())
    const [root, maxBytes] = await Effect.runPromise(
      Effect.all([artifactStorageRootConfig, maxTextSourceBytesConfig]).pipe(
        Effect.provide(Layer.setConfigProvider(provider)),
      ),
    )

    expect(root).toBe('./.local/artifacts')
    expect(maxBytes).toBe(1048576)
  })

  it('rejects non-positive MAX_TEXT_SOURCE_BYTES values', async () => {
    const provider = ConfigProvider.fromMap(new Map([['MAX_TEXT_SOURCE_BYTES', '0']]))
    const result = await Effect.runPromiseExit(
      maxTextSourceBytesConfig.pipe(Effect.provide(Layer.setConfigProvider(provider))),
    )

    expect(Exit.isFailure(result)).toBe(true)
  })
})
