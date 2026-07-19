import { transformAsync } from '@babel/core'
import presetTypeScript from '@babel/preset-typescript'
import presetSolid from 'babel-preset-solid'

Bun.plugin({
  name: 'solid-test-transform',
  setup(builder) {
    builder.onLoad({ filter: /apps\/web\/src\/.*\.tsx$/ }, async ({ path }) => {
      const source = await Bun.file(path).text()
      const transformed = await transformAsync(source, {
        filename: path,
        sourceMaps: 'inline',
        presets: [
          [presetSolid, { generate: 'ssr', hydratable: false }],
          [presetTypeScript, { allExtensions: true, isTSX: true }],
        ],
      })
      return {
        contents: transformed?.code ?? source,
        loader: 'js',
      }
    })
  },
})
