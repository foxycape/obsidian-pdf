import { ensurePdfWebWorker } from '@foxycape/core/mediaTypes/pdf/ensurePdfWebWorker'
import {
  EMBEDDED_CMAP_URL,
  EMBEDDED_STANDARD_FONT_URL,
} from './pdfEmbeddedAssetFactories'

export type PdfAssetUrls = {
  workerSrc: string
  cMapUrl: string
  standardFontDataUrl: string
}

/**
 * Install pdf.js worker from the inlined `?raw` source (Blob URL) and return
 * placeholder cmap/font URLs used with embedded factories.
 */
export const resolvePdfAssetUrls = async (): Promise<PdfAssetUrls> => {
  const workerSrc = ensurePdfWebWorker()
  return {
    workerSrc,
    cMapUrl: EMBEDDED_CMAP_URL,
    standardFontDataUrl: EMBEDDED_STANDARD_FONT_URL,
  }
}

/**
 * Worker Blob URL is owned by `@foxycape/core` ensurePdfWebWorker for the
 * plugin lifetime; nothing to revoke from the Obsidian host.
 */
export const disposePdfWorkerBlobSrc = () => {
  // no-op: inlined worker Blob is reused until Obsidian unloads the plugin
}
