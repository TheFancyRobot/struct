import {
  type ResearchModelRole,
  ResearchProviderFailure,
} from '@struct/research-engine'
import { Effect, Schema } from 'effect'

const Identifier = Schema.String.pipe(Schema.minLength(1), Schema.maxLength(255))

export const ModelOutputContract = Schema.Literal(
  'question-classification.v1',
  'research-plan.v1',
  'evidence-assessment.v1',
  'research-answer.v1',
)
export type ModelOutputContract =
  Schema.Schema.Type<typeof ModelOutputContract>

export const ModelRoute = Schema.Struct({
  platform: Identifier,
  model: Identifier,
  maxSteps: Schema.Literal(1),
  outputContract: ModelOutputContract,
})
export type ModelRoute = Schema.Schema.Type<typeof ModelRoute>

export const ModelRouteWithFallback = Schema.Struct({
  primary: ModelRoute,
  fallback: Schema.NullOr(ModelRoute),
})
export type ModelRouteWithFallback =
  Schema.Schema.Type<typeof ModelRouteWithFallback>

export const ResearchModelRoutingPolicy = Schema.Struct({
  classification: ModelRouteWithFallback,
  planning: ModelRouteWithFallback,
  critique: ModelRouteWithFallback,
  synthesis: ModelRouteWithFallback,
})
export type ResearchModelRoutingPolicy =
  Schema.Schema.Type<typeof ResearchModelRoutingPolicy>

const expectedContracts: Readonly<
  Record<ResearchModelRole, ModelOutputContract>
> = {
  classification: 'question-classification.v1',
  planning: 'research-plan.v1',
  critique: 'evidence-assessment.v1',
  synthesis: 'research-answer.v1',
}

export class IncompatibleModelRoute extends Schema.TaggedError<IncompatibleModelRoute>()(
  'IncompatibleModelRoute',
  {
    role: Schema.Literal(
      'classification',
      'planning',
      'critique',
      'synthesis',
    ),
    expectedContract: ModelOutputContract,
    actualContract: ModelOutputContract,
    message: Schema.String.pipe(Schema.minLength(1), Schema.maxLength(512)),
  },
) {}

export interface ResolvedModelRoute {
  readonly role: ResearchModelRole
  readonly primary: ModelRoute
  readonly fallback: ModelRoute | null
}

export const resolveModelRoute = Effect.fn('ModelRouting.resolve')(
  function* (
    policy: ResearchModelRoutingPolicy,
    role: ResearchModelRole,
  ) {
    const route = policy[role]
    const expectedContract = expectedContracts[role]
    if (route.primary.outputContract !== expectedContract) {
      return yield* new IncompatibleModelRoute({
        role,
        expectedContract,
        actualContract: route.primary.outputContract,
        message: `Primary ${role} route has an incompatible output contract`,
      })
    }
    if (
      route.fallback !== null
      && route.fallback.outputContract !== expectedContract
    ) {
      return yield* new IncompatibleModelRoute({
        role,
        expectedContract,
        actualContract: route.fallback.outputContract,
        message: `Fallback ${role} route has an incompatible output contract`,
      })
    }
    return {
      role,
      primary: route.primary,
      fallback: route.fallback,
    } satisfies ResolvedModelRoute
  },
)

export function boundedProviderFailure(
  message: string,
): ResearchProviderFailure {
  const bounded = message.trim().slice(0, 512)
  return new ResearchProviderFailure({
    message: bounded.length > 0 ? bounded : 'Model provider failed',
  })
}
