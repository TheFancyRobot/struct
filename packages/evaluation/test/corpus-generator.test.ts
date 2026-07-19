import { describe, expect, it } from 'bun:test'
import { mkdtemp, rm, symlink } from 'node:fs/promises'
import { resolve } from 'node:path'
import {
  CORPUS_CANONICAL_SEED,
  CORPUS_SMOKE_FILE_COUNT,
  compareCorpusManifests,
  defaultTemporaryCorpusRoot,
  generateCorpus,
  verifyCorpus,
} from '../src/corpus.js'

async function temporaryRoot(name: string): Promise<string> {
  return mkdtemp(defaultTemporaryCorpusRoot(`${name}-`))
}

describe('reproducible JSON evaluation corpus', () => {
  it('generates the fixed smoke shape twice with identical evidence hashes', async () => {
    const root = await temporaryRoot('struct-corpus-repeat')
    try {
      const first = await generateCorpus({
        outDir: resolve(root, 'first'),
        profile: 'smoke',
      })
      const second = await generateCorpus({
        outDir: resolve(root, 'second'),
        profile: 'smoke',
      })
      const manifest = await compareCorpusManifests(
        resolve(first.outDir, 'manifest.json'),
        resolve(second.outDir, 'manifest.json'),
      )

      expect(manifest.totalFiles).toBe(CORPUS_SMOKE_FILE_COUNT)
      expect(manifest.canonicalSeed).toBe(CORPUS_CANONICAL_SEED)
      expect(manifest.prng).toBe('sha256-seedsplit')
      expect(manifest.benchmarkEnvSchemaVersion).toBe('1.0.0')
      expect(manifest.schemaFamilies.map((family) => family.fileCount)).toEqual(
        [120, 60, 40, 30],
      )
      expect(manifest.schemaFamilies[0]).toMatchObject({
        schemaFamilyId: 'fam.call_log',
        recordCount: 120,
        knownConflicts: ['owner_id'],
      })
      expect(manifest.files[0]).toMatchObject({
        kind: 'json',
        recordCount: 1,
        sourceVersion: 'v1',
      })
      expect(manifest.caseCounts['prompt-injection']).toBe(4)
      expect(manifest.caseCounts['type-conflict']).toBeGreaterThan(0)
      expect(manifest.caseCounts['duplicate']).toBeGreaterThan(0)
      const groundTruth = await Bun.file(
        resolve(first.outDir, 'ground-truth.json'),
      ).json()
      expect(
        groundTruth.exact['EXACT-PERCENT-NULL-OWNER'].answer,
      ).toEqual({
        numerator: 6,
        denominator: 30,
        percentBasisPoints: 2_000,
      })
      const exactEntries = Object.values(groundTruth.exact) as Array<{
        citations: Array<{ sourceVersion: string }>
      }>
      expect(exactEntries.every(
        (entry) =>
          entry.citations.every((citation) => citation.sourceVersion === 'v1'),
      )).toBe(true)
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })

  it('changes hashes for a changed seed while remaining valid', async () => {
    const root = await temporaryRoot('struct-corpus-seed')
    try {
      const canonical = await generateCorpus({
        outDir: resolve(root, 'canonical'),
        profile: 'smoke',
      })
      const changed = await generateCorpus({
        outDir: resolve(root, 'changed'),
        profile: 'smoke',
        seed: '6e5d13b204c9f728',
      })

      await expect(
        verifyCorpus(resolve(changed.outDir, 'manifest.json')),
      ).resolves.toBeDefined()
      expect(changed.manifest.corpusSha256).not.toBe(
        canonical.manifest.corpusSha256,
      )
      expect(changed.manifest.groundTruthSha256).not.toBe(
        canonical.manifest.groundTruthSha256,
      )
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })

  it('fails verification after generated content is tampered with', async () => {
    const root = await temporaryRoot('struct-corpus-tamper')
    try {
      const generated = await generateCorpus({
        outDir: resolve(root, 'generated'),
        profile: 'smoke',
      })
      await Bun.write(
        resolve(generated.outDir, generated.manifest.files[0]!.path),
        '{"tampered":true}\n',
      )

      await expect(
        verifyCorpus(resolve(generated.outDir, 'manifest.json')),
      ).rejects.toThrow('Corpus content hash mismatch')
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })

  it('rejects unlisted files and a tampered ownership marker', async () => {
    const root = await temporaryRoot('struct-corpus-inventory')
    try {
      const generated = await generateCorpus({
        outDir: resolve(root, 'generated'),
        profile: 'smoke',
      })
      const manifestPath = resolve(generated.outDir, 'manifest.json')
      await Bun.write(resolve(generated.outDir, 'unlisted.json'), '{}\n')
      await expect(verifyCorpus(manifestPath)).rejects.toThrow(
        'file inventory',
      )

      await rm(resolve(generated.outDir, 'unlisted.json'))
      await Bun.write(
        resolve(generated.outDir, '.struct-evaluation-corpus'),
        '{"tampered":true}\n',
      )
      await expect(verifyCorpus(manifestPath)).rejects.toThrow(
        'ownership marker',
      )
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })

  it('rejects a structurally invalid manifest before trusting its hashes', async () => {
    const root = await temporaryRoot('struct-corpus-invalid-manifest')
    try {
      const generated = await generateCorpus({
        outDir: resolve(root, 'generated'),
        profile: 'smoke',
      })
      const manifestPath = resolve(generated.outDir, 'manifest.json')
      const manifest = await Bun.file(manifestPath).json()
      manifest.files[0].sizeBytes = 'not-an-integer'
      await Bun.write(manifestPath, JSON.stringify(manifest))

      await expect(verifyCorpus(manifestPath)).rejects.toThrow()
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })

  it('refuses to clean an unmarked non-empty output directory', async () => {
    const root = await temporaryRoot('struct-corpus-cleanup')
    const output = resolve(root, 'owned-by-someone-else')
    try {
      await Bun.write(resolve(output, 'keep.txt'), 'keep')
      await expect(
        generateCorpus({ outDir: output, profile: 'smoke' }),
      ).rejects.toThrow('Refusing to clean an unmarked non-empty')
      expect(await Bun.file(resolve(output, 'keep.txt')).text()).toBe('keep')
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })

  it('rejects a symlink output root without touching its target', async () => {
    const root = await temporaryRoot('struct-corpus-symlink')
    const target = resolve(root, 'target')
    const output = resolve(root, 'linked-output')
    try {
      await Bun.write(resolve(target, 'keep.txt'), 'keep')
      await symlink(target, output)
      await expect(
        generateCorpus({ outDir: output, profile: 'smoke' }),
      ).rejects.toThrow('must not be a symbolic link')
      expect(await Bun.file(resolve(target, 'keep.txt')).text()).toBe('keep')
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })
})
