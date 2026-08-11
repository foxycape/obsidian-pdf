/**
 * Vite redirects core `pdf_viewer.mjs` imports → this file (except from here).
 *
 * The real viewer is loaded via a relative path and rewritten at build time to:
 * 1) import Foxycape `pdf.mjs` directly (not host `globalThis.pdfjsLib`)
 * 2) use private globals `__foxycapePdfjs*` instead of shared host names
 */
export * from '@core/pdfjs/legacy/web/pdf_viewer.mjs'
