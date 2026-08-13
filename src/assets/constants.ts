/** GitHub repo that hosts release attachments (same tag as manifest.version). */
export const RUNTIME_ASSETS_REPO = 'foxycape/obsidian-pdf'

/** Release attachment name produced by `npm run build` (cmaps + standard_fonts). */
export const RUNTIME_ASSETS_ZIP_NAME = 'foxycape-pdf-assets.zip'

/**
 * Remote cmaps / standard_fonts id (pdf.js version only). Signer-only changes
 * do not re-download this pack. Worker + signer are unpacked from main.js.
 */
export const RUNTIME_CMAPS_ID = __FOXYCAPE_PDFJS_CMAPS_ID__

/** Written after installing the remote cmaps / fonts zip. */
export const RUNTIME_CMAPS_VERSION_MARKER = 'pdfjs/.foxycape-cmaps-version'

/** Approximate size of the remote cmaps + fonts zip (worker/signer are in main.js). */
export const RUNTIME_ASSETS_SIZE_HINT = '~1.5 MB'

/** Paths that must exist after unpacking worker + signer from main.js. */
export const EMBEDDED_RUNTIME_MARKERS = [
  'pdfjs/pdf.worker.min.mjs',
  'static/signer.js',
] as const

/** Paths that must exist after the remote cmaps/fonts install. */
export const REMOTE_RUNTIME_MARKERS = [
  'pdfjs/cmaps',
  'pdfjs/standard_fonts',
] as const

/** Zip lives on the current plugin GitHub Release; only fetched when the cmaps id mismatches. */
export const buildRuntimeAssetsDownloadUrl = (pluginVersion: string): string =>
  `https://github.com/${RUNTIME_ASSETS_REPO}/releases/download/${pluginVersion}/${RUNTIME_ASSETS_ZIP_NAME}`
