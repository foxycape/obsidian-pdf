import type { Plugin } from 'vite'

const STUB_RAW_ID = '\0foxycape-stub-pdf-worker-raw'
const STUB_URL_ID = '\0foxycape-stub-pdf-worker-url'

const isPdfWorkerQuery = (id: string, query: 'raw' | 'url') => {
  const normalized = id.replace(/\\/g, '/')
  const isWorker =
    normalized.includes('/pdf.worker.min.mjs') ||
    normalized.includes('/pdf.worker.min.js') ||
    normalized.includes('pdf.worker.min.mjs') ||
    normalized.includes('pdf.worker.min.js')
  if (!isWorker) {
    return false
  }
  return (
    normalized.includes(`?${query}`) ||
    normalized.endsWith(`&${query}`) ||
    normalized.includes(`?${query}&`) ||
    normalized.includes(`&${query}&`)
  )
}

/**
 * Obsidian builds must not inline pdf.worker into main.js.
 *
 * Core imports:
 * - `pdf.worker.min.mjs?raw` (ensurePdfWebWorker fallback)
 * - `pdf.worker.min.js?url` (loadPdfDocument preferred) — Vite lib mode
 *   turns this into a multi‑MB `data:` URL if left alone.
 *
 * Stub both; the host passes a Blob URL from the on-disk worker file.
 */
export const stubPdfWorkerRawPlugin = (): Plugin => ({
  name: 'stub-pdf-worker-raw',
  enforce: 'pre',
  resolveId(id) {
    if (isPdfWorkerQuery(id, 'raw')) {
      return STUB_RAW_ID
    }
    if (isPdfWorkerQuery(id, 'url')) {
      return STUB_URL_ID
    }
    return null
  },
  load(id) {
    if (id === STUB_RAW_ID) {
      return 'export default ""'
    }
    if (id === STUB_URL_ID) {
      // Unusable placeholder — ensurePdfWebWorker will keep an already-set Blob URL.
      return 'export default "foxycape-pdf:fake-worker"'
    }
    return null
  },
})
