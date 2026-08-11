/**
 * Worker setup: host installs a usable Blob/http URL via `ensurePdfWebWorker`,
 * then `loadPdfDocument` reuses `GlobalWorkerOptions.workerSrc`.
 * Obsidian loads `dist/pdfjs/pdf.worker.min.mjs` in `resolvePdfAssetUrls`.
 */
export { ensurePdfWebWorker as setupFoxycapePdfWorker } from '@foxycape/core/mediaTypes/pdf/ensurePdfWebWorker'
