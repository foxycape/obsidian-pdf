import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { Plugin } from 'vite'
import { createObsidianPluginConfig } from './scripts/vite/createObsidianPluginConfig'
import { resolveFoxycapeCore } from './scripts/resolveFoxycapeCore'
import { buildPdfjsCmapsId } from './scripts/runtimeAssetsId.mjs'
import { buildLocalesId } from './scripts/localesId.mjs'
import { readObsidianPluginDir } from './scripts/readObsidianPluginDir.mjs'
import { assertNoHostPdfjsGlobalsPlugin } from './vite.rename-pdfjs-globals'
import { assertNoDynamicScriptElementsPlugin } from './vite.strip-localforage'
import { copyToVaultPlugin } from './vite.copy-to-vault'
import { copyLocalesPlugin } from './vite.copy-locales'
import { mergePdfBundleCssPlugin } from './vite.merge-pdf-css'
import { stubPdfWorkerRawPlugin } from './vite.stub-pdf-worker-raw'
import { pdfjsShimPlugin } from './vite.pdfjs-shim'

const FORBIDDEN_MAIN_MARKERS = ['Dexie', 'AGFzbQE', 'photoswipe', 'AI runtime is not ready'] as const

/** Reader code, Dexie, and hash-wasm belong in reader-bundle.zip, not main.js. */
const assertMainJsIsSlimPlugin = (bundlePath: string): Plugin => ({
  name: 'assert-main-js-is-slim',
  writeBundle() {
    if (!existsSync(bundlePath)) {
      return
    }
    const code = readFileSync(bundlePath, 'utf8')
    const found = FORBIDDEN_MAIN_MARKERS.filter((marker) => code.includes(marker))
    if (found.length > 0) {
      throw new Error(
        `[foxycape-pdf] main.js still contains ${found.join(', ')}. ` +
          'Those belong in reader-bundle.js inside reader-bundle.zip.',
      )
    }
  },
})

const packageDir = fileURLToPath(new URL('.', import.meta.url))
const { pdfjsDir: corePdfjsDir } = resolveFoxycapeCore(packageDir)
const outDir = resolve(packageDir, 'dist')
const mainJsPath = resolve(outDir, 'main.js')
const pdfjsCmapsId = buildPdfjsCmapsId(corePdfjsDir)
const localesId = buildLocalesId(resolve(packageDir, 'src/i18n/locales'))
const vaultPluginDir = readObsidianPluginDir(packageDir)
const markdownIdPath = resolve(outDir, '.foxycape-markdown-id')
const pdfApiPath = resolve(corePdfjsDir, 'legacy/build/pdf.mjs')
const pdfViewerPath = resolve(corePdfjsDir, 'legacy/web/pdf_viewer.mjs')

/** Bake the markdown.js content id. The file is produced by vite.markdown.config.ts. */
const markdownIdPlugin = (): Plugin => ({
  name: 'foxycape-markdown-id',
  buildStart() {
    this.addWatchFile(markdownIdPath)
  },
  transform(_code, id) {
    if (!id.replace(/\\/g, '/').includes('/src/assets/markdownPackId.ts')) {
      return null
    }
    if (!existsSync(markdownIdPath)) {
      this.error(
        `Missing ${markdownIdPath}. Run vite build --config vite.markdown.config.ts first.`,
      )
    }
    const markdownId = readFileSync(markdownIdPath, 'utf8').trim()
    if (!markdownId.startsWith('markdown-')) {
      this.error(`Unexpected markdown id in ${markdownIdPath}: ${markdownId}`)
    }
    return `export const MARKDOWN_ID = ${JSON.stringify(markdownId)}\n`
  },
})

const base = createObsidianPluginConfig({
  packageDir,
  outDirName: 'dist',
})

export default {
  ...base,
  define: {
    ...base.define,
    __FOXYCAPE_PDFJS_CMAPS_ID__: JSON.stringify(pdfjsCmapsId),
    __FOXYCAPE_LOCALES_ID__: JSON.stringify(localesId),
  },
  plugins: [
    markdownIdPlugin(),
    stubPdfWorkerRawPlugin(),
    pdfjsShimPlugin(pdfApiPath, pdfViewerPath),
    ...(base.plugins ?? []),
    assertNoHostPdfjsGlobalsPlugin(mainJsPath),
    assertNoDynamicScriptElementsPlugin(mainJsPath),
    assertMainJsIsSlimPlugin(mainJsPath),
    mergePdfBundleCssPlugin(outDir),
    copyLocalesPlugin(packageDir, outDir),
    copyToVaultPlugin(outDir, vaultPluginDir),
  ],
  css: {
    preprocessorOptions: {
      scss: {
        api: 'modern-compiler',
      },
    },
  },
}
