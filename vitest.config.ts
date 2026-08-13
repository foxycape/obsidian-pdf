import { resolve } from 'node:path'
import vue from '@vitejs/plugin-vue'
import { defineConfig } from 'vitest/config'
import { createFoxycapeCoreAliases, resolveFoxycapeCore } from './scripts/resolveFoxycapeCore'
import { buildRuntimeAssetsId } from './scripts/runtimeAssetsId.mjs'

const packageDir = resolve(__dirname)
const { pdfjsDir } = resolveFoxycapeCore(packageDir)
const runtimeAssetsId = buildRuntimeAssetsId(
  pdfjsDir,
  resolve(packageDir, 'static/signer.js'),
)

export default defineConfig({
  plugins: [vue()],
  define: {
    __FOXYCAPE_RUNTIME_ASSETS_ID__: JSON.stringify(runtimeAssetsId),
  },
  resolve: {
    alias: [
      ...createFoxycapeCoreAliases(packageDir),
      { find: /^@\//, replacement: `${resolve(packageDir, 'src').replace(/\\/g, '/')}/` },
      {
        find: 'obsidian',
        replacement: resolve(packageDir, 'scripts/test/mocks/obsidian.ts'),
      },
    ],
  },
  test: {
    environment: 'jsdom',
    include: ['tests/**/*.{test,spec}.ts'],
    setupFiles: [resolve(packageDir, 'scripts/test/setupObsidianDom.ts')],
  },
})
