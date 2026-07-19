import {
  DeterministicDatasetQueryInput,
  DeterministicDatasetQueryOutput,
} from '@struct/data-engine'
import { Effect, Schema } from 'effect'

export const DATASET_QUERY_TOOL_ID = 'struct.query-dataset'

export const makeDeterministicDatasetQueryTool = (
  execute: import('@struct/data-engine').DeterministicDatasetQueryExecute,
  signal: AbortSignal = new AbortController().signal,
): import('@fancyrobot/fred').Tool<
  typeof DeterministicDatasetQueryInput.Type,
  typeof DeterministicDatasetQueryOutput.Type,
  never
> => ({
  id: DATASET_QUERY_TOOL_ID,
  name: 'Query immutable dataset snapshots',
  description:
    'Runs one bounded read-only SQL query and returns immutable exact rows with dataset citations.',
  capabilities: ['read'],
  strict: true,
  schema: {
    input: Schema.typeSchema(DeterministicDatasetQueryInput),
    success: Schema.typeSchema(DeterministicDatasetQueryOutput),
  },
  execute: (input) => Effect.runPromise(execute(input), { signal }),
})
