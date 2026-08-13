import { zipSync } from 'fflate'
import { describe, expect, it } from 'vitest'
import type { Plugin } from 'obsidian'
import {
  RUNTIME_CMAPS_ID,
  RUNTIME_CMAPS_VERSION_MARKER,
} from '@/assets/constants'
import {
  hasEmbeddedRuntimeAssets,
  hasRemoteRuntimeAssets,
} from '@/assets/ensureRuntimeAssets'
import {
  decodeBase64ToBytes,
  extractZipToPluginDir,
  isEmbeddedZipEntryName,
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
  it('only allows worker/signer in the embedded pack and cmaps/fonts in the remote pack', () => {
    expect(isEmbeddedZipEntryName('pdfjs/pdf.worker.min.mjs')).toBe(true)
    expect(isEmbeddedZipEntryName('static/signer.js')).toBe(true)
    expect(isEmbeddedZipEntryName('pdfjs/cmaps/Adobe-GB1-0.bcmap')).toBe(false)
    expect(isRemoteZipEntryName('pdfjs/cmaps/Adobe-GB1-0.bcmap')).toBe(true)
    expect(isRemoteZipEntryName('pdfjs/standard_fonts/FoxitSerif.pfb')).toBe(true)
    expect(isRemoteZipEntryName('pdfjs/pdf.worker.min.mjs')).toBe(false)
    expect(isRemoteZipEntryName('../secret.txt')).toBe(false)
    expect(isEmbeddedZipEntryName('pdfjs/cmaps/')).toBe(false)
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
      'pdfjs/pdf.worker.min.mjs': bytesOf('worker'),
      'static/signer.js': bytesOf('signer'),
      'pdfjs/cmaps/ignored.bcmap': bytesOf('nope'),
    })

    await extractZipToPluginDir(plugin, zipped, {
      isAllowedEntry: isEmbeddedZipEntryName,
      zipLabel: 'embedded',
    })

    expect(files.has('plugins/foxycape-pdf/pdfjs/pdf.worker.min.mjs')).toBe(true)
    expect(files.has('plugins/foxycape-pdf/static/signer.js')).toBe(true)
    expect(files.has('plugins/foxycape-pdf/pdfjs/cmaps/ignored.bcmap')).toBe(false)
    expect(files.has('plugins/foxycape-pdf/pdfjs/.foxycape-embedded-version')).toBe(
      false,
    )
  })
})

describe('runtime asset install detection', () => {
  it('treats worker and signer files as embedded assets when they exist', async () => {
    const { files, plugin } = createVault()
    files.set('plugins/foxycape-pdf/pdfjs/pdf.worker.min.mjs', 'worker')
    files.set('plugins/foxycape-pdf/static/signer.js', 'signer')

    expect(await hasEmbeddedRuntimeAssets(plugin)).toBe(true)
    expect(await hasRemoteRuntimeAssets(plugin)).toBe(false)
  })

  it('requires the pdf.js cmaps marker to match before skipping the remote pack', async () => {
    const { files, dirs, plugin } = createVault()
    dirs.add('plugins/foxycape-pdf/pdfjs/cmaps')
    dirs.add('plugins/foxycape-pdf/pdfjs/standard_fonts')
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
