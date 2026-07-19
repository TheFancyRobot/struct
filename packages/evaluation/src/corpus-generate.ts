import {
  CORPUS_CANONICAL_SEED,
  generateCorpus,
} from './corpus.js'

function option(name: string): string | undefined {
  const index = process.argv.indexOf(name)
  return index === -1 ? undefined : process.argv[index + 1]
}

const outDir = option('--out')
if (outDir === undefined) {
  throw new Error('Usage: corpus:generate [--profile full|smoke] [--seed hex] --out <absolute-dir>')
}
const profile = option('--profile') ?? 'full'
if (profile !== 'full' && profile !== 'smoke') {
  throw new Error('Corpus profile must be full or smoke')
}
const result = await generateCorpus({
  outDir,
  profile,
  seed: option('--seed') ?? CORPUS_CANONICAL_SEED,
})

await Bun.write(Bun.stdout, `${JSON.stringify({
  status: 'generated',
  profile: result.manifest.profile,
  seed: result.manifest.canonicalSeed,
  totalFiles: result.manifest.totalFiles,
  manifestSha256: result.manifest.manifestSha256,
  corpusSha256: result.manifest.corpusSha256,
  groundTruthSha256: result.manifest.groundTruthSha256,
  questionSetSha256: result.manifest.questionSetSha256,
  elapsedMs: result.elapsedMs,
  outDir: result.outDir,
}, null, 2)}\n`)
