import { ensurePdfWebWorker } from '@foxycape/core/mediaTypes/pdf/ensurePdfWebWorker'
import { normalizePath, type Plugin } from 'obsidian'
import {
  DISK_PDF_CMAP_URL,
  DISK_PDF_STANDARD_FONT_URL,
} from './pdfDiskAssetFactories'

export type PdfAssetUrls = {
  cMapUrl: string
  standardFontDataUrl: string
}

let cachedWorkerSource: string | null = null

const readPluginText = async (plugin: Plugin, relativePath: string): Promise<string> => {
  const pluginDir = plugin.manifest.dir
  if (!pluginDir) {
    throw new Error('Plugin directory is unavailable (manifest.dir is empty).')
  }
  const path = normalizePath(`${pluginDir}/${relativePath}`)
  return plugin.app.vault.adapter.read(path)
}

/**
 * Read external `pdfjs/pdf.worker.min.mjs` and install it via
 * `ensurePdfWebWorker(scriptText)` before the document opens.
 * Cmap/font URLs are placeholders; bytes come from disk factories.
 */
export const resolvePdfAssetUrls = async (plugin: Plugin): Promise<PdfAssetUrls> => {
  if (!cachedWorkerSource) {
    const workerSource = await readPluginText(plugin, 'pdfjs/pdf.worker.min.mjs')
    if (!workerSource) {
      throw new Error('pdf.worker.min.mjs is empty or missing under the plugin directory.')
    }
    cachedWorkerSource = workerSource
  }

  await ensurePdfWebWorker(cachedWorkerSource)
  return {
    cMapUrl: DISK_PDF_CMAP_URL,
    standardFontDataUrl: DISK_PDF_STANDARD_FONT_URL,
  }
}

/** Drop the cached worker script text. The installed worker port stays in core. */
export const disposePdfWorkerBlobSrc = () => {
  cachedWorkerSource = null
}
