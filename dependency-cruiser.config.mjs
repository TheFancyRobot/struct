/** @type {import('dependency-cruiser').IConfiguration} */
export default {
  forbidden: [
    // No app-to-app imports (cross-app only, not intra-app)
    {
      name: 'no-app-to-app-web-api',
      severity: 'error',
      comment: 'apps/web must not import apps/api. Use HTTP API client only.',
      from: { path: '^apps/web/' },
      to: { path: '^apps/api/' },
    },
    {
      name: 'no-app-to-app-web-worker',
      severity: 'error',
      comment: 'apps/web must not import apps/worker. Use SSE only.',
      from: { path: '^apps/web/' },
      to: { path: '^apps/worker/' },
    },
    {
      name: 'no-app-to-app-api-web',
      severity: 'error',
      comment: 'apps/api must not import apps/web.',
      from: { path: '^apps/api/' },
      to: { path: '^apps/web/' },
    },
    {
      name: 'no-app-to-app-api-worker',
      severity: 'error',
      comment: 'apps/api must not import apps/worker.',
      from: { path: '^apps/api/' },
      to: { path: '^apps/worker/' },
    },
    {
      name: 'no-app-to-app-worker-api',
      severity: 'error',
      comment: 'apps/worker must not import apps/api.',
      from: { path: '^apps/worker/' },
      to: { path: '^apps/api/' },
    },
    {
      name: 'no-app-to-app-worker-web',
      severity: 'error',
      comment: 'apps/worker must not import apps/web.',
      from: { path: '^apps/worker/' },
      to: { path: '^apps/web/' },
    },
    // No package importing an app
    {
      name: 'no-package-imports-app',
      severity: 'error',
      comment: 'Packages must not import applications. Dependency flow is downward only.',
      from: { path: '^packages/' },
      to: { path: '^apps/' },
    },
    // Domain imports nothing internal (exclude intra-domain imports)
    {
      name: 'domain-is-leaf',
      severity: 'error',
      comment:
        '@struct/domain is the canonical type source. It must not import any internal package.',
      from: { path: '^packages/domain/' },
      to: { path: '^packages/(?!domain/)' },
    },
    // No circular dependencies
    {
      name: 'no-circular',
      severity: 'warn',
      comment: 'This dependency is part of a circular relationship.',
      from: {},
      to: { circular: true },
    },
  ],
  options: {
    doNotFollow: { path: ['node_modules'] },
    exclude: { path: ['dist/', '\\.local/', '\\.test\\.', '\\.spec\\.', '\\.d\\.ts$'] },
    tsPreCompilationDeps: false,
    enhancedResolveOptions: {
      exportsFields: ['exports'],
      conditionNames: ['import', 'require', 'node', 'default', 'types'],
      extensions: ['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs'],
      mainFields: ['main', 'types', 'typings'],
    },
    skipAnalysisNotInRules: true,
    builtInModules: {
      add: ['bun', 'bun:ffi', 'bun:jsc', 'bun:sqlite', 'bun:test', 'bun:wrap'],
    },
  },
}
