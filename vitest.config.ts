import { resolve } from 'node:path'
import vue from '@vitejs/plugin-vue'
import { defineConfig } from 'vitest/config'
import { createFoxycapeCoreAliases, resolveFoxycapeCore } from './scripts/resolveFoxycapeCore'
import { buildPdfjsCmapsId, buildRuntimeAssetsId } from './scripts/runtimeAssetsId.mjs'

const packageDir = resolve(__dirname)
const { pdfjsDir } = resolveFoxycapeCore(packageDir)
const pdfjsCmapsId = buildPdfjsCmapsId(pdfjsDir)
const runtimeId = buildRuntimeAssetsId(pdfjsDir, resolve(packageDir, 'static/signer.js'))

export default defineConfig({
  plugins: [vue()],
  define: {
    __FOXYCAPE_PDFJS_CMAPS_ID__: JSON.stringify(pdfjsCmapsId),
    __FOXYCAPE_RUNTIME_ID__: JSON.stringify(runtimeId),
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
