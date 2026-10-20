import { readFileSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { Plugin } from 'vite'
import { createObsidianPluginConfig } from './scripts/vite/createObsidianPluginConfig'
import { resolveFoxycapeCore } from './scripts/resolveFoxycapeCore'
import { buildPdfjsCmapsId, buildRuntimeAssetsId } from './scripts/runtimeAssetsId.mjs'
import { readObsidianPluginDir } from './scripts/readObsidianPluginDir.mjs'
import { copyPdfjsAssetsPlugin } from './vite.copy-pdfjs'
import { copySignerAssetsPlugin } from './vite.copy-signer'
import { patchPdfViewerImportPlugin } from './vite.patch-pdf-viewer'
import {
  assertNoHostPdfjsGlobalsPlugin,
  renamePdfjsGlobalsPlugin,
} from './vite.rename-pdfjs-globals'
import { stubPdfWorkerRawPlugin } from './vite.stub-pdf-worker-raw'
import { assertNoDynamicScriptElementsPlugin } from './vite.strip-localforage'
import { copyToVaultPlugin } from './vite.copy-to-vault'
import { copyLocalesPlugin } from './vite.copy-locales'
import { katexFontsPlugin } from './vite.katex-fonts'
import { mergePdfBundleCssPlugin } from './vite.merge-pdf-css'

const packageDir = fileURLToPath(new URL('.', import.meta.url))
const { pdfjsDir: corePdfjsDir } = resolveFoxycapeCore(packageDir)
const outDir = resolve(packageDir, 'dist')
const pdfJsPath = resolve(outDir, 'pdf.js')
const signerSrcFile = resolve(packageDir, 'static/signer.js')
const pdfjsCmapsId = buildPdfjsCmapsId(corePdfjsDir)
const runtimeId = buildRuntimeAssetsId(corePdfjsDir, signerSrcFile)
const vaultPluginDir = readObsidianPluginDir(packageDir)
const foxycapePdfViewer = resolve(packageDir, 'src/reader/foxycapePdfViewer.ts')
const pdfViewerPath = resolve(corePdfjsDir, 'legacy/web/pdf_viewer.mjs').replace(
  /\\/g,
  '/',
)
const pluginVersion = (
  JSON.parse(readFileSync(resolve(packageDir, 'package.json'), 'utf8')) as { version: string }
).version

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

const writePdfBundleVersionPlugin = (): Plugin => ({
  name: 'write-pdf-bundle-version',
  writeBundle() {
    writeFileSync(join(outDir, '.foxycape-pdf-bundle-version'), `${pluginVersion}\n`)
  },
})

const base = createObsidianPluginConfig({
  packageDir,
  outDirName: 'dist',
  entry: resolve(packageDir, 'src/pdf-entry.ts'),
  fileName: 'pdf.js',
  cssFileName: 'pdf-bundle.css',
  tailwind: false,
})

export default {
  ...base,
  define: {
    ...base.define,
    __FOXYCAPE_PDFJS_CMAPS_ID__: JSON.stringify(pdfjsCmapsId),
    __FOXYCAPE_RUNTIME_ID__: JSON.stringify(runtimeId),
  },
  plugins: [
    stubPdfWorkerRawPlugin(),
    isolatePdfViewerPlugin(),
    renamePdfjsGlobalsPlugin(),
    patchPdfViewerImportPlugin(corePdfjsDir),
    ...(base.plugins ?? []),
    katexFontsPlugin({ packageDir, outDir }),
    copyPdfjsAssetsPlugin({
      outDir,
      corePdfjsDir,
      cmapsId: pdfjsCmapsId,
      runtimeId,
    }),
    copySignerAssetsPlugin(outDir, signerSrcFile, runtimeId),
    writePdfBundleVersionPlugin(),
    assertNoHostPdfjsGlobalsPlugin(pdfJsPath),
    assertNoDynamicScriptElementsPlugin(pdfJsPath),
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
