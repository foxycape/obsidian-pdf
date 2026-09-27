/**
 * Worker setup: on-disk `pdfjs/pdf.worker.min.mjs` is read as script text by
 * `resolvePdfAssetUrls`, then passed to `ensurePdfWebWorker(scriptText)`.
 */
export { ensurePdfWebWorker as setupFoxycapePdfWorker } from '@foxycape/core/mediaTypes/pdf/ensurePdfWebWorker'
