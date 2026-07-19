import { walkingSkeletonCorpus } from './index'

await Bun.write(Bun.stdout, `${JSON.stringify({
  status: 'ready',
  corpus: walkingSkeletonCorpus,
})}\n`)
