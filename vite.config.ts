import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createObsidianPluginConfig } from './scripts/vite/createObsidianPluginConfig'
import { resolveFoxycapeCore } from './scripts/resolveFoxycapeCore'
import type { Plugin } from 'vite'
import { copyPdfjsAssetsPlugin } from './vite.copy-pdfjs'
import { copySignerAssetsPlugin } from './vite.copy-signer'
import { patchPdfViewerImportPlugin } from './vite.patch-pdf-viewer'
import {
  assertNoHostPdfjsGlobalsPlugin,
  renamePdfjsGlobalsPlugin,
} from './vite.rename-pdfjs-globals'
import { stubPdfWorkerRawPlugin } from './vite.stub-pdf-worker-raw'
import { embedRuntimeAssetsPlugin } from './vite.embed-runtime-assets'
import { buildPdfjsCmapsId } from './scripts/runtimeAssetsId.mjs'
import {
  assertNoDynamicScriptElementsPlugin,
  stubVendorWebStoragePlugin,
} from './vite.strip-localforage'

const packageDir = fileURLToPath(new URL('.', import.meta.url))
const { pdfjsDir: corePdfjsDir } = resolveFoxycapeCore(packageDir)
const outDir = resolve(packageDir, 'dist')
const mainJsPath = resolve(outDir, 'main.js')
const signerSrcFile = resolve(packageDir, 'static/signer.js')
const pdfjsCmapsId = buildPdfjsCmapsId(corePdfjsDir)
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

const base = createObsidianPluginConfig({
  packageDir,
  outDirName: 'dist',
})

export default {
  ...base,
  define: {
    ...base.define,
    __FOXYCAPE_PDFJS_CMAPS_ID__: JSON.stringify(pdfjsCmapsId),
  },
  plugins: [
    embedRuntimeAssetsPlugin({ corePdfjsDir, signerPath: signerSrcFile }),
    stubVendorWebStoragePlugin(),
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
    copySignerAssetsPlugin(outDir, signerSrcFile),
    assertNoHostPdfjsGlobalsPlugin(mainJsPath),
    assertNoDynamicScriptElementsPlugin(mainJsPath),
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
    rollupOptions: {
      ...base.build?.rollupOptions,
      output: {
        ...base.build?.rollupOptions?.output,
        assetFileNames: (assetInfo: { name?: string }) => {
          if (assetInfo.name?.endsWith('.css')) {
            return 'styles.css'
          }
          return 'assets/[name][extname]'
        },
      },
    },
    commonjsOptions: {
      include: [/pdfjs/, /node_modules/],
      transformMixedEsModules: true,
    },
  },
}
