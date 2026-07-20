import { access, lstat, mkdir } from 'node:fs/promises'
import { constants } from 'node:fs'
import { resolve } from 'node:path'

const repositoryRoot = resolve(import.meta.dir, '..')
const artifactRoot = resolve(
  repositoryRoot,
  process.env.ARTIFACT_STORAGE_ROOT ?? '.local/artifacts',
)

await mkdir(artifactRoot, { recursive: true })
const metadata = await lstat(artifactRoot)
if (!metadata.isDirectory() || metadata.isSymbolicLink()) {
  throw new Error('Local artifact storage must be a real directory')
}
await access(artifactRoot, constants.R_OK | constants.W_OK | constants.X_OK)
