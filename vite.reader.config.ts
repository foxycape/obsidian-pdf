import { readFileSync, writeFileSync } from 'node:fs'
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
import { stubPdfWorkerRawPlugin } from './vite.stub-pdf-worker-raw'
import { pdfjsShimPlugin } from './vite.pdfjs-shim'
import { copyVaultFiles } from './vite.copy-to-vault'

const REQUIRED_READER_MARKERS = ['Dexie', 'AGFzbQE'] as const
const FORBIDDEN_READER_MARKERS = ['highlight.js', 'OpenAI', 'KaTeX'] as const
const READER_VERSION_FILE = '.foxycape-reader-version'

/** Dexie and hash-wasm stay in this bundle. KaTeX and highlight.js stay in markdown.js. */
const assertReaderBundlePlugins = (bundlePath: string): Plugin => ({
  name: 'assert-reader-bundle-contents',
  writeBundle() {
    const code = readFileSync(bundlePath, 'utf8')
    const missing = REQUIRED_READER_MARKERS.filter((marker) => !code.includes(marker))
    const found = FORBIDDEN_READER_MARKERS.filter((marker) => code.includes(marker))
    if (missing.length > 0 || found.length > 0) {
      const details = [
        missing.length > 0 ? `missing ${missing.join(', ')}` : '',
        found.length > 0 ? `still contains ${found.join(', ')}` : '',
      ]
        .filter((part) => part.length > 0)
        .join('; ')
      throw new Error(
        `[foxycape-pdf] reader-bundle.js ${details}. ` +
          'Dexie and hash-wasm belong in reader-bundle.zip. KaTeX and highlight.js belong in markdown.js.',
      )
    }
  },
})

const writeReaderVersionPlugin = (
  packageDir: string,
  outDir: string,
  vaultPluginDir: string,
): Plugin => ({
  name: 'write-reader-version',
  writeBundle() {
    const { version } = JSON.parse(readFileSync(resolve(packageDir, 'package.json'), 'utf8')) as {
      version: string
    }
    writeFileSync(resolve(outDir, READER_VERSION_FILE), `${version}\n`)
    if (!this.meta.watchMode) {
      return
    }
    copyVaultFiles(outDir, vaultPluginDir, ['reader-bundle.js', READER_VERSION_FILE])
  },
})

const packageDir = fileURLToPath(new URL('.', import.meta.url))
const { pdfjsDir: corePdfjsDir } = resolveFoxycapeCore(packageDir)
const outDir = resolve(packageDir, 'dist')
const readerBundlePath = resolve(outDir, 'reader-bundle.js')
const pdfjsCmapsId = buildPdfjsCmapsId(corePdfjsDir)
const localesId = buildLocalesId(resolve(packageDir, 'src/i18n/locales'))
const vaultPluginDir = readObsidianPluginDir(packageDir)
const pdfApiPath = resolve(corePdfjsDir, 'legacy/build/pdf.mjs')
const pdfViewerPath = resolve(corePdfjsDir, 'legacy/web/pdf_viewer.mjs')

const base = createObsidianPluginConfig({
  packageDir,
  outDirName: 'dist',
  entry: resolve(packageDir, 'src/pdf-entry.ts'),
  fileName: 'reader-bundle.js',
  cssFileName: 'reader-bundle.css',
})

export default {
  ...base,
  define: {
    ...base.define,
    __FOXYCAPE_PDFJS_CMAPS_ID__: JSON.stringify(pdfjsCmapsId),
    __FOXYCAPE_LOCALES_ID__: JSON.stringify(localesId),
  },
  plugins: [
    stubPdfWorkerRawPlugin(),
    pdfjsShimPlugin(pdfApiPath, pdfViewerPath),
    ...(base.plugins ?? []),
    assertNoHostPdfjsGlobalsPlugin(readerBundlePath),
    assertNoDynamicScriptElementsPlugin(readerBundlePath),
    assertReaderBundlePlugins(readerBundlePath),
    writeReaderVersionPlugin(packageDir, outDir, vaultPluginDir),
  ],
  css: {
    preprocessorOptions: {
      scss: {
        api: 'modern-compiler',
      },
    },
  },
}
