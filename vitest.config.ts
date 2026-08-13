import { resolve } from 'node:path'
import vue from '@vitejs/plugin-vue'
import { defineConfig } from 'vitest/config'
import { createFoxycapeCoreAliases, resolveFoxycapeCore } from './scripts/resolveFoxycapeCore'
import { buildPdfjsCmapsId } from './scripts/runtimeAssetsId.mjs'
import { stubEmbeddedRuntimeAssetsPlugin } from './vite.embed-runtime-assets'

const packageDir = resolve(__dirname)
const { pdfjsDir } = resolveFoxycapeCore(packageDir)
const pdfjsCmapsId = buildPdfjsCmapsId(pdfjsDir)

export default defineConfig({
  plugins: [vue(), stubEmbeddedRuntimeAssetsPlugin()],
  define: {
    __FOXYCAPE_PDFJS_CMAPS_ID__: JSON.stringify(pdfjsCmapsId),
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
