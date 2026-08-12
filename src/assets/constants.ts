/** GitHub repo that hosts release attachments (same tag as manifest.version). */
export const RUNTIME_ASSETS_REPO = 'foxycape/obsidian-pdf'

/** Release attachment name produced by `npm run build`. */
export const RUNTIME_ASSETS_ZIP_NAME = 'foxycape-pdf-assets.zip'

/** Written after a successful extract; compared to `manifest.version`. */
export const RUNTIME_ASSETS_VERSION_MARKER = 'pdfjs/.foxycape-assets-version'

/**
 * Approximate download size shown in the first-open assets modal.
 * Keep in sync with the packaged zip (worker + cmaps + fonts + signer).
 */
export const RUNTIME_ASSETS_SIZE_HINT = '~3 MB'

/** Paths that must exist after extract (dev `dist/` copy or downloaded zip). */
export const RUNTIME_ASSETS_MARKERS = [
  'pdfjs/pdf.worker.min.mjs',
  'pdfjs/cmaps',
  'pdfjs/standard_fonts',
  'static/signer.js',
] as const

export const buildRuntimeAssetsDownloadUrl = (version: string): string =>
  `https://github.com/${RUNTIME_ASSETS_REPO}/releases/download/${version}/${RUNTIME_ASSETS_ZIP_NAME}`
