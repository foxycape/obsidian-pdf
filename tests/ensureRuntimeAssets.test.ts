import { zipSync } from 'fflate'
import { describe, expect, it } from 'vitest'
import type { Plugin } from 'obsidian'
import {
  LOCALES_ID,
  LOCALES_VERSION_MARKER,
  MARKDOWN_LIB_FILE,
  MARKDOWN_VERSION_MARKER,
  PDF_LIB_VERSION_MARKER,
  READER_BUNDLE_FILE,
  READER_VERSION_MARKER,
  RUNTIME_CMAPS_ID,
  RUNTIME_CMAPS_VERSION_MARKER,
  WORKER_VERSION_MARKER,
} from '@/assets/constants'
import {
  ensureLocalesPack,
  ensurePdfjsPack,
  hasLocalesPack,
  hasMarkdownPack,
  hasPdfLib,
  hasReaderBundle,
  hasRemoteRuntimeAssets,
  hasWorkerRuntime,
  pdfjsPackNeedsDownload,
  readerPackNeedsDownload,
} from '@/assets/ensureRuntimeAssets'
import {
  decodeBase64ToBytes,
  extractZipToPluginDir,
  isLocalesZipEntryName,
  isPdfjsZipEntryName,
  isReaderZipEntryName,
  isRemoteZipEntryName,
} from '@/assets/runtimeAssetZip'

const createVault = () => {
  const files = new Map<string, string | ArrayBuffer>()
  const dirs = new Set<string>()
  const adapter = {
    exists: async (path: string) => files.has(path) || dirs.has(path),
    mkdir: async (path: string) => {
      dirs.add(path)
    },
    read: async (path: string) => {
      const value = files.get(path)
      if (typeof value !== 'string') {
        throw new Error(`missing ${path}`)
      }
      return value
    },
    write: async (path: string, data: string) => {
      files.set(path, data)
    },
    writeBinary: async (path: string, data: ArrayBuffer) => {
      files.set(path, data)
    },
  }
  const plugin = {
    manifest: { dir: 'plugins/foxycape-pdf', version: '3.4.2' },
    app: { vault: { adapter } },
  } as unknown as Plugin
  return { files, dirs, plugin }
}

const bytesOf = (text: string) => new TextEncoder().encode(text)

describe('runtime asset zip helpers', () => {
  it('only allows the PDF.js library and worker in the pdfjs pack', () => {
    expect(isPdfjsZipEntryName('pdf-lib.js')).toBe(true)
    expect(isPdfjsZipEntryName('pdf.js')).toBe(false)
    expect(isPdfjsZipEntryName('static/signer.js')).toBe(false)
    expect(isPdfjsZipEntryName('pdfjs/pdf.worker.min.mjs')).toBe(true)
    expect(isLocalesZipEntryName('locales/en.json')).toBe(true)
    expect(isLocalesZipEntryName('locales/zh-TW.json')).toBe(true)
    expect(isPdfjsZipEntryName('locales/en.json')).toBe(false)
    expect(isLocalesZipEntryName('locales/en.js')).toBe(false)
    expect(isLocalesZipEntryName('locales/../en.json')).toBe(false)
    expect(isPdfjsZipEntryName('pdfjs/cmaps/Adobe-GB1-0.bcmap')).toBe(false)
    expect(isRemoteZipEntryName('pdfjs/cmaps/Adobe-GB1-0.bcmap')).toBe(true)
    expect(isRemoteZipEntryName('pdfjs/standard_fonts/FoxitSerif.pfb')).toBe(true)
    expect(isRemoteZipEntryName('pdfjs/wasm/jbig2.wasm')).toBe(true)
    expect(isRemoteZipEntryName('pdfjs/iccs/CGATS001Compat-v2-micro.icc')).toBe(true)
    expect(isPdfjsZipEntryName('pdfjs/iccs/CGATS001Compat-v2-micro.icc')).toBe(false)
    expect(isRemoteZipEntryName('katex/fonts/KaTeX_Main-Regular.woff2')).toBe(false)
    expect(isReaderZipEntryName('katex/katex.css')).toBe(true)
    expect(isReaderZipEntryName('katex/fonts/KaTeX_Main-Regular.woff2')).toBe(false)
    expect(isReaderZipEntryName('katex/fonts/KaTeX_Main-Regular.woff')).toBe(false)
    expect(isReaderZipEntryName('styles.css')).toBe(false)
    expect(isReaderZipEntryName('katex/other.css')).toBe(false)
    expect(isPdfjsZipEntryName('katex/katex.css')).toBe(false)
    expect(isRemoteZipEntryName('pdfjs/pdf.worker.min.mjs')).toBe(false)
    expect(isRemoteZipEntryName('../secret.txt')).toBe(false)
    expect(isPdfjsZipEntryName('pdfjs/cmaps/')).toBe(false)
    expect(isPdfjsZipEntryName('../pdf-lib.js')).toBe(false)
    expect(isReaderZipEntryName('reader-bundle.js')).toBe(true)
    expect(isReaderZipEntryName('pdf-lib.js')).toBe(false)
    expect(isReaderZipEntryName('reader/reader-bundle.js')).toBe(false)
    expect(isReaderZipEntryName('../reader-bundle.js')).toBe(false)
  })

  it('decodes base64 into the original bytes', () => {
    const payload = bytesOf('hello-assets')
    expect(Array.from(decodeBase64ToBytes(btoa('hello-assets')))).toEqual(
      Array.from(payload),
    )
  })

  it('extracts allowed zip entries without requiring a version marker', async () => {
    const { files, plugin } = createVault()
    const zipped = zipSync({
      'pdf-lib.js': bytesOf('bundle'),
      'pdfjs/pdf.worker.min.mjs': bytesOf('worker'),
      'static/signer.js': bytesOf('signer'),
      'locales/en.json': bytesOf('{"ok":"yes"}'),
      'locales/../secret.json': bytesOf('nope'),
      'pdfjs/cmaps/ignored.bcmap': bytesOf('nope'),
    })

    await extractZipToPluginDir(plugin, zipped, {
      isAllowedEntry: isPdfjsZipEntryName,
      zipLabel: 'pdfjs',
    })

    expect(files.has('plugins/foxycape-pdf/pdf-lib.js')).toBe(true)
    expect(files.has('plugins/foxycape-pdf/pdfjs/pdf.worker.min.mjs')).toBe(true)
    expect(files.has('plugins/foxycape-pdf/static/signer.js')).toBe(false)
    expect(files.has('plugins/foxycape-pdf/locales/en.json')).toBe(false)
    expect(files.has('plugins/foxycape-pdf/locales/../secret.json')).toBe(false)
    expect(files.has('plugins/foxycape-pdf/pdfjs/cmaps/ignored.bcmap')).toBe(false)
  })
})

describe('runtime asset install detection', () => {
  it('treats the worker as installed only when the pdf.js version matches', async () => {
    const { files, plugin } = createVault()
    const runtimeId = 'pdfjs-test'
    files.set('plugins/foxycape-pdf/pdfjs/pdf.worker.min.mjs', 'worker')
    expect(await hasWorkerRuntime(plugin, runtimeId)).toBe(false)
    files.set(`plugins/foxycape-pdf/${WORKER_VERSION_MARKER}`, `${runtimeId}\n`)
    expect(await hasWorkerRuntime(plugin, runtimeId)).toBe(true)
    expect(await hasRemoteRuntimeAssets(plugin)).toBe(false)
  })

  it('skips the pdfjs pack when the library and worker match the pdf.js version', async () => {
    const { files, plugin } = createVault()
    expect(await pdfjsPackNeedsDownload(plugin)).toBe(true)

    files.set('plugins/foxycape-pdf/pdf-lib.js', 'bundle')
    files.set(`plugins/foxycape-pdf/${PDF_LIB_VERSION_MARKER}`, `${RUNTIME_CMAPS_ID}\n`)
    files.set('plugins/foxycape-pdf/pdfjs/pdf.worker.min.mjs', 'worker')
    files.set(`plugins/foxycape-pdf/${WORKER_VERSION_MARKER}`, `${RUNTIME_CMAPS_ID}\n`)

    expect(await hasPdfLib(plugin)).toBe(true)
    expect(await pdfjsPackNeedsDownload(plugin)).toBe(false)
    await ensurePdfjsPack(plugin)

    files.delete('plugins/foxycape-pdf/locales/en.json')
    expect(await pdfjsPackNeedsDownload(plugin)).toBe(false)

    files.set(`plugins/foxycape-pdf/${PDF_LIB_VERSION_MARKER}`, 'plugin-9.9.9\n')
    expect(await pdfjsPackNeedsDownload(plugin)).toBe(true)
  })

  it('downloads reader-bundle.zip only when the plugin version marker differs', async () => {
    const { files, plugin } = createVault()
    expect(await readerPackNeedsDownload(plugin)).toBe(true)
    files.set(`plugins/foxycape-pdf/${READER_BUNDLE_FILE}`, 'reader')
    expect(await hasReaderBundle(plugin)).toBe(false)
    files.set(`plugins/foxycape-pdf/${READER_VERSION_MARKER}`, '3.4.2\n')
    expect(await hasReaderBundle(plugin)).toBe(false)
    files.set('plugins/foxycape-pdf/katex/katex.css', 'katex')
    expect(await hasReaderBundle(plugin)).toBe(true)
    expect(await readerPackNeedsDownload(plugin)).toBe(false)
    files.set(`plugins/foxycape-pdf/${READER_VERSION_MARKER}`, '9.9.9\n')
    expect(await readerPackNeedsDownload(plugin)).toBe(true)
  })

  it('downloads locales.zip only when the language content id changes', async () => {
    const { files, plugin } = createVault()
    expect(await hasLocalesPack(plugin)).toBe(false)
    files.set('plugins/foxycape-pdf/locales/en.json', '{}')
    files.set(`plugins/foxycape-pdf/${LOCALES_VERSION_MARKER}`, `${LOCALES_ID}\n`)
    expect(await hasLocalesPack(plugin)).toBe(true)
    await ensureLocalesPack(plugin)
    files.set(`plugins/foxycape-pdf/${LOCALES_VERSION_MARKER}`, 'locales-other\n')
    expect(await hasLocalesPack(plugin)).toBe(false)
  })

  it('treats markdown.js as installed only when the content id matches', async () => {
    const { files, plugin } = createVault()
    const markdownId = 'markdown-abc123abc123'
    expect(await hasMarkdownPack(plugin, markdownId)).toBe(false)
    files.set(`plugins/foxycape-pdf/${MARKDOWN_LIB_FILE}`, 'runtime')
    expect(await hasMarkdownPack(plugin, markdownId)).toBe(false)
    files.set(`plugins/foxycape-pdf/${MARKDOWN_VERSION_MARKER}`, `${markdownId}\n`)
    expect(await hasMarkdownPack(plugin, markdownId)).toBe(true)
    files.set(`plugins/foxycape-pdf/${MARKDOWN_VERSION_MARKER}`, 'markdown-other\n')
    expect(await hasMarkdownPack(plugin, markdownId)).toBe(false)
  })

  it('requires the pdf.js cmaps marker to match before skipping the remote pack', async () => {
    const { files, dirs, plugin } = createVault()
    dirs.add('plugins/foxycape-pdf/pdfjs/cmaps')
    dirs.add('plugins/foxycape-pdf/pdfjs/standard_fonts')
    dirs.add('plugins/foxycape-pdf/pdfjs/wasm')
    dirs.add('plugins/foxycape-pdf/pdfjs/iccs')
    files.set(
      `plugins/foxycape-pdf/${RUNTIME_CMAPS_VERSION_MARKER}`,
      `${RUNTIME_CMAPS_ID}\n`,
    )

    expect(await hasRemoteRuntimeAssets(plugin)).toBe(true)

    files.set(
      `plugins/foxycape-pdf/${RUNTIME_CMAPS_VERSION_MARKER}`,
      'pdfjs-0.0.0\n',
    )
    expect(await hasRemoteRuntimeAssets(plugin)).toBe(false)
  })
})
