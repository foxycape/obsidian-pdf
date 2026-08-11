/**
 * Legacy host-global isolation helpers.
 *
 * Foxycape pdf.js is now built to use private globals only:
 *   __foxycapePdfjsLib / __foxycapePdfjsWorker / __foxycapePdfjsViewer
 * (see vite.rename-pdfjs-globals.ts). We no longer read or write
 * Obsidian / third-party `pdfjsLib` | `pdfjsWorker` | `pdfjsViewer`.
 *
 * These no-ops remain so older call sites / re-exports keep compiling.
 */

export const FOXYCAPE_PDFJS_VERSION = '4.7.76'

export const capturedHostPdfJs: undefined = undefined
export const capturedHostPdfJsWorker: undefined = undefined

export const isFoxycapePdfJs = (_lib: unknown): boolean => false

export const rememberHostPdfGlobals = () => {
  /* no-op: private globals — host slot untouched */
}

export const restoreHostPdfJs = () => {
  /* no-op */
}

export const restoreHostPdfJsWorker = () => {
  /* no-op */
}

export const restoreHostPdfGlobals = () => {
  /* no-op */
}
