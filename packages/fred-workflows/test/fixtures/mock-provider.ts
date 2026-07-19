import { Effect, Layer } from 'effect'
// eslint-disable-next-line no-unused-vars -- Type-only namespace is consumed by TypeScript.
import type * as Fred from '@fancyrobot/fred'

export const MockModelProvider: Fred.ProviderDefinition = {
  id: 'mock-model-provider',
  aliases: [],
  config: {},
  layer: Layer.empty as unknown as Layer.Layer<any, any, any>,
  getModel: () => Effect.fail(new Error('Mock model is executed by the mock Fred client')),
}
