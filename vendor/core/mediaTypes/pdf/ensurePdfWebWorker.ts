import * as pdfjsLib from '../../pdfjs/legacy/build/pdf.mjs'
import pdfWorkerSource from '../../pdfjs/legacy/build/pdf.worker.min.mjs?raw'

let blobWorkerSrc: string | null = null

/**
 * True when `src` can be passed to `new Worker(src, { type: 'module' })`.
 * Placeholders / `app://` plugin paths are treated as unusable (Obsidian).
 */
export const isUsablePdfWorkerSrc = (src: string | undefined | null): src is string => {
  if (!src) {
    return false
  }
  if (src === 'pdfjs:fake-worker' || src === 'foxycape-pdf:fake-worker') {
    return false
  }
  // Obsidian plugin resource URLs usually cannot be loaded as module workers.
  if (src.startsWith('app:')) {
    return false
  }
  if (/^(blob:|https?:|file:|data:)/i.test(src)) {
    return true
  }
  // Vite dev / relative asset paths
  return src.startsWith('/') || src.startsWith('./') || src.startsWith('../')
}

const createBlobWorkerSrc = () => {
  if (blobWorkerSrc) {
    return blobWorkerSrc
  }
  // Real Web Worker: worker code runs on a background thread.
  // Using a Blob URL avoids app:// / cross-origin module-worker restrictions.
  // Default path: source inlined via ?raw (browser samples).
  // Obsidian builds stub ?raw to "" and pass a Blob URL from an external worker file.
  if (!pdfWorkerSource) {
    throw new Error(
      'PDF worker source is not bundled. Pass a usable preferredWorkerSrc (e.g. Blob URL from an external pdf.worker.min.mjs).',
    )
  }
  const blob = new Blob([pdfWorkerSource], { type: 'text/javascript' })
  blobWorkerSrc = URL.createObjectURL(blob)
  return blobWorkerSrc
}

/**
 * Ensure `GlobalWorkerOptions.workerSrc` points at a real module Worker script.
 *
 * Preference order:
 * 1. Already-configured usable workerSrc
 * 2. Host-provided preferred URL (Vite `?url`, or Obsidian Blob URL from external worker file)
 * 3. Blob URL built from bundled worker source (`?raw`, when available)
 *
 * This is NOT pdf.js "fake worker" (main-thread simulation).
 */
export const ensurePdfWebWorker = (preferredWorkerSrc?: string): string => {
  const { GlobalWorkerOptions } = pdfjsLib

  if (isUsablePdfWorkerSrc(GlobalWorkerOptions.workerSrc)) {
    return GlobalWorkerOptions.workerSrc
  }

  if (isUsablePdfWorkerSrc(preferredWorkerSrc)) {
    GlobalWorkerOptions.workerSrc = preferredWorkerSrc
    return preferredWorkerSrc
  }

  const src = createBlobWorkerSrc()
  GlobalWorkerOptions.workerSrc = src
  return src
}
