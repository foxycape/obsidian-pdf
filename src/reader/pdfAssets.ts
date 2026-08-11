import { normalizePath, type Plugin } from 'obsidian'
import { ensurePdfWebWorker } from '@core/mediaTypes/pdf/ensurePdfWebWorker'

export type PdfAssetUrls = {
  workerSrc: string
  cMapUrl: string
  standardFontDataUrl: string
}

const WORKER_RELATIVE = 'pdfjs/pdf.worker.min.mjs'

/** Cached Blob URL for the external worker script (plugin lifetime). */
let cachedWorkerBlobSrc: string | null = null
let workerLoadPromise: Promise<string> | null = null

const loadWorkerBlobSrc = async (plugin: Plugin): Promise<string> => {
  if (cachedWorkerBlobSrc) {
    return cachedWorkerBlobSrc
  }
  if (workerLoadPromise) {
    return workerLoadPromise
  }

  workerLoadPromise = (async () => {
    const pluginDir = plugin.manifest.dir
    if (!pluginDir) {
      throw new Error('Plugin directory is unavailable (manifest.dir is empty).')
    }

    const adapter = plugin.app.vault.adapter
    const workerPath = normalizePath(`${pluginDir}/${WORKER_RELATIVE}`)
    if (!(await adapter.exists(workerPath))) {
      throw new Error(
        `PDF worker missing at ${workerPath}. Rebuild the plugin so dist/pdfjs/pdf.worker.min.mjs is copied.`,
      )
    }

    const workerSource = await adapter.read(workerPath)
    if (!workerSource) {
      throw new Error(`PDF worker file is empty: ${workerPath}`)
    }

    // app:// plugin URLs cannot be used as module workers; Blob URL can.
    const blob = new Blob([workerSource], { type: 'text/javascript' })
    cachedWorkerBlobSrc = URL.createObjectURL(blob)
    return cachedWorkerBlobSrc
  })()

  try {
    return await workerLoadPromise
  } catch (error) {
    workerLoadPromise = null
    throw error
  }
}

/**
 * Release the cached worker Blob URL (call from plugin `onunload`).
 * Safe to call multiple times; do not open PDFs after this without reloading.
 */
export const disposePdfWorkerBlobSrc = () => {
  if (cachedWorkerBlobSrc) {
    URL.revokeObjectURL(cachedWorkerBlobSrc)
    cachedWorkerBlobSrc = null
  }
  workerLoadPromise = null
}

/**
 * Resolve pdf.js static assets under dist/pdfjs/.
 * Worker is read from disk once and exposed as a Blob URL for ensurePdfWebWorker.
 */
export const resolvePdfAssetUrls = async (plugin: Plugin): Promise<PdfAssetUrls> => {
  const pluginDir = plugin.manifest.dir
  if (!pluginDir) {
    throw new Error('Plugin directory is unavailable (manifest.dir is empty).')
  }

  const adapter = plugin.app.vault.adapter

  const toResourceUrl = (relativePath: string, asDirectory = false) => {
    const path = normalizePath(`${pluginDir}/${relativePath}`)
    let url = adapter.getResourcePath(path)
    if (asDirectory && !url.endsWith('/')) {
      url += '/'
    }
    return url
  }

  const workerSrc = await loadWorkerBlobSrc(plugin)
  // Install before any getDocument() so loadPdfDocument finds a usable workerSrc.
  ensurePdfWebWorker(workerSrc)

  return {
    workerSrc,
    cMapUrl: toResourceUrl('pdfjs/cmaps', true),
    standardFontDataUrl: toResourceUrl('pdfjs/standard_fonts', true),
  }
}
