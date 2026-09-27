import { normalizePath, type Plugin } from 'obsidian'

const DISK_CMAP_URL = 'foxycape-pdf://cmaps/'
const DISK_STANDARD_FONT_URL = 'foxycape-pdf://standard_fonts/'
const DISK_WASM_URL = 'foxycape-pdf://wasm/'

/**
 * pdf.js factory that reads cmaps, standard fonts, and wasm from the plugin directory
 * (populated by build copy or runtime asset zip). Uses vault.adapter so Obsidian
 * app:// fetch/worker limitations do not apply.
 */
export const createDiskPdfAssetInitializer = (plugin: Plugin) => {
  const readPluginBinary = async (relativePath: string): Promise<Uint8Array> => {
    const pluginDir = plugin.manifest.dir
    if (!pluginDir) {
      throw new Error('Plugin directory is unavailable (manifest.dir is empty).')
    }
    const path = normalizePath(`${pluginDir}/${relativePath}`)
    const buffer = await plugin.app.vault.adapter.readBinary(path)
    return new Uint8Array(buffer)
  }

  class DiskBinaryDataFactory {
    async fetch({ kind, filename }: { kind: string; filename: string }) {
      if (!filename) {
        throw new Error('Filename must be specified.')
      }
      if (kind === 'cMapUrl') {
        return readPluginBinary(`pdfjs/cmaps/${filename}`)
      }
      if (kind === 'standardFontDataUrl') {
        return readPluginBinary(`pdfjs/standard_fonts/${filename}`)
      }
      if (kind === 'wasmUrl') {
        return readPluginBinary(`pdfjs/wasm/${filename}`)
      }
      throw new Error(`Not implemented: ${kind}`)
    }
  }

  return (params: {
    useWorkerFetch?: boolean
    BinaryDataFactory?: unknown
    cMapUrl?: string
    standardFontDataUrl?: string
    wasmUrl?: string
    cMapPacked?: boolean
  }) => {
    params.useWorkerFetch = false
    params.BinaryDataFactory = DiskBinaryDataFactory
    params.cMapUrl = DISK_CMAP_URL
    params.standardFontDataUrl = DISK_STANDARD_FONT_URL
    params.wasmUrl = DISK_WASM_URL
    params.cMapPacked = true
  }
}

export const DISK_PDF_CMAP_URL = DISK_CMAP_URL
export const DISK_PDF_STANDARD_FONT_URL = DISK_STANDARD_FONT_URL
