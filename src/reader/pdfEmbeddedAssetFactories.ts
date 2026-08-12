import cmapsBase64 from 'virtual:pdfjs-cmaps'
import fontsBase64 from 'virtual:pdfjs-standard-fonts'

/** Matches pdf.js CMapCompressionType.BINARY */
const CMAP_COMPRESSION_BINARY = 1

const decodeBase64 = (b64: string): Uint8Array => {
  const binary = atob(b64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i)
  }
  return bytes
}

const cmapCache = new Map<string, Uint8Array>()
const fontCache = new Map<string, Uint8Array>()

const getCmapBytes = (fileName: string): Uint8Array => {
  const cached = cmapCache.get(fileName)
  if (cached) {
    return cached
  }
  const b64 = (cmapsBase64 as Record<string, string>)[fileName]
  if (!b64) {
    throw new Error(`Embedded CMap missing: ${fileName}`)
  }
  const bytes = decodeBase64(b64)
  cmapCache.set(fileName, bytes)
  return bytes
}

const getFontBytes = (fileName: string): Uint8Array => {
  const cached = fontCache.get(fileName)
  if (cached) {
    return cached
  }
  const b64 = (fontsBase64 as Record<string, string>)[fileName]
  if (!b64) {
    throw new Error(`Embedded standard font missing: ${fileName}`)
  }
  const bytes = decodeBase64(b64)
  fontCache.set(fileName, bytes)
  return bytes
}

/**
 * pdf.js factory that serves packed cmaps from the Obsidian main.js bundle.
 * Requires getDocument({ useWorkerFetch: false, CMapReaderFactory }).
 */
export class EmbeddedCMapReaderFactory {
  baseUrl: string
  isCompressed: boolean

  constructor({
    baseUrl = 'embedded://cmaps/',
    isCompressed = true,
  }: {
    baseUrl?: string | null
    isCompressed?: boolean
  } = {}) {
    this.baseUrl = baseUrl ?? 'embedded://cmaps/'
    this.isCompressed = isCompressed
  }

  async fetch({ name }: { name: string }) {
    if (!name) {
      throw new Error('CMap name must be specified.')
    }
    const fileName = `${name}${this.isCompressed ? '.bcmap' : ''}`
    return {
      cMapData: getCmapBytes(fileName),
      compressionType: this.isCompressed ? CMAP_COMPRESSION_BINARY : 0,
    }
  }
}

/**
 * pdf.js factory that serves standard fonts from the Obsidian main.js bundle.
 */
export class EmbeddedStandardFontDataFactory {
  baseUrl: string

  constructor({ baseUrl = 'embedded://standard_fonts/' }: { baseUrl?: string | null } = {}) {
    this.baseUrl = baseUrl ?? 'embedded://standard_fonts/'
  }

  async fetch({ filename }: { filename: string }) {
    if (!filename) {
      throw new Error('Font filename must be specified.')
    }
    return getFontBytes(filename)
  }
}

export const EMBEDDED_CMAP_URL = 'embedded://cmaps/'
export const EMBEDDED_STANDARD_FONT_URL = 'embedded://standard_fonts/'

export const applyEmbeddedPdfAssetFactories = (params: {
  useWorkerFetch?: boolean
  CMapReaderFactory?: unknown
  StandardFontDataFactory?: unknown
  cMapUrl?: string
  standardFontDataUrl?: string
  cMapPacked?: boolean
}) => {
  params.useWorkerFetch = false
  params.CMapReaderFactory = EmbeddedCMapReaderFactory
  params.StandardFontDataFactory = EmbeddedStandardFontDataFactory
  params.cMapUrl = EMBEDDED_CMAP_URL
  params.standardFontDataUrl = EMBEDDED_STANDARD_FONT_URL
  params.cMapPacked = true
}
