import { ensurePdfWebWorker } from '@foxycape/core/mediaTypes/pdf/ensurePdfWebWorker'
import { normalizePath, type Plugin } from 'obsidian'
import {
  DISK_PDF_CMAP_URL,
  DISK_PDF_STANDARD_FONT_URL,
} from './pdfDiskAssetFactories'

export type PdfAssetUrls = {
  workerSrc: string
  cMapUrl: string
  standardFontDataUrl: string
}

let cachedWorkerBlobSrc: string | null = null

const readPluginText = async (plugin: Plugin, relativePath: string): Promise<string> => {
  const pluginDir = plugin.manifest.dir
  if (!pluginDir) {
    throw new Error('Plugin directory is unavailable (manifest.dir is empty).')
  }
  const path = normalizePath(`${pluginDir}/${relativePath}`)
  return plugin.app.vault.adapter.read(path)
}

/**
 * Read external `pdfjs/pdf.worker.min.mjs` → Blob URL, then install via
 * `ensurePdfWebWorker(preferred)`. Cmap/font URLs are placeholders; bytes come
 * from disk factories after `ensureRuntimeAssets`.
 */
export const resolvePdfAssetUrls = async (plugin: Plugin): Promise<PdfAssetUrls> => {
  if (!cachedWorkerBlobSrc) {
    const workerSource = await readPluginText(plugin, 'pdfjs/pdf.worker.min.mjs')
    if (!workerSource) {
      throw new Error('pdf.worker.min.mjs is empty or missing under the plugin directory.')
    }
    const blob = new Blob([workerSource], { type: 'text/javascript' })
    cachedWorkerBlobSrc = URL.createObjectURL(blob)
  }

  const workerSrc = ensurePdfWebWorker(cachedWorkerBlobSrc)
  return {
    workerSrc,
    cMapUrl: DISK_PDF_CMAP_URL,
    standardFontDataUrl: DISK_PDF_STANDARD_FONT_URL,
  }
}

/** Revoke the worker Blob URL created from the on-disk worker file. */
export const disposePdfWorkerBlobSrc = () => {
  if (!cachedWorkerBlobSrc) {
    return
  }
  URL.revokeObjectURL(cachedWorkerBlobSrc)
  cachedWorkerBlobSrc = null
}
