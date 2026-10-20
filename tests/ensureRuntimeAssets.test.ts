import { zipSync } from 'fflate'
import { describe, expect, it } from 'vitest'
import type { Plugin } from 'obsidian'
import {
  PDF_BUNDLE_VERSION_MARKER,
  RUNTIME_CMAPS_ID,
  RUNTIME_CMAPS_VERSION_MARKER,
  RUNTIME_ID,
  SIGNER_VERSION_MARKER,
  WORKER_VERSION_MARKER,
} from '@/assets/constants'
import {
  ensurePdfjsPack,
  hasPdfBundle,
  hasRemoteRuntimeAssets,
  hasSignerRuntime,
  hasWorkerRuntime,
  pdfjsPackNeedsDownload,
} from '@/assets/ensureRuntimeAssets'
import {
  decodeBase64ToBytes,
  extractZipToPluginDir,
  isPdfjsZipEntryName,
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
  it('only allows the reader, worker, signer, and locale json in the pdfjs pack', () => {
    expect(isPdfjsZipEntryName('pdf.js')).toBe(true)
    expect(isPdfjsZipEntryName('static/signer.js')).toBe(true)
    expect(isPdfjsZipEntryName('pdfjs/pdf.worker.min.mjs')).toBe(true)
    expect(isPdfjsZipEntryName('locales/en.json')).toBe(true)
    expect(isPdfjsZipEntryName('locales/zh-TW.json')).toBe(true)
    expect(isPdfjsZipEntryName('locales/en.js')).toBe(false)
    expect(isPdfjsZipEntryName('locales/../en.json')).toBe(false)
    expect(isPdfjsZipEntryName('pdfjs/cmaps/Adobe-GB1-0.bcmap')).toBe(false)
    expect(isRemoteZipEntryName('pdfjs/cmaps/Adobe-GB1-0.bcmap')).toBe(true)
    expect(isRemoteZipEntryName('pdfjs/standard_fonts/FoxitSerif.pfb')).toBe(true)
    expect(isRemoteZipEntryName('pdfjs/wasm/jbig2.wasm')).toBe(true)
    expect(isRemoteZipEntryName('pdfjs/iccs/CGATS001Compat-v2-micro.icc')).toBe(true)
    expect(isPdfjsZipEntryName('pdfjs/iccs/CGATS001Compat-v2-micro.icc')).toBe(false)
    expect(isRemoteZipEntryName('katex/fonts/KaTeX_Main-Regular.woff2')).toBe(true)
    expect(isPdfjsZipEntryName('katex/fonts/KaTeX_Main-Regular.woff2')).toBe(false)
    expect(isRemoteZipEntryName('pdfjs/pdf.worker.min.mjs')).toBe(false)
    expect(isRemoteZipEntryName('../secret.txt')).toBe(false)
    expect(isPdfjsZipEntryName('pdfjs/cmaps/')).toBe(false)
    expect(isPdfjsZipEntryName('../pdf.js')).toBe(false)
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
      'pdf.js': bytesOf('bundle'),
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

    expect(files.has('plugins/foxycape-pdf/pdf.js')).toBe(true)
    expect(files.has('plugins/foxycape-pdf/pdfjs/pdf.worker.min.mjs')).toBe(true)
    expect(files.has('plugins/foxycape-pdf/static/signer.js')).toBe(true)
    expect(files.has('plugins/foxycape-pdf/locales/en.json')).toBe(true)
    expect(files.has('plugins/foxycape-pdf/locales/../secret.json')).toBe(false)
    expect(files.has('plugins/foxycape-pdf/pdfjs/cmaps/ignored.bcmap')).toBe(false)
  })
})

describe('runtime asset install detection', () => {
  it('treats signer as installed only when the runtime id matches', async () => {
    const { files, plugin } = createVault()
    const runtimeId = 'pdfjs-test+signer-abcd1234'
    expect(await hasSignerRuntime(plugin, runtimeId)).toBe(false)

    files.set('plugins/foxycape-pdf/static/signer.js', 'signer')
    files.set(`plugins/foxycape-pdf/${SIGNER_VERSION_MARKER}`, `${runtimeId}\n`)
    expect(await hasSignerRuntime(plugin, runtimeId)).toBe(true)
    expect(await hasSignerRuntime(plugin, 'pdfjs-test+signer-other')).toBe(false)
    expect(await hasRemoteRuntimeAssets(plugin)).toBe(false)
  })

  it('treats the worker as installed only when the runtime id matches', async () => {
    const { files, plugin } = createVault()
    const runtimeId = 'pdfjs-test+signer-abcd1234'
    files.set('plugins/foxycape-pdf/pdfjs/pdf.worker.min.mjs', 'worker')
    expect(await hasWorkerRuntime(plugin, runtimeId)).toBe(false)
    files.set(`plugins/foxycape-pdf/${WORKER_VERSION_MARKER}`, `${runtimeId}\n`)
    expect(await hasWorkerRuntime(plugin, runtimeId)).toBe(true)
  })

  it('skips the pdfjs pack when every file marker matches', async () => {
    const { files, plugin } = createVault()
    expect(await pdfjsPackNeedsDownload(plugin)).toBe(true)

    files.set('plugins/foxycape-pdf/pdf.js', 'bundle')
    files.set(`plugins/foxycape-pdf/${PDF_BUNDLE_VERSION_MARKER}`, '3.4.2\n')
    files.set('plugins/foxycape-pdf/pdfjs/pdf.worker.min.mjs', 'worker')
    files.set(`plugins/foxycape-pdf/${WORKER_VERSION_MARKER}`, `${RUNTIME_ID}\n`)
    files.set('plugins/foxycape-pdf/static/signer.js', 'signer')
    files.set(`plugins/foxycape-pdf/${SIGNER_VERSION_MARKER}`, `${RUNTIME_ID}\n`)
    files.set('plugins/foxycape-pdf/locales/en.json', '{}')

    expect(await hasPdfBundle(plugin)).toBe(true)
    expect(await pdfjsPackNeedsDownload(plugin)).toBe(false)
    await ensurePdfjsPack(plugin)

    files.delete('plugins/foxycape-pdf/locales/en.json')
    expect(await pdfjsPackNeedsDownload(plugin)).toBe(true)
    files.set('plugins/foxycape-pdf/locales/en.json', '{}')

    files.delete(`plugins/foxycape-pdf/${SIGNER_VERSION_MARKER}`)
    expect(await pdfjsPackNeedsDownload(plugin)).toBe(true)
  })

  it('requires the pdf.js cmaps marker to match before skipping the remote pack', async () => {
    const { files, dirs, plugin } = createVault()
    dirs.add('plugins/foxycape-pdf/pdfjs/cmaps')
    dirs.add('plugins/foxycape-pdf/pdfjs/standard_fonts')
    dirs.add('plugins/foxycape-pdf/pdfjs/wasm')
    dirs.add('plugins/foxycape-pdf/pdfjs/iccs')
    dirs.add('plugins/foxycape-pdf/katex/fonts')
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
