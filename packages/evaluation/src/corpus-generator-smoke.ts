import { mkdtemp, rm } from 'node:fs/promises'
import {
  CORPUS_CANONICAL_SEED,
  compareCorpusManifests,
  defaultTemporaryCorpusRoot,
  generateCorpus,
} from './corpus.js'

const root = await mkdtemp(defaultTemporaryCorpusRoot('struct-corpus-smoke-'))
try {
  const first = await generateCorpus({
    outDir: `${root}/first`,
    profile: 'smoke',
    seed: CORPUS_CANONICAL_SEED,
  })
  const second = await generateCorpus({
    outDir: `${root}/second`,
    profile: 'smoke',
    seed: CORPUS_CANONICAL_SEED,
  })
  await compareCorpusManifests(
    `${first.outDir}/manifest.json`,
    `${second.outDir}/manifest.json`,
  )
  await Bun.write(Bun.stdout, `${JSON.stringify({
    status: 'ready',
    profile: 'smoke',
    totalFiles: first.manifest.totalFiles,
    manifestSha256: first.manifest.manifestSha256,
  }, null, 2)}\n`)
} finally {
  await rm(root, { recursive: true, force: true })
}
