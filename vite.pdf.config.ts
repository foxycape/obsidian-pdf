import { writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { Plugin } from 'vite'
import { createObsidianPluginConfig } from './scripts/vite/createObsidianPluginConfig'
import { resolveFoxycapeCore } from './scripts/resolveFoxycapeCore'
import { buildPdfjsCmapsId } from './scripts/runtimeAssetsId.mjs'
import { readObsidianPluginDir } from './scripts/readObsidianPluginDir.mjs'
import { copyPdfjsAssetsPlugin } from './vite.copy-pdfjs'
import { patchPdfViewerImportPlugin } from './vite.patch-pdf-viewer'
import {
  assertNoHostPdfjsGlobalsPlugin,
  renamePdfjsGlobalsPlugin,
} from './vite.rename-pdfjs-globals'
import { stubPdfWorkerRawPlugin } from './vite.stub-pdf-worker-raw'
import { assertNoDynamicScriptElementsPlugin } from './vite.strip-localforage'
import { copyToVaultPlugin } from './vite.copy-to-vault'
import { copyLocalesPlugin } from './vite.copy-locales'
import { mergePdfBundleCssPlugin } from './vite.merge-pdf-css'

const packageDir = fileURLToPath(new URL('.', import.meta.url))
const { pdfjsDir: corePdfjsDir } = resolveFoxycapeCore(packageDir)
const outDir = resolve(packageDir, 'dist')
const pdfLibPath = resolve(outDir, 'pdf-lib.js')
const pdfjsCmapsId = buildPdfjsCmapsId(corePdfjsDir)
const vaultPluginDir = readObsidianPluginDir(packageDir)
const foxycapePdfViewer = resolve(packageDir, 'src/reader/foxycapePdfViewer.ts')
const pdfViewerPath = resolve(corePdfjsDir, 'legacy/web/pdf_viewer.mjs').replace(
  /\\/g,
  '/',
)
/**
 * Redirect imports of core's pdf_viewer.mjs to foxycapePdfViewer, except when
 * foxycapePdfViewer itself loads the real viewer (avoids alias recursion).
 */
const isolatePdfViewerPlugin = (): Plugin => ({
  name: 'isolate-foxycape-pdf-viewer',
  enforce: 'pre',
  async resolveId(id, importer, options) {
    if (!importer || importer.replace(/\\/g, '/').includes('/foxycapePdfViewer.ts')) {
      return null
    }

    const resolved = await this.resolve(id, importer, { ...options, skipSelf: true })
    if (!resolved?.id) {
      return null
    }

    const normalized = resolved.id.split('?')[0].replace(/\\/g, '/')
    if (normalized === pdfViewerPath || normalized.endsWith('/legacy/web/pdf_viewer.mjs')) {
      return foxycapePdfViewer
    }
    return null
  },
})

const writePdfLibVersionPlugin = (): Plugin => ({
  name: 'write-pdf-lib-version',
  writeBundle() {
    writeFileSync(join(outDir, '.foxycape-pdf-lib-version'), `${pdfjsCmapsId}\n`)
  },
})

const base = createObsidianPluginConfig({
  packageDir,
  outDirName: 'dist',
  entry: resolve(packageDir, 'src/pdf-lib-entry.ts'),
  fileName: 'pdf-lib.js',
  cssFileName: 'pdf-bundle.css',
  tailwind: false,
})

export default {
  ...base,
  define: {
    ...base.define,
    __FOXYCAPE_PDFJS_CMAPS_ID__: JSON.stringify(pdfjsCmapsId),
  },
  plugins: [
    stubPdfWorkerRawPlugin(),
    isolatePdfViewerPlugin(),
    renamePdfjsGlobalsPlugin(),
    patchPdfViewerImportPlugin(corePdfjsDir),
    ...(base.plugins ?? []),
    copyPdfjsAssetsPlugin({
      outDir,
      corePdfjsDir,
      cmapsId: pdfjsCmapsId,
    }),
    writePdfLibVersionPlugin(),
    assertNoHostPdfjsGlobalsPlugin(pdfLibPath),
    assertNoDynamicScriptElementsPlugin(pdfLibPath),
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
  build: {
    ...base.build,
    commonjsOptions: {
      include: [/pdfjs/, /node_modules/],
      transformMixedEsModules: true,
    },
  },
}
