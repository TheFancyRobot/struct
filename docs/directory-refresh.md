# Directory manifests and refresh

Directory ingestion starts with sandboxed discovery and a deterministic,
immutable inventory. Persistence, extraction, and UI behavior remain outside
this boundary and build on it in later Phase 03 steps.

## Identity and scope

- `DirectoryRootId` identifies one registered root.
- `DirectorySnapshotId` identifies one immutable inventory of that root.
- `ManifestEntryId` identifies one immutable entry in a snapshot.
- Roots, snapshots, manifests, and entries carry workspace and project scope.
  A manifest is invalid when any entry points at another root, snapshot,
  workspace, or project.
- Manifests store canonical paths relative to the registered root. Absolute
  paths, drive-qualified paths, backslashes, empty segments, `.` segments, and
  `..` segments are invalid. Paths must be NFC-normalized Unicode without
  control characters, at most 4,096 UTF-8 bytes total, and at most 255 UTF-8
  bytes per segment. Host paths never cross this domain boundary.

`DirectoryDiscovery` resolves only canonical paths beneath the registered root.
It rejects a symlink root, never follows entry symlinks, verifies real paths
before traversal, and opens files with no-follow semantics before hashing. The
opened descriptor's device/inode identity must match the current contained
canonical path before any bytes are accepted, including when an ancestor
directory is replaced during discovery.

## Discovery and hashing boundary

- `DirectoryDiscovery` is an Effect service with a runtime-injected filesystem
  adapter. The Bun layer uses sorted UTF-8 path enumeration and streams files
  through a SHA-256 hasher in fixed-size chunks.
- Depth, inspected-entry count, per-file bytes, and aggregate hashed bytes are
  explicit non-negative limits. Exhaustion is a typed terminal failure.
- `.git` and `node_modules` are ignored by default. Callers may provide a
  deterministic name allow/ignore policy without changing containment rules.
- Unsupported files remain ordered manifest entries with no content hash.
  Symlinks, permission denial, disappearing files, and inspection/read failures
  are ordered typed outcomes and are excluded from the partial manifest.
- Entry IDs are deterministic from snapshot identity plus canonical relative
  path, so retrying the same snapshot cannot perturb the manifest.
- Consumers must inspect all outcomes before treating an absent manifest path
  as removed. A partial manifest with entry failures is observable progress,
  not permission to commit a refresh.

## Entry and digest contract

An entry is either:

- `included`, with a byte length and lowercase `sha256:<64 hex>` content hash; or
- `unsupported`, with a stable reason and an optional content hash.

Entries are sorted by canonical relative path using ascending UTF-8 byte order,
which is portable across host runtimes. Duplicate paths are invalid.

The manifest digest is SHA-256 over the ordered sequence of:

1. relative path;
2. entry status;
3. decimal byte length;
4. content hash, or an empty value;
5. unsupported reason, or an empty value.

Each field is length-prefixed before hashing. Snapshot and entry IDs are not
hashed, so retrying the same inventory produces the same digest regardless of
discovery order or newly allocated IDs.

## Refresh dispositions

Refresh compares entries by canonical relative path:

| Previous | Current | Disposition | Source-version rule |
| --- | --- | --- | --- |
| absent | included | `added` | create the first immutable version |
| included, same hash | included | `unchanged` | reuse the previous version |
| included, different hash | included | `modified` | create a new version |
| unsupported | included | `modified` | create a new version |
| any | absent | `removed` | retain historical lineage; create no version |
| any or absent | unsupported | `unsupported` | create no version |

Plan output is sorted by canonical relative path and cannot change when either
input manifest is enumerated in another order.

`DirectorySourceVersionLineage` makes the version rule executable: `added`
cannot reference a previous version, `modified` must point to a distinct new
version, and `unchanged` must reuse the exact previous version. Snapshots,
manifests, entries, and source versions are immutable after creation.

## Downstream boundary

STEP-03-02 emits these contracts without widening registered roots. Later job
and persistence steps may checkpoint and commit them only after handling every
typed discovery outcome; they must preserve canonical ordering, digest identity,
workspace/project scope, removed-entry history, and source-version lineage.
