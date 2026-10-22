import { resolve } from 'node:path'
import vue from '@vitejs/plugin-vue'
import { defineConfig } from 'vitest/config'
import { createFoxycapeCoreAliases, resolveFoxycapeCore } from './scripts/resolveFoxycapeCore'
import { buildLocalesId } from './scripts/localesId.mjs'
import { buildPdfjsCmapsId } from './scripts/runtimeAssetsId.mjs'

const packageDir = resolve(__dirname)
const { pdfjsDir } = resolveFoxycapeCore(packageDir)
const pdfjsCmapsId = buildPdfjsCmapsId(pdfjsDir)
const localesId = buildLocalesId(resolve(packageDir, 'src/i18n/locales'))

export default defineConfig({
  plugins: [vue()],
  define: {
    __FOXYCAPE_PDFJS_CMAPS_ID__: JSON.stringify(pdfjsCmapsId),
    __FOXYCAPE_LOCALES_ID__: JSON.stringify(localesId),
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
