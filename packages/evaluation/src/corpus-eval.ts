await Bun.write(Bun.stdout, `${JSON.stringify({
  status: 'deferred',
  reason: 'The full evaluation corpus is owned by Phase 04 and the pre-release gate.',
})}\n`)

export {}
