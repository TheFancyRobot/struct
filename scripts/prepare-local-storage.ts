import { access, lstat, mkdir } from 'node:fs/promises'
import { constants } from 'node:fs'
import { resolve } from 'node:path'

const repositoryRoot = resolve(import.meta.dir, '..')
const roots = [
  resolve(repositoryRoot, process.env.ARTIFACT_STORAGE_ROOT ?? '.local/artifacts'),
  resolve(repositoryRoot, '.local/pgdata'),
] as const

for (const root of roots) {
  await mkdir(root, { recursive: true })
  const metadata = await lstat(root)
  if (!metadata.isDirectory() || metadata.isSymbolicLink()) {
    throw new Error(`Local storage must be a real directory: ${root}`)
  }
  await access(root, constants.R_OK | constants.W_OK | constants.X_OK)
}
