import { compareCorpusManifests } from './corpus.js'

const [leftPath, rightPath] = process.argv.slice(2)
if (leftPath === undefined || rightPath === undefined) {
  throw new Error('Usage: corpus:compare-hashes <left-manifest> <right-manifest>')
}

const manifest = await compareCorpusManifests(leftPath, rightPath)
await Bun.write(Bun.stdout, `${JSON.stringify({
  status: 'identical',
  profile: manifest.profile,
  seed: manifest.canonicalSeed,
  totalFiles: manifest.totalFiles,
  manifestSha256: manifest.manifestSha256,
}, null, 2)}\n`)
