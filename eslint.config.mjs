import js from '@eslint/js'
import babelParser from '@babel/eslint-parser'

/** @type {import('eslint').Linter.Config[]} */
export default [
  // === Base rules for all TS/TSX files (babel parser handles TS+JSX syntax) ===
  js.configs.recommended,
  {
    files: ['**/*.ts', '**/*.tsx'],
    languageOptions: {
      parser: babelParser,
      parserOptions: {
        ecmaVersion: 2024,
        sourceType: 'module',
        requireConfigFile: false,
        babelOptions: {
          presets: ['@babel/preset-typescript'],
          plugins: ['@babel/plugin-syntax-jsx'],
        },
      },
      globals: {
        process: 'readonly',
        Bun: 'readonly',
        URL: 'readonly',
        Response: 'readonly',
        Request: 'readonly',
        __dirname: 'readonly',
        document: 'readonly',
        window: 'readonly',
        console: 'readonly',
      },
    },
    rules: {
      'no-throw-literal': 'error',
      'prefer-const': 'error',
      'no-var': 'error',
      // Disable no-undef for TS: tsc strict mode handles this.
      'no-undef': 'off',
      // Relax unused-vars: tsc noUnusedLocals handles this more accurately.
      'no-unused-vars': ['warn', {
        argsIgnorePattern: '^_',
        varsIgnorePattern: '^(type|Component|Router|Route|ParentComponent|JSX)$',
      }],
    },
  },

  // === Backend Effect convention enforcement ===
  // Forbid console.log in backend (use Effect.log)
  {
    files: ['apps/api/src/**/*.ts', 'apps/worker/src/**/*.ts', 'packages/**/*.ts'],
    rules: {
      'no-console': ['error', { allow: ['warn', 'error'] }],
    },
  },

  // Forbid process.env and Context.Tag in backend (use Effect Config.* and Effect.Service)
  {
    files: ['apps/api/src/**/*.ts', 'apps/worker/src/**/*.ts', 'packages/**/*.ts'],
    rules: {
      'no-restricted-syntax': [
        'error',
        {
          selector: 'MemberExpression[object.name="process"][property.name="env"]',
          message: 'Do not use process.env directly. Use Effect Config.* for environment variables.',
        },
        {
          selector: "MemberExpression[object.name='Context'][property.name='Tag']",
          message: 'Use Effect.Service instead of Context.Tag for business logic services.',
        },
      ],
    },
  },

  // === Import boundary enforcement (no-restricted-imports) ===
  // apps/web must not import other apps (relative OR workspace specifiers)
  {
    files: ['apps/web/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            { group: ['**/apps/api/**'], message: 'apps/web must not import apps/api. Use HTTP API client only.' },
            { group: ['**/apps/worker/**'], message: 'apps/web must not import apps/worker. Use SSE only.' },
            { group: ['@struct/api'], message: 'apps/web must not import @struct/api. Use HTTP API client only.' },
            { group: ['@struct/worker'], message: 'apps/web must not import @struct/worker. Use SSE only.' },
          ],
        },
      ],
    },
  },
  // apps/api must not import other apps
  {
    files: ['apps/api/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            { group: ['**/apps/web/**'], message: 'apps/api must not import apps/web.' },
            { group: ['**/apps/worker/**'], message: 'apps/api must not import apps/worker.' },
            { group: ['@struct/web'], message: 'apps/api must not import @struct/web.' },
            { group: ['@struct/worker'], message: 'apps/api must not import @struct/worker.' },
          ],
        },
      ],
    },
  },
  // apps/worker must not import other apps
  {
    files: ['apps/worker/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            { group: ['**/apps/api/**'], message: 'apps/worker must not import apps/api.' },
            { group: ['**/apps/web/**'], message: 'apps/worker must not import apps/web.' },
            { group: ['@struct/api'], message: 'apps/worker must not import @struct/api.' },
            { group: ['@struct/web'], message: 'apps/worker must not import @struct/web.' },
          ],
        },
      ],
    },
  },

  // Prevent packages from importing apps
  {
    files: ['packages/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            { group: ['**/apps/**'], message: 'Packages must not import apps. Dependency direction is downward only.' },
            { group: ['@struct/api', '@struct/web', '@struct/worker'], message: 'Packages must not import app packages. Dependency direction is downward only.' },
          ],
        },
      ],
    },
  },

  // Prevent domain from importing anything internal
  {
    files: ['packages/domain/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            { group: ['**/packages/**'], message: '@struct/domain is the leaf package; it must not import other internal packages.' },
            { group: ['**/apps/**'], message: '@struct/domain must not import apps.' },
            { group: ['@struct/persistence', '@struct/observability', '@struct/api', '@struct/web', '@struct/worker'], message: '@struct/domain is the leaf package; it must not import other internal packages.' },
          ],
        },
      ],
    },
  },

  // === Ignore patterns ===
  {
    ignores: [
      '**/node_modules/**',
      '**/dist/**',
      '**/.local/**',
      '**/bun.lock',
      '**/spikes/**',
      '**/*.d.ts',
      '**/*.test.ts',
    ],
  },
]
