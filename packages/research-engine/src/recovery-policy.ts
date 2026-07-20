import {
  ResearchContractValidationError,
  type ResearchExecutionCheckpoint,
  type ResearchPlan,
} from '@struct/domain'
import { Effect, Option } from 'effect'

export type ResearchRecoveryDisposition =
  | {
      readonly kind: 'start'
      readonly plan: ResearchPlan
    }
  | {
      readonly kind: 'resume'
      readonly plan: ResearchPlan
      readonly checkpoint: ResearchExecutionCheckpoint
    }
  | {
      readonly kind: 'finalize'
      readonly plan: ResearchPlan
      readonly checkpoint: ResearchExecutionCheckpoint
    }
  | {
      readonly kind: 'cancel'
    }
  | {
      readonly kind: 'terminal'
      readonly status: 'completed' | 'failed' | 'cancelled'
    }

export interface ResearchDurableRecoveryState {
  readonly plan: Option.Option<ResearchPlan>
  readonly checkpoint: Option.Option<ResearchExecutionCheckpoint>
  readonly cancellationStatus: 'none' | 'requested' | 'acknowledged'
  readonly terminalStatus: Option.Option<'completed' | 'failed' | 'cancelled'>
}

export const selectResearchRecovery = Effect.fn(
  'ResearchRecovery.select',
)(function* (
  expectedPlan: ResearchPlan,
  durable: ResearchDurableRecoveryState,
) {
  if (Option.isSome(durable.terminalStatus)) {
    return {
      kind: 'terminal' as const,
      status: durable.terminalStatus.value,
    }
  }
  if (durable.cancellationStatus !== 'none') {
    return { kind: 'cancel' as const }
  }
  if (Option.isSome(durable.plan) && durable.plan.value.id !== expectedPlan.id) {
    return yield* new ResearchContractValidationError({
      contract: 'execution',
      reason: 'invalid-identity',
      path: 'durable.plan.id',
      message: 'Durable plan does not match the requested research plan',
    })
  }
  if (Option.isNone(durable.checkpoint)) {
    return { kind: 'start' as const, plan: expectedPlan }
  }
  const checkpoint = durable.checkpoint.value
  if (
    checkpoint.state.runId !== expectedPlan.runId
    || checkpoint.state.planId !== expectedPlan.id
  ) {
    return yield* new ResearchContractValidationError({
      contract: 'execution',
      reason: 'invalid-identity',
      path: 'durable.checkpoint.state',
      message: 'Durable checkpoint does not match the requested research plan',
    })
  }
  if (checkpoint.state.status !== 'running' && checkpoint.state.status !== 'paused') {
    return yield* new ResearchContractValidationError({
      contract: 'execution',
      reason: 'malformed',
      path: 'durable.checkpoint.state.status',
      message: 'Only committed running or paused checkpoints may be resumed',
    })
  }
  if (
    checkpoint.state.status === 'paused'
    && checkpoint.state.completed.length === expectedPlan.nodes.length
    && expectedPlan.nodes.every((node) =>
      checkpoint.state.completed.some((completed) =>
        completed.nodeId === node.id))
  ) {
    return { kind: 'finalize' as const, plan: expectedPlan, checkpoint }
  }
  return { kind: 'resume' as const, plan: expectedPlan, checkpoint }
})
