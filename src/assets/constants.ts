/** GitHub repo that hosts release attachments (same tag as manifest.version). */
export const RUNTIME_ASSETS_REPO = 'foxycape/obsidian-pdf'

/** Release attachment name produced by `npm run build` (cmaps, standard fonts, wasm, iccs, KaTeX woff2). */
export const RUNTIME_ASSETS_ZIP_NAME = 'pdfjs-assets.zip'

/**
 * Remote cmaps / standard_fonts id (pdf.js version only). Signer-only changes
 * do not re-download this pack.
 */
export const RUNTIME_CMAPS_ID = __FOXYCAPE_PDFJS_CMAPS_ID__

/** pdf.js version + signer contents. Written onto the worker and signer after pdfjs.zip is installed. */
export const RUNTIME_ID = __FOXYCAPE_RUNTIME_ID__

/** Written after installing the remote cmaps / fonts zip. */
export const RUNTIME_CMAPS_VERSION_MARKER = 'pdfjs/.foxycape-cmaps-version'

/** Approximate size of the remote cmaps + fonts zip. */
export const RUNTIME_ASSETS_SIZE_HINT = '~1.5 MB'

/** Reader, worker, signer, and language files. Downloaded once when the plugin is enabled. */
export const PDFJS_PACK_ZIP_NAME = 'pdfjs.zip'

/** English translations. Missing this file means pdfjs.zip must be downloaded again. */
export const LOCALE_EN_RELATIVE = 'locales/en.json'

export const SIGNER_RELATIVE = 'static/signer.js'

export const SIGNER_VERSION_MARKER = 'static/.foxycape-signer-version'

export const WORKER_RELATIVE = 'pdfjs/pdf.worker.min.mjs'

export const WORKER_VERSION_MARKER = 'pdfjs/.foxycape-worker-version'

/** Reader + AI, downloaded the first time a PDF is opened. */
export const PDF_BUNDLE_FILE = 'pdf.js'

export const PDF_BUNDLE_VERSION_MARKER = '.foxycape-pdf-bundle-version'

/** Paths that must exist after the remote cmaps/fonts/wasm/iccs/katex install. */
export const REMOTE_RUNTIME_MARKERS = [
  'pdfjs/cmaps',
  'pdfjs/standard_fonts',
  'pdfjs/wasm',
  'pdfjs/iccs',
  'katex/fonts',
] as const

/** CDN mirror. Used only after the GitHub download stalls or fails. OSS is not requested by the plugin. */
export const CDN_ASSETS_BASE = 'https://cdn.tiefeiying.com/obsidian-pdf/'

const releaseFileUrl = (pluginVersion: string, fileName: string): string =>
  `https://github.com/${RUNTIME_ASSETS_REPO}/releases/download/${pluginVersion}/${fileName}`

const cdnFileUrl = (pluginVersion: string, fileName: string): string =>
  `${CDN_ASSETS_BASE}${pluginVersion}/${fileName}`

/** Fonts zip. Fetched when the cmaps id mismatches. */
export const buildRuntimeAssetsDownloadUrl = (pluginVersion: string): string =>
  releaseFileUrl(pluginVersion, RUNTIME_ASSETS_ZIP_NAME)

export const buildRuntimeAssetsCdnUrl = (pluginVersion: string): string =>
  cdnFileUrl(pluginVersion, RUNTIME_ASSETS_ZIP_NAME)

export const buildPdfjsPackDownloadUrl = (pluginVersion: string): string =>
  releaseFileUrl(pluginVersion, PDFJS_PACK_ZIP_NAME)

export const buildPdfjsPackCdnUrl = (pluginVersion: string): string =>
  cdnFileUrl(pluginVersion, PDFJS_PACK_ZIP_NAME)
