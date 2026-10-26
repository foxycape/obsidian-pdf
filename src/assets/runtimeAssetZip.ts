import { unzipSync } from 'fflate'
import { normalizePath, type Plugin } from 'obsidian'

type Adapter = Plugin['app']['vault']['adapter']

export const joinPluginPath = (pluginDir: string, relativePath: string) =>
  normalizePath(`${pluginDir}/${relativePath}`)

export const ensureParentDir = async (adapter: Adapter, filePath: string) => {
  const parts = filePath.split('/')
  parts.pop()
  let current = ''
  for (const part of parts) {
    if (!part) {
      continue
    }
    current = current ? `${current}/${part}` : part
    if (!(await adapter.exists(current))) {
      await adapter.mkdir(current)
    }
  }
}

const normalizeZipEntryName = (name: string): string => name.replace(/\\/g, '/')

const isSafeZipPath = (name: string): boolean => {
  if (!name || name.endsWith('/')) {
    return false
  }
  const normalized = normalizeZipEntryName(name)
  return !normalized.startsWith('/') && !normalized.includes('..')
}

/** reader-bundle.zip contains the reader bundle (UI, Dexie, hash worker) and KaTeX CSS. */
export const isReaderZipEntryName = (name: string): boolean => {
  const normalized = normalizeZipEntryName(name)
  return (
    isSafeZipPath(normalized) &&
    (normalized === 'reader-bundle.js' || normalized === 'katex/katex.css')
  )
}

/** pdfjs.zip contains the PDF.js library and its worker. */
export const isPdfjsZipEntryName = (name: string): boolean => {
  const normalized = normalizeZipEntryName(name)
  return (
    isSafeZipPath(normalized) &&
    (normalized === 'pdf-lib.js' || normalized === 'pdfjs/pdf.worker.min.mjs')
  )
}

/** locales.zip contains language JSON files. */
export const isLocalesZipEntryName = (name: string): boolean => {
  const normalized = normalizeZipEntryName(name)
  return isSafeZipPath(normalized) && /^locales\/[A-Za-z0-9_-]+\.json$/.test(normalized)
}

export const isRemoteZipEntryName = (name: string): boolean => {
  const normalized = normalizeZipEntryName(name)
  return (
    isSafeZipPath(normalized) &&
    (normalized.startsWith('pdfjs/cmaps/') ||
      normalized.startsWith('pdfjs/standard_fonts/') ||
      normalized.startsWith('pdfjs/wasm/') ||
      normalized.startsWith('pdfjs/iccs/'))
  )
}

export const decodeBase64ToBytes = (base64: string): Uint8Array => {
  if (!base64) {
    throw new Error('Embedded runtime assets are empty.')
  }
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i)
  }
  return bytes
}

export type ExtractZipOptions = {
  isAllowedEntry: (name: string) => boolean
  zipLabel: string
  markerRelativePath?: string
  markerValue?: string
  onProgress?: (current: number, total: number) => void
}

export const extractZipToPluginDir = async (
  plugin: Plugin,
  zipBytes: Uint8Array,
  options: ExtractZipOptions,
) => {
  const pluginDir = plugin.manifest.dir
  if (!pluginDir) {
    throw new Error('Plugin directory is unavailable (manifest.dir is empty).')
  }

  const adapter = plugin.app.vault.adapter
  const entries = unzipSync(zipBytes)
  const files = Object.entries(entries).filter(([rawName]) =>
    options.isAllowedEntry(normalizeZipEntryName(rawName)),
  )
  const total = files.length
  let written = 0

  for (const [rawName, data] of files) {
    const name = normalizeZipEntryName(rawName)
    const target = joinPluginPath(pluginDir, name)
    await ensureParentDir(adapter, target)
    await adapter.writeBinary(
      target,
      data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength),
    )
    written += 1
    options.onProgress?.(written, total)
  }

  if (written === 0) {
    throw new Error(`No usable files found in ${options.zipLabel}.`)
  }

  if (!options.markerRelativePath || options.markerValue === undefined) {
    return
  }

  const markerPath = joinPluginPath(pluginDir, options.markerRelativePath)
  await ensureParentDir(adapter, markerPath)
  await adapter.write(markerPath, `${options.markerValue}\n`)
}
