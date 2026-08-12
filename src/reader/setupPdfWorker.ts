/**
 * Worker setup: on-disk `pdfjs/pdf.worker.min.mjs` → Blob URL via
 * `resolvePdfAssetUrls` → `ensurePdfWebWorker(preferred)`.
 */
export { ensurePdfWebWorker as setupFoxycapePdfWorker } from '@foxycape/core/mediaTypes/pdf/ensurePdfWebWorker'
