import { normalizePath, type Plugin } from 'obsidian'

/** Matches pdf.js CMapCompressionType.BINARY */
const CMAP_COMPRESSION_BINARY = 1

const DISK_CMAP_URL = 'foxycape-pdf://cmaps/'
const DISK_STANDARD_FONT_URL = 'foxycape-pdf://standard_fonts/'

/**
 * pdf.js factories that read cmaps / standard fonts from the plugin directory
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

  class DiskCMapReaderFactory {
    baseUrl: string
    isCompressed: boolean

    constructor({
      baseUrl = DISK_CMAP_URL,
      isCompressed = true,
    }: {
      baseUrl?: string | null
      isCompressed?: boolean
    } = {}) {
      this.baseUrl = baseUrl ?? DISK_CMAP_URL
      this.isCompressed = isCompressed
    }

    async fetch({ name }: { name: string }) {
      if (!name) {
        throw new Error('CMap name must be specified.')
      }
      const fileName = `${name}${this.isCompressed ? '.bcmap' : ''}`
      return {
        cMapData: await readPluginBinary(`pdfjs/cmaps/${fileName}`),
        compressionType: this.isCompressed ? CMAP_COMPRESSION_BINARY : 0,
      }
    }
  }

  class DiskStandardFontDataFactory {
    baseUrl: string

    constructor({ baseUrl = DISK_STANDARD_FONT_URL }: { baseUrl?: string | null } = {}) {
      this.baseUrl = baseUrl ?? DISK_STANDARD_FONT_URL
    }

    async fetch({ filename }: { filename: string }) {
      if (!filename) {
        throw new Error('Font filename must be specified.')
      }
      return readPluginBinary(`pdfjs/standard_fonts/${filename}`)
    }
  }

  return (params: {
    useWorkerFetch?: boolean
    CMapReaderFactory?: unknown
    StandardFontDataFactory?: unknown
    cMapUrl?: string
    standardFontDataUrl?: string
    cMapPacked?: boolean
  }) => {
    params.useWorkerFetch = false
    params.CMapReaderFactory = DiskCMapReaderFactory
    params.StandardFontDataFactory = DiskStandardFontDataFactory
    params.cMapUrl = DISK_CMAP_URL
    params.standardFontDataUrl = DISK_STANDARD_FONT_URL
    params.cMapPacked = true
  }
}

export const DISK_PDF_CMAP_URL = DISK_CMAP_URL
export const DISK_PDF_STANDARD_FONT_URL = DISK_STANDARD_FONT_URL
