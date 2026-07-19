import { Schema } from 'effect'
import { DirectoryRelativePath } from '@struct/domain'

export class DirectoryRootError extends Schema.TaggedError<DirectoryRootError>()(
  'DirectoryRootError',
  {
    reason: Schema.Literal('missing', 'not-directory', 'symlink', 'inspection-failed'),
    message: Schema.String,
  },
) {}

export class DirectoryPathError extends Schema.TaggedError<DirectoryPathError>()(
  'DirectoryPathError',
  {
    relativePath: Schema.String,
    reason: Schema.Literal('absolute', 'traversal', 'invalid', 'outside-root'),
    message: Schema.String,
  },
) {}

export class DirectorySymlinkError extends Schema.TaggedError<DirectorySymlinkError>()(
  'DirectorySymlinkError',
  {
    relativePath: DirectoryRelativePath,
    message: Schema.String,
  },
) {}

export class DirectoryPermissionError extends Schema.TaggedError<DirectoryPermissionError>()(
  'DirectoryPermissionError',
  {
    relativePath: DirectoryRelativePath,
    operation: Schema.Literal('inspect', 'read-directory', 'read-file'),
    message: Schema.String,
  },
) {}

export class DirectoryEntryDisappearedError
  extends Schema.TaggedError<DirectoryEntryDisappearedError>()(
    'DirectoryEntryDisappearedError',
    {
      relativePath: DirectoryRelativePath,
      operation: Schema.Literal('inspect', 'read-directory', 'read-file'),
      message: Schema.String,
    },
  ) {}

export class DirectoryFilesystemError
  extends Schema.TaggedError<DirectoryFilesystemError>()(
    'DirectoryFilesystemError',
    {
      relativePath: Schema.String,
      operation: Schema.Literal('inspect', 'read-directory', 'read-file'),
      message: Schema.String,
    },
  ) {}

export class DirectoryLimitExceededError
  extends Schema.TaggedError<DirectoryLimitExceededError>()(
    'DirectoryLimitExceededError',
    {
      limit: Schema.Literal('depth', 'entries', 'file-bytes', 'aggregate-bytes'),
      maximum: Schema.Number,
      observed: Schema.Number,
      relativePath: Schema.NullOr(DirectoryRelativePath),
      message: Schema.String,
    },
  ) {}

export type DirectoryEntryError =
  | DirectorySymlinkError
  | DirectoryPermissionError
  | DirectoryEntryDisappearedError
  | DirectoryFilesystemError

export type DirectoryDiscoveryError =
  | DirectoryRootError
  | DirectoryPathError
  | DirectoryLimitExceededError
  | DirectoryPermissionError
  | DirectoryEntryDisappearedError
  | DirectoryFilesystemError
