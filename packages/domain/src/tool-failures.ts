import { Schema } from 'effect'
import {
  ProjectId,
  ResearchPlanNodeId,
  ResearchRunId,
  WorkspaceId,
} from './branded-ids.js'
import {
  ResearchToolCapability,
  ResearchToolId,
} from './research-plan.js'

const Message = Schema.String.pipe(Schema.minLength(1), Schema.maxLength(512))
const Detail = Schema.String.pipe(Schema.minLength(1), Schema.maxLength(128))

const ToolIdentity = {
  toolId: ResearchToolId,
  capability: ResearchToolCapability,
  nodeId: ResearchPlanNodeId,
  runId: ResearchRunId,
}

export class ResearchToolUnknownError
  extends Schema.TaggedError<ResearchToolUnknownError>()(
    'ResearchToolUnknownError',
    { toolId: ResearchToolId, message: Message },
  ) {}

export class ResearchToolAuthorizationError
  extends Schema.TaggedError<ResearchToolAuthorizationError>()(
    'ResearchToolAuthorizationError',
    {
      ...ToolIdentity,
      workspaceId: WorkspaceId,
      projectId: ProjectId,
      detail: Detail,
      message: Message,
    },
  ) {}

export class ResearchToolInputValidationError
  extends Schema.TaggedError<ResearchToolInputValidationError>()(
    'ResearchToolInputValidationError',
    { ...ToolIdentity, message: Message },
  ) {}

export class ResearchToolOutputValidationError
  extends Schema.TaggedError<ResearchToolOutputValidationError>()(
    'ResearchToolOutputValidationError',
    { ...ToolIdentity, message: Message },
  ) {}

export class ResearchToolCancelledError
  extends Schema.TaggedError<ResearchToolCancelledError>()(
    'ResearchToolCancelledError',
    { ...ToolIdentity, message: Message },
  ) {}

export class ResearchToolTimeoutError
  extends Schema.TaggedError<ResearchToolTimeoutError>()(
    'ResearchToolTimeoutError',
    { ...ToolIdentity, timeoutMilliseconds: Schema.Number, message: Message },
  ) {}

export class ResearchToolProviderUnavailableError
  extends Schema.TaggedError<ResearchToolProviderUnavailableError>()(
    'ResearchToolProviderUnavailableError',
    { ...ToolIdentity, message: Message },
  ) {}

export class ResearchToolTransportError
  extends Schema.TaggedError<ResearchToolTransportError>()(
    'ResearchToolTransportError',
    { ...ToolIdentity, message: Message },
  ) {}

export class ResearchToolLeaseLostError
  extends Schema.TaggedError<ResearchToolLeaseLostError>()(
    'ResearchToolLeaseLostError',
    { ...ToolIdentity, message: Message },
  ) {}

export class ResearchToolSidecarUnavailableError
  extends Schema.TaggedError<ResearchToolSidecarUnavailableError>()(
    'ResearchToolSidecarUnavailableError',
    { ...ToolIdentity, message: Message },
  ) {}

export class ResearchToolRetrySafetyError
  extends Schema.TaggedError<ResearchToolRetrySafetyError>()(
    'ResearchToolRetrySafetyError',
    { ...ToolIdentity, message: Message },
  ) {}

export const ResearchToolFailure = Schema.Union(
  ResearchToolUnknownError,
  ResearchToolAuthorizationError,
  ResearchToolInputValidationError,
  ResearchToolOutputValidationError,
  ResearchToolCancelledError,
  ResearchToolTimeoutError,
  ResearchToolProviderUnavailableError,
  ResearchToolTransportError,
  ResearchToolLeaseLostError,
  ResearchToolSidecarUnavailableError,
  ResearchToolRetrySafetyError,
)
export type ResearchToolFailure =
  Schema.Schema.Type<typeof ResearchToolFailure>
