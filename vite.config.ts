import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createObsidianPluginConfig } from './scripts/vite/createObsidianPluginConfig'
import type { Plugin } from 'vite'
import { copyLocaleAssetsPlugin } from './vite.copy-locales'
import { copyPdfjsAssetsPlugin } from './vite.copy-pdfjs'
import { copySignerAssetsPlugin } from './vite.copy-signer'
import { patchPdfViewerImportPlugin } from './vite.patch-pdf-viewer'
import {
  assertNoHostPdfjsGlobalsPlugin,
  renamePdfjsGlobalsPlugin,
} from './vite.rename-pdfjs-globals'

const packageDir = fileURLToPath(new URL('.', import.meta.url))
const corePdfjsDir = resolve(packageDir, 'vendor/core/pdfjs')
const localesSrcDir = resolve(packageDir, 'src/i18n/locales')
const signerSrcFile = resolve(packageDir, 'static/signer.js')
const outDir = resolve(packageDir, 'dist')
const mainJsPath = resolve(outDir, 'main.js')
const workerRawStub = resolve(packageDir, 'src/reader/pdfWorkerRawStub.ts')
const foxycapePdfViewer = resolve(packageDir, 'src/reader/foxycapePdfViewer.ts')
const pdfViewerPath = resolve(corePdfjsDir, 'legacy/web/pdf_viewer.mjs').replace(
  /\\/g,
  '/',
)

/**
 * Keep pdf.worker out of main.js:
 * - `?url` → empty (Obsidian app:// cannot load module workers)
 * - `?raw` → stub module (worker is copied to dist and read → Blob URL at runtime)
 *
 * Must run with `enforce: 'pre'` so Vite's asset/`?raw` pipeline never inlines the 1.3MB worker.
 */
const stubPdfWorkerImportsPlugin = (): Plugin => ({
  name: 'stub-pdf-worker-imports',
  enforce: 'pre',
  resolveId(id) {
    if (!id.includes('pdf.worker')) {
      return null
    }
    if (id.includes('?raw')) {
      return workerRawStub
    }
    if (id.includes('?url')) {
      return '\0pdf-worker-url-stub'
    }
    return null
  },
  load(id) {
    if (id === '\0pdf-worker-url-stub') {
      return 'export default ""'
    }
    return null
  },
})

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
  plugins: [
    stubPdfWorkerImportsPlugin(),
    isolatePdfViewerPlugin(),
    renamePdfjsGlobalsPlugin(),
    patchPdfViewerImportPlugin(corePdfjsDir),
    ...(base.plugins ?? []),
    copyPdfjsAssetsPlugin(outDir, corePdfjsDir),
    copyLocaleAssetsPlugin(outDir, localesSrcDir),
    copySignerAssetsPlugin(outDir, signerSrcFile),
    assertNoHostPdfjsGlobalsPlugin(mainJsPath),
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
