await Bun.write(Bun.stdout, `${JSON.stringify({
  status: 'deferred',
  reason: 'Performance thresholds are owned by their implementation phases.',
})}\n`)

export {}
